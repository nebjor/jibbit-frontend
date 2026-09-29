import { test, expect } from "./fixtures";
import { SPECIAL_IMAGE_NAMES } from "./mock-backend/catalog.mjs";

/**
 * Bilder, deren Dateiname aus dem Admin stammt: Leerzeichen, Klammern, Komma,
 * Umlaut. Der Bildproxy lehnte solche Namen früher ab, und die Storefront gab
 * die Bilder deshalb mit der Backend-Adresse aus — an Proxy und Optimierung
 * vorbei, und mit einem Host in Seite, Sitemap, JSON-LD und Feed, der beim
 * Wechsel der API-Adresse ins Leere zeigt.
 *
 * Zwei Produkte des Testkatalogs tragen solche Namen
 * (e2e/mock-backend/catalog.mjs, SPECIAL_IMAGE_NAMES).
 */

const HOST = "127.0.0.1";

const BRACKETS = {
  handle: "purize-xtra-slim-white-50er-pack-5-9mm",
  title: "PURIZE Xtra Slim White 50er Pack",
  path: `/media/${HOST}/1789907393708-%5B6%5D%20PURIZE%20White%2C%2050er%20Pack.png`,
};

const SPACES = {
  handle: "kailar-filter-5-9mm-65stk-weiss",
  title: "Kailar Filter 5.9 mm, 65 Stk. weiss",
  path: `/media/${HOST}/1789906967215-Kailar%20Filter%209mm%20BIG%20%20100%20stk%20wei%C3%9F%20%28Kopie%29.png`,
};

/**
 * Die Backend-Adresse des Testlaufs — sie darf in keiner Ausgabe stehen.
 * Erkannt an Medusas `/static/`; `/_next/static/` sind die eigenen Dateien
 * der Storefront und nicht gemeint.
 */
const BACKEND = new RegExp(
  `127\\.0\\.0\\.1:${process.env.E2E_BACKEND_PORT ?? 9100}|(?<!/_next)/static/`,
);

