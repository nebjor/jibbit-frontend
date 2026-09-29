import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { NextFetchEvent } from "next/server";
import type { TenantConfig } from "./lib/tenant/types";
import { decodeTenantHeader } from "./lib/tenant/header-codec";
import { TENANT_CONFIG_HEADER } from "./lib/tenant/constants";

vi.mock("./lib/tenant/local-fallback", () => ({
  resolveLocalFallbackTenant: vi.fn(() => null),
}));
vi.mock("./lib/tenant/config-cache", () => ({
  resolveTenantConfig: vi.fn(),
}));

// Imported after the mocks so proxy.ts picks up the mocked modules.
const { resolveTenantConfig } = await import("./lib/tenant/config-cache");
const { proxy, config } = await import("./proxy");

function makeConfig(id: string, host: string): TenantConfig {
  return {
    id,
    host,
    backendUrl: `https://backend-${id}.internal`,
    publishableKey: `pk_${id}`,
    theme: { storeName: id, domain: host, themeColor: "#fff" },
  };
}

function makeRequest(host: string, extraHeaders: Record<string, string> = {}) {
  return new NextRequest(`https://${host}/shop`, {
    headers: new Headers({ host, ...extraHeaders }),
  });
}

function makeEvent(): NextFetchEvent {
  return { waitUntil: vi.fn() } as unknown as NextFetchEvent;
}

describe("proxy (tenant resolution)", () => {
  beforeEach(() => {
    vi.mocked(resolveTenantConfig).mockReset();
  });

  it("404s an unresolvable host instead of falling back to any tenant", async () => {
    vi.mocked(resolveTenantConfig).mockResolvedValue(null);

    const res = await proxy(makeRequest("nobody-owns-this.example.com"), makeEvent());

    expect(res.status).toBe(404);
  });

  it("attaches the resolved tenant's config to the outgoing request for a known host", async () => {
    const tenantA = makeConfig("tenant-a", "a.jibbit.app");
    vi.mocked(resolveTenantConfig).mockImplementation(async (host: string) =>
      host === "a.jibbit.app" ? tenantA : null,
    );

    const res = await proxy(makeRequest("a.jibbit.app"), makeEvent());

    expect(res.status).not.toBe(404);
    const forwarded = res.headers.get(`x-middleware-request-${TENANT_CONFIG_HEADER}`);
    expect(forwarded).not.toBeNull();
    expect(decodeTenantHeader(forwarded as string)).toEqual(tenantA);
  });

  it("strips a client-supplied x-tenant-config header rather than trusting it", async () => {
    const tenantA = makeConfig("tenant-a", "a.jibbit.app");
    vi.mocked(resolveTenantConfig).mockImplementation(async (host: string) =>
      host === "a.jibbit.app" ? tenantA : null,
    );

    const spoofed = "not-a-real-tenant-config";
    const res = await proxy(
      makeRequest("a.jibbit.app", { [TENANT_CONFIG_HEADER]: spoofed }),
      makeEvent(),
    );

    const forwarded = res.headers.get(`x-middleware-request-${TENANT_CONFIG_HEADER}`);
    expect(forwarded).not.toBe(spoofed);
    expect(decodeTenantHeader(forwarded as string)).toEqual(tenantA);
  });
});

/**
 * Noindex-Header für gesperrte Deployments (Staging). Der Schalter
 * SITE_INDEXABLE wird je Anfrage aus der Umgebung gelesen — deshalb lässt er
 * sich hier zwischen zwei Aufrufen desselben Moduls umlegen, genau wie ein
 * Container-Neustart es täte. Begründung: lib/seo/indexing.ts.
 */
