import { test, expect, SHOP, chf } from "./fixtures";

const { papers } = SHOP;

test("Produktseite zeigt Preis, Stufen und Bild", async ({ page }) => {
  await page.goto(`/products/${papers.handle}`);

  await expect(page.getByRole("heading", { level: 1, name: papers.title })).toBeVisible();
  await expect(page.getByAltText(papers.title, { exact: true }).first()).toBeVisible();

  const tiers = page.getByRole("group", { name: "Menge wählen" });
  await expect(tiers.getByRole("button")).toHaveCount(3);
  await expect(tiers).toContainText(papers.tierLabel);

  await expect(
    page.getByRole("button", { name: /In den Warenkorb/ }),
  ).toContainText(chf(papers.singlePrice));
});

test("Eine Preisstufe zu wählen ändert Preis, Menge und Foto", async ({ page }) => {
  await page.goto(`/products/${papers.handle}`);

  const tierPhoto = page.getByAltText(`${papers.title} — Ansicht 2`).first();
  await expect(tierPhoto).toBeHidden();

  await page.getByRole("button", { name: new RegExp(papers.tierLabel) }).click();

  await expect(page.locator("output")).toHaveText(String(papers.tierQuantity));
  await expect(page.getByRole("button", { name: /In den Warenkorb/ })).toContainText(
    chf(papers.lineTotal),
  );
  await expect(tierPhoto).toBeVisible();
});

test("Ein Produkt ohne Mengenrabatt zeigt keine Stufenwahl", async ({ page }) => {
  await page.goto(`/products/${SHOP.ashtray.handle}`);

  await expect(
    page.getByRole("heading", { level: 1, name: SHOP.ashtray.title }),
  ).toBeVisible();
  await expect(page.getByRole("group", { name: "Menge wählen" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Mengenrabatt" })).toHaveCount(0);
});