test.describe("Bildproxy: Dateinamen mit Leerzeichen und Klammern", () => {
  test("Die Fixtures tragen wirklich solche Namen", () => {
    expect(SPECIAL_IMAGE_NAMES.brackets).toMatch(/\[6\] .*, /);
    expect(SPECIAL_IMAGE_NAMES.spaces).toMatch(/ {2}.*ß \(Kopie\)/);
  });

  for (const image of [BRACKETS, SPACES]) {
    test(`Der Proxy liefert ${image.handle} aus`, async ({ request }) => {
      const response = await request.get(image.path);

      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toBe("image/png");
      expect(response.headers()["x-content-type-options"]).toBe("nosniff");
      expect((await response.body()).length).toBeGreaterThan(50);
    });

    test(`Der Bildoptimizer rechnet ${image.handle} um`, async ({ request }) => {
      const response = await request.get(
        `/_next/image?url=${encodeURIComponent(image.path)}&w=640&q=75`,
      );

      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toMatch(/^image\//);
    });

    test(`Die Produktseite ${image.handle} zeigt das Bild über den Proxy`, async ({
      page,
    }) => {
      await page.goto(`/products/${image.handle}`);

      const img = page.getByAltText(image.title, { exact: true }).first();
      await expect(img).toBeVisible();
      await expect
        .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
        .toBeGreaterThan(0);

      const src = await img.evaluate((el: HTMLImageElement) => el.currentSrc);
      expect(src).toContain("/_next/image?url=");
      expect(decodeURIComponent(new URL(src).searchParams.get("url")!)).toBe(
        decodeURIComponent(image.path),
      );
      expect(new URL(src).searchParams.get("url")).toBe(image.path);

      // Überall, wo eine Adresse GELADEN oder von einem Crawler GELESEN wird:
      // Bilder, Preloads, Open Graph, JSON-LD. Der ganze Quelltext lässt sich
      // so nicht prüfen — im RSC-Payload steht die Produktansicht samt der
      // Medusa-URL als Eigenschaft für die Client-Komponenten (AddToCart,
      // TierGallery). Das ist ein Schlüssel, keine Adresse, die jemand abruft.
      const emitted = await page.evaluate(() => [
        ...[...document.querySelectorAll("img, source")].flatMap((el) => [
          el.getAttribute("src") ?? "",
          el.getAttribute("srcset") ?? "",
        ]),
        ...[...document.querySelectorAll("link")].flatMap((el) => [
          el.getAttribute("href") ?? "",
          el.getAttribute("imagesrcset") ?? "",
        ]),
        ...[...document.querySelectorAll("meta")].map(
          (el) => el.getAttribute("content") ?? "",
        ),
        ...[...document.querySelectorAll('script[type="application/ld+json"]')].map(
          (el) => el.textContent ?? "",
        ),
      ]);
      expect(emitted.length).toBeGreaterThan(5);
      for (const value of emitted) expect(value).not.toMatch(BACKEND);
    });
  }

  test("Startseite, Sitemap und Feed nennen die Backend-Adresse nicht", async ({
    request,
  }) => {
    for (const path of ["/", "/sitemap.xml", "/merchant-feed.tsv"]) {
      const body = await (await request.get(path)).text();
      expect(body, path).not.toMatch(BACKEND);
    }

    const sitemap = await (await request.get("/sitemap.xml")).text();
    const feed = await (await request.get("/merchant-feed.tsv")).text();
    for (const image of [BRACKETS, SPACES]) {
      expect(sitemap).toContain(`<image:loc>https://test.jibbit.ch${image.path}</image:loc>`);
      expect(feed).toContain(`https://test.jibbit.ch${image.path}`);
    }
  });

  test("Das JSON-LD der Produktseite führt dieselbe Adresse wie der Feed", async ({
    request,
  }) => {
    const html = await (await request.get(`/products/${BRACKETS.handle}`)).text();
    expect(html).toContain(`https://test.jibbit.ch${BRACKETS.path}`);
  });

  /**
   * Die Gegenprobe am laufenden Server: hier sieht man, was Next selbst aus
   * einer solchen Adresse macht, bevor die Route sie überhaupt bekommt.
   * `/health` gibt es beim nachgestellten Backend wirklich — käme ein
   * Pfadwechsel durch, wäre die Antwort kein 404.
   */
  for (const path of [
    `/media/${HOST}/..%2Fhealth`,
    `/media/${HOST}/%2e%2e/health`,
    `/media/${HOST}/%2e%2e%2fhealth`,
    `/media/${HOST}/%252e%252e%252fhealth`,
    // Doppelt kodiert, aber harmlos gemeint: kein zweiter Weg zum selben Bild.
    `/media/${HOST}/ocb-heftchen%252Epng`,
    `/media/${HOST}/1789907393708-%255B6%255D%2520PURIZE%2520White%252C%252050er%2520Pack.png`,
    `/media/${HOST}/a%2F..%2F..%2Fhealth`,
    `/media/${HOST}/a%5C..%5C..%5Chealth`,
    `/media/${HOST}/ocb-heftchen.png%00.csv`,
    `/media/${HOST}/ocb-heftchen.png%2500`,
    `/media/${HOST}/private-ocb-heftchen.png`,
    `/media/127.0.0.1%3A9100/ocb-heftchen.png`,
    `/media/example.com/ocb-heftchen.png`,
  ]) {
    test(`Kein Bild unter ${path}`, async ({ request }) => {
      const response = await request.get(path, { maxRedirects: 0 });

      expect(response.status()).toBeGreaterThanOrEqual(400);
      expect(response.status()).toBeLessThan(500);
      expect(response.headers()["content-type"] ?? "").not.toMatch(/^image\//);
      expect(await response.text()).not.toContain('"status":"ok"');
    });
  }
});
