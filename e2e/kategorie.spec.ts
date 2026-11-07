import { test, expect, SHOP } from "./fixtures";

/**
 * Kategorieseiten (PLP) unter /kategorie/<handle>: serverseitig gerendert,
 * mit eigenem Titel, Text, FAQ und strukturierten Daten. Geprüft wird das
 * AUSGELIEFERTE HTML (kein Browser-JavaScript) — das sieht auch ein Crawler.
 */

test.describe("Kategorieseite im ausgelieferten HTML", () => {
  test("enthält Titel, Canonical, H1, Produkte, Ratgebertext und FAQ", async ({ request }) => {
    const response = await request.get("/kategorie/papers");
    expect(response.status()).toBe(200);
    const html = await response.text();

    expect(html).toMatch(/<title>Papers kaufen Schweiz[^<]*\| jibbit<\/title>/);
    expect(html).toMatch(/<meta name="description" content="Papers kaufen in der Schweiz/);
    expect(html).toMatch(/<link rel="canonical" href="https:\/\/[^"]+\/kategorie\/papers"/);
    expect(html).toContain("Papers kaufen in der Schweiz</h1>");
    // Produkt im Raster, nicht erst nach JavaScript.
    expect(html).toContain(SHOP.papers.title);
    // Ratgebertext und FAQ unter dem Raster.
    expect(html).toContain("Welches Papers-Format passt zu dir?");
    expect(html).toContain("Häufige Fragen");
    // Innere Verlinkung mit beschreibendem Linktext.
    expect(html).toMatch(/href="\/kategorie\/filter-tips"[^>]*>Filter Tips kaufen</);
  });

  test("trägt FAQPage, BreadcrumbList und ItemList als JSON-LD", async ({ request }) => {
    const html = await (await request.get("/kategorie/papers")).text();
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([^<]*)<\/script>/g)].map(
      (m) => JSON.parse(m[1]),
    );
    const types = blocks.flatMap((b) => (b["@graph"] ?? [b]).map((n: { "@type": string }) => n["@type"]));
    expect(types).toContain("FAQPage");
    expect(types).toContain("BreadcrumbList");
    expect(types).toContain("ItemList");
  });

  test("unbekannte Kategorie ist ein echtes 404", async ({ request }) => {
    const response = await request.get("/kategorie/gibts-nicht");
    expect(response.status()).toBe(404);
  });

  test("steht in der Sitemap, die alte Parameterform nicht", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    expect(xml).toMatch(/<loc>https:\/\/[^<]+\/kategorie\/papers<\/loc>/);
    expect(xml).not.toContain("?kategorie=");
  });
});

test("Startseite verlinkt die Kategorien mit beschreibendem Linktext", async ({ request }) => {
  const html = await (await request.get("/")).text();
  expect(html).toMatch(/href="\/kategorie\/papers"[^>]*>Papers kaufen</);
  expect(html).toMatch(/href="\/kategorie\/filter-tips"[^>]*>Filter Tips kaufen</);
  expect(html).toContain(`href="/products/${SHOP.papers.handle}"`);
});

test("Von der Kategorie zum Produkt und zurück über den Brotkrümel", async ({ page }) => {
  await page.goto("/kategorie/papers");
  await page.getByRole("link", { name: new RegExp(SHOP.papers.title) }).first().click();
  await expect(page).toHaveURL(new RegExp(`/products/${SHOP.papers.handle}$`));

  const crumbs = page.getByRole("navigation", { name: "Brotkrümelnavigation" });
  await crumbs.getByRole("link", { name: "Papers" }).click();
  await expect(page).toHaveURL(/\/kategorie\/papers$/);
});
