import { test, expect, LEGAL_PATHS } from "./fixtures";

test.describe("Adressen", () => {
  for (const path of LEGAL_PATHS) {
    test(`${path} antwortet mit 200`, async ({ request }) => {
      const response = await request.get(path);
      expect(response.status()).toBe(200);
    });
  }

  test("Ein unbekanntes Produkt ergibt ein echtes 404", async ({ page }) => {
    const response = await page.goto("/products/dieses-produkt-gibt-es-nicht");

    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "Nichts zu holen hier" })).toBeVisible();
  });

  test("Die alte Odoo-Shopadresse leitet dauerhaft auf die Startseite", async ({
    request,
  }) => {
    const response = await request.get("/shop", { maxRedirects: 0 });

    expect(response.status()).toBe(301);
    expect(new URL(response.headers().location).pathname).toBe("/");
  });

  test("Eine alte Odoo-Produktadresse leitet auf das heutige Produkt", async ({
    request,
  }) => {
    // Falscher Slug, Sprachpfad und Odoo-Parameter: es zählt nur die ID.
    const response = await request.get(
      "/fr_CH/shop/kailar-filer-11?search=filter&order=list_price+asc",
      { maxRedirects: 0 },
    );

    expect(response.status()).toBe(301);
    const target = new URL(response.headers().location);
    expect(target.pathname).toBe("/products/kailar-filter-5-9mm-65stk-weiss");
    expect(target.search).toBe("");
  });
});

test.describe("Alte Adressen ohne Weiterleitung", () => {
  test("/terms antwortet selbst — mit dem Inhalt und dem Canonical von /agb", async ({
    page,
  }) => {
    const response = await page.goto("/terms");

    expect(response?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe("/terms");
    await expect(
      page.getByRole("heading", { level: 1, name: "Allgemeine Geschäftsbedingungen" }),
    ).toBeVisible();
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(new URL(canonical ?? "").pathname).toBe("/agb");
  });

  test("Der alte Warenkorb ist weg (410), nicht die Startseite", async ({ request }) => {
    const response = await request.get("/fr_CH/shop/cart", { maxRedirects: 0 });

    expect(response.status()).toBe(410);
  });
});

test.describe("Sitemap, robots.txt und Merchant-Feed", () => {
  test("Der Feed führt jede Packung mit Gruppe, Versand und kanonischem Link", async ({
    request,
  }) => {
    const response = await request.get("/merchant-feed.tsv");

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/tab-separated-values");
    const [head, ...lines] = (await response.text()).trimEnd().split("\n");
    const columns = head.split("\t");
    expect(columns).toEqual(
      expect.arrayContaining(["id", "link", "canonical_link", "item_group_id", "price"]),
    );
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      const row = Object.fromEntries(line.split("\t").map((cell, i) => [columns[i], cell]));
      expect(row.id).not.toBe("");
      expect(row.price).toMatch(/^\d+\.\d{2} CHF$/);
      expect(new URL(row.link).pathname).toBe(new URL(row.canonical_link).pathname);
      expect(new URL(row.canonical_link).search).toBe("");
    }
  });

  test("Die Kennung im Feed ist die sku im JSON-LD der Produktseite", async ({
    request,
  }) => {
    const feed = (await (await request.get("/merchant-feed.tsv")).text()).trimEnd().split("\n");
    const columns = feed[0].split("\t");
    const row = Object.fromEntries(feed[1].split("\t").map((cell, i) => [columns[i], cell]));

    const html = await (await request.get(new URL(row.canonical_link).pathname)).text();
    // Steht nur im JSON-LD: die Seite selbst zeigt keine Artikelnummer.
    expect(html).toContain(`"sku":"${row.id}"`);
  });
});

test.describe("Sitemap und robots.txt (indexierbares Deployment)", () => {
  test("Die Sitemap führt jedes Produkt des Feeds — kanonisch, mit Bild", async ({
    request,
  }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);
    const xml = await response.text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);

    expect(locs.length).toBeGreaterThan(10);
    for (const loc of locs) {
      expect(loc.startsWith("https://test.jibbit.ch")).toBe(true);
      expect(loc).not.toContain("variant=");
    }
    expect(new Set(locs).size).toBe(locs.length);
    expect(xml).toContain("<image:loc>https://test.jibbit.ch/media/");

    const feed = (await (await request.get("/merchant-feed.tsv")).text()).trimEnd().split("\n");
    const column = feed[0].split("\t").indexOf("canonical_link");
    for (const line of feed.slice(1)) {
      expect(locs).toContain(line.split("\t")[column]);
    }
  });

  test("robots.txt verweist auf die Sitemap", async ({ request }) => {
    const body = await (await request.get("/robots.txt")).text();
    expect(body).toMatch(/^Sitemap: https:\/\/test\.jibbit\.ch\/sitemap\.xml$/m);
  });
});
