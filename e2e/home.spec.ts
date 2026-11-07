import { test, expect, SHOP, chf } from "./fixtures";

test("Startseite zeigt den Katalog", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "Online Headshop Schweiz" })).toBeVisible();
  await expect(page.getByText(`${SHOP.productCount} Produkte`)).toBeVisible();

  await expect(
    page.getByRole("heading", { level: 3, name: SHOP.papers.title }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 3, name: SHOP.ashtray.title }),
  ).toBeVisible();
});

test("Aktionspreis erscheint mit durchgestrichenem Normalpreis", async ({ page }) => {
  await page.goto("/");

  const card = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { level: 3, name: SHOP.ashtray.title }) });

  await expect(card).toContainText(chf(SHOP.ashtray.price));
  await expect(card.locator("s")).toHaveText(SHOP.ashtray.compareAt);
});

test("Kategorie filtert die Liste", async ({ page }) => {
  await page.goto("/");

  await page
    .getByRole("navigation", { name: "Kategorien" })
    .getByRole("link", { name: "Papers", exact: true })
    .click();

  await expect(page).toHaveURL(/\/kategorie\/papers$/);
  await expect(page.getByRole("heading", { level: 1, name: "Papers kaufen in der Schweiz" })).toBeVisible();
  await expect(page.getByText("1 Produkt", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 3, name: SHOP.ashtray.title }),
  ).toHaveCount(0);
});
