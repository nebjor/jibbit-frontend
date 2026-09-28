import { test, expect, SHOP, LEGAL_PATHS } from "./fixtures";

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
    const response = await request.get("/shop/ocb-premium-kss-7", { maxRedirects: 0 });

    expect(response.status()).toBe(301);
    expect(new URL(response.headers().location).pathname).toBe(
      `/products/${SHOP.papers.handle}`,
    );
  });
});