describe("proxy (X-Robots-Tag)", () => {
  const tenantA = makeConfig("tenant-a", "a.jibbit.app");

  beforeEach(() => {
    vi.mocked(resolveTenantConfig).mockReset();
    vi.mocked(resolveTenantConfig).mockImplementation(async (host: string) =>
      host === "a.jibbit.app" ? tenantA : null,
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function makeAssetRequest(path: string) {
    // Wie der echte Aufruf: beliebiger Host, der in keiner Tenant-Tabelle steht.
    return new NextRequest(`https://unknown.example.com${path}`, {
      headers: new Headers({ host: "unknown.example.com" }),
    });
  }

  it("gesperrt: Seiten tragen noindex, nofollow — und weiterhin ihren Tenant", async () => {
    vi.stubEnv("SITE_INDEXABLE", "false");

    const res = await proxy(makeRequest("a.jibbit.app"), makeEvent());

    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(
      res.headers.get(`x-middleware-request-${TENANT_CONFIG_HEADER}`),
    ).not.toBeNull();
  });

  it("ohne gesetzte Variable gilt gesperrt — sichere Voreinstellung", async () => {
    vi.stubEnv("SITE_INDEXABLE", undefined);

    const res = await proxy(makeRequest("a.jibbit.app"), makeEvent());

    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("gesperrt: auch das 404 für unbekannte Hosts trägt den Header", async () => {
    vi.stubEnv("SITE_INDEXABLE", "false");

    const res = await proxy(makeRequest("nobody.example.com"), makeEvent());

    expect(res.status).toBe(404);
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("indexierbar: kein X-Robots-Tag, nirgends — Verhalten wie bisher", async () => {
    vi.stubEnv("SITE_INDEXABLE", "true");

    const page = await proxy(makeRequest("a.jibbit.app"), makeEvent());
    const notFound = await proxy(makeRequest("nobody.example.com"), makeEvent());
    const image = await proxy(makeAssetRequest("/_next/image?url=%2Fmedia%2Fx.webp&w=640&q=75"), makeEvent());

    for (const res of [page, notFound, image]) {
      expect(res.headers.has("x-robots-tag")).toBe(false);
    }
  });

  it("Bildpfade: Header ja, Tenant-Auflösung NEIN — sonst 404 auf jedes Bild", async () => {
    vi.stubEnv("SITE_INDEXABLE", "false");

    for (const path of [
      "/_next/image?url=%2Fmedia%2Fx.webp&w=640&q=75",
      "/media/test.jibbit.ch/1755-foo.webp",
      "/loader/joint.png",
    ]) {
      const res = await proxy(makeAssetRequest(path), makeEvent());
      expect(res.status, path).not.toBe(404);
      expect(res.headers.get("x-robots-tag"), path).toBe("noindex, nofollow");
      expect(res.headers.get("x-middleware-next"), path).toBe("1");
    }
    expect(resolveTenantConfig).not.toHaveBeenCalled();
  });
});

/**
 * Der Matcher ist die eigentliche Sicherheitsgrenze — die Tests oben rufen
 * `proxy()` direkt auf und sagen deshalb NICHTS darüber aus, welche Pfade dort
 * überhaupt ankommen. Ein zu weit gefasster Ausschluss würde ganze Seiten an
 * der Tenant-Auflösung vorbeischleusen, ohne dass ein Test rot wird.
 */
describe("proxy (matcher)", () => {
  const matcher = new RegExp(`^${config.matcher[0]}$`);

  it("lässt Seiten, sitemap und robots durch die Auflösung laufen", () => {
    for (const path of [
      "/",
      "/shop",
      "/products/raw-classic-rolls-slim",
      "/sitemap.xml",
      "/robots.txt",
      "/mediathek", // NICHT vom media/-Ausschluss erfasst
    ]) {
      expect(matcher.test(path), path).toBe(true);
    }
  });

  it("nimmt genau die Pfade aus, die keinen Tenant-Header vertragen", () => {
    for (const path of [
      "/_next/static/chunks/main.js",
      "/_next/image",
      "/favicon.ico",
      "/healthz",
      // Der Bildoptimizer ruft diesen Pfad ohne jeden Header auf und würde
      // hier sonst 404 kassieren — siehe app/media/[...path]/route.ts.
      "/media/test.jibbit.ch/1755-foo.webp",
    ]) {
      expect(matcher.test(path), path).toBe(false);
    }
  });
});

/**
 * Zweiter Matcher-Block: Pfade, die NUR wegen des Noindex-Headers durch den
 * Proxy laufen. Er darf den ersten Block nicht aufweichen — was dort
 * ausgenommen ist, bekommt auch hier keinen Tenant (siehe Test oben).
 */
describe("proxy (matcher, Noindex-Block)", () => {
  it("lässt den Tenant-Matcher an erster Stelle und unverändert", () => {
    expect(config.matcher[0]).toBe(
      "/((?!_next/static|_next/image|favicon.ico|healthz|media/|loader/).*)",
    );
  });

  it("deckt Bildoptimizer, Bildproxy und Loader-Assets ab — sonst nichts", () => {
    expect(config.matcher.slice(1)).toEqual([
      "/_next/image",
      "/media/:path*",
      "/loader/:path*",
    ]);
  });
});

describe("proxy (alte Odoo-URLs)", () => {
  const redirectFor = async (host: string, path: string) => {
    vi.mocked(resolveTenantConfig).mockResolvedValue(makeConfig("jibbit", host));
    const req = new NextRequest(`https://${host}${path}`, { headers: new Headers({ host }) });
    return proxy(req, makeEvent());
  };

  it("leitet auf jibbit.ch mit 301 um, Kampagnenparameter bleiben", async () => {
    const res = await redirectFor("jibbit.ch", "/shop/gizeh-dw-extra-fine-61?utm_source=x");
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("https://jibbit.ch/products/gizeh-dw-extra-fine?utm_source=x");
  });

  // Die Adressen aus der Search Console: Sprachpfad, alter Slug, Odoo-Parameter.
  it.each([
    "/fr_CH/shop/kailar-filter-5-9mm-65stk-schwarz-26?search=filter",
    "/shop/kailar-filer-5-9mm-65stk-schwarz-26?search=filter",
    "/it/shop/kailar-filter-5-9mm-65stk-schwarz-26?order=list_price+asc",
  ])("%s: ein Sprung, ohne Odoo-Parameter", async (path) => {
    const res = await redirectFor("jibbit.ch", path);
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe(
      "https://jibbit.ch/products/kailar-filter-5-9mm-65stk-schwarz",
    );
  });

  it("lässt andere Mandanten unberührt", async () => {
    const res = await redirectFor("a.jibbit.app", "/contactus");
    expect(res.status).not.toBe(301);
  });
});

describe("proxy (Schreibweise der Produktadressen)", () => {
  const respond = async (path: string) => {
    const host = "a.jibbit.app";
    vi.mocked(resolveTenantConfig).mockResolvedValue(makeConfig("tenant-a", host));
    const req = new NextRequest(`https://${host}${path}`, { headers: new Headers({ host }) });
    return proxy(req, makeEvent());
  };

  it("leitet gross geschriebene Handles dauerhaft auf die kleine Schreibweise", async () => {
    const res = await respond("/products/Gizeh-DW-Extra-Fine?variant=v1");
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe(
      "https://a.jibbit.app/products/gizeh-dw-extra-fine?variant=v1",
    );
  });

  it("reicht die kanonische Schreibweise unverändert durch", async () => {
    const res = await respond("/products/gizeh-dw-extra-fine");
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });
});

describe("proxy (Odoo-Adressen ohne Entsprechung)", () => {
  const respond = async (host: string, path: string) => {
    vi.mocked(resolveTenantConfig).mockResolvedValue(makeConfig("jibbit", host));
    const req = new NextRequest(`https://${host}${path}`, { headers: new Headers({ host }) });
    return proxy(req, makeEvent());
  };

  it.each([
    "/shop/cart",
    "/fr_CH/shop/change_pricelist/1",
    "/website/translations",
    "/web/image/product.template/10/image_1920?unique=8d486df",
    "/en/blog",
  ])("%s -> 410, nicht die Startseite", async (path) => {
    const res = await respond("jibbit.ch", path);
    expect(res.status).toBe(410);
    expect(res.headers.get("location")).toBeNull();
  });

  it("andere Mandanten dürfen unter diesen Pfaden eigene Seiten haben", async () => {
    const res = await respond("a.jibbit.app", "/blog");
    expect(res.status).toBe(200);
  });
});

/**
 * https://jibbit.ch/terms ist im Merchant Center als URL der
 * Rückgaberichtlinie hinterlegt — die Adresse antwortet selbst.
 */
describe("proxy (/terms)", () => {
  const respond = async (host: string, path: string) => {
    vi.mocked(resolveTenantConfig).mockResolvedValue({
      ...makeConfig("jibbit", host),
      theme: { storeName: "jibbit", domain: "jibbit.ch", themeColor: "#fff" },
    });
    const req = new NextRequest(`https://${host}${path}`, { headers: new Headers({ host }) });
    return proxy(req, makeEvent());
  };

  it("wird durchgereicht, nicht umgeleitet — die Seite ist app/terms", async () => {
    const res = await respond("jibbit.ch", "/terms");
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("reicht dabei den Mandanten weiter wie bei jeder Seite", async () => {
    const res = await respond("jibbit.ch", "/terms");
    const forwarded = res.headers.get(`x-middleware-request-${TENANT_CONFIG_HEADER}`);
    expect(decodeTenantHeader(forwarded ?? "")?.id).toBe("jibbit");
  });

  it("mit Sprachpfad: ein 301 auf /agb", async () => {
    const res = await respond("jibbit.ch", "/fr_CH/terms");
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("https://jibbit.ch/agb");
  });

  it("von www. aus: erst auf die Hauptdomain, dieselbe Adresse", async () => {
    const res = await respond("www.jibbit.ch", "/terms");
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("https://jibbit.ch/terms");
  });
});

describe("proxy (www. -> Hauptdomain)", () => {
  const respond = async (host: string, domain: string, path: string) => {
    vi.mocked(resolveTenantConfig).mockResolvedValue({
      ...makeConfig("jibbit", host),
      theme: { storeName: "jibbit", domain, themeColor: "#fff" },
    });
    const req = new NextRequest(`https://${host}${path}`, { headers: new Headers({ host }) });
    return proxy(req, makeEvent());
  };

  it("leitet jede Seite dauerhaft um, Pfad und Parameter bleiben", async () => {
    const res = await respond("www.jibbit.ch", "jibbit.ch", "/service/versand?utm_source=x");
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("https://jibbit.ch/service/versand?utm_source=x");
  });

  it("auch die Startseite", async () => {
    const res = await respond("www.jibbit.ch", "jibbit.ch", "/");
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("https://jibbit.ch/");
  });

  it("alte Odoo-Adresse unter www.: EIN Sprung bis zum Produkt", async () => {
    const res = await respond(
      "www.jibbit.ch",
      "jibbit.ch",
      "/shop/raw-classic-rolls-slim-2?order=list_price+desc",
    );
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe(
      "https://jibbit.ch/products/raw-black-classic-king-size-slim",
    );
  });

  it("www. und Grossschreibung zusammen: ein Sprung", async () => {
    const res = await respond("www.jibbit.ch", "jibbit.ch", "/products/OCB-Premium-Kurz");
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("https://jibbit.ch/products/ocb-premium-kurz");
  });

  it("die Hauptdomain selbst wird nicht umgeleitet", async () => {
    const res = await respond("jibbit.ch", "jibbit.ch", "/service/versand");
    expect(res.status).toBe(200);
  });

  it("ein Host, der nur anders heisst als die Domain, bleibt unberührt", async () => {
    const res = await respond("shop.jibbit.app", "meinshop.ch", "/service/versand");
    expect(res.status).toBe(200);
  });
});
