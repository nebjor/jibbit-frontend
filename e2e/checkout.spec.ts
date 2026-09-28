import { test, expect, SHOP, chf, registerAccount, uniqueEmail } from "./fixtures";

const { papers } = SHOP;

test("Kasse: Adresse erfassen, Versand wird automatisch gewählt, Summe stimmt", async ({
  page,
}) => {
  const email = uniqueEmail();
  await registerAccount(page, email);
  await expect(page).toHaveURL(/\/konto$/);

  await page.goto(`/products/${papers.handle}`);
  await page.getByRole("button", { name: new RegExp(papers.tierLabel) }).click();
  await page.getByRole("button", { name: /In den Warenkorb/ }).click();

  const drawer = page.getByRole("dialog", { name: "Warenkorb" });
  await expect(drawer).toContainText(chf(papers.lineTotal));
  await drawer.getByRole("link", { name: "Zur Kasse" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Kasse" })).toBeVisible();

  await page.getByLabel(/^E-Mail/).fill(email);
  await page.getByLabel(/^Vorname/).fill("Jana");
  await page.getByLabel(/^Nachname/).fill("Muster");
  await page.getByLabel(/^Strasse und Nummer/).fill("Unterwegli 1");
  await page.getByLabel(/^PLZ/).fill("8404");
  await page.getByLabel(/^Ort/).fill("Winterthur");
  await page.getByRole("button", { name: "Weiter" }).click();

  await expect(page.getByRole("heading", { name: "2 · Kaufen" })).toBeVisible();

  const summary = page.getByRole("complementary", { name: "Bestellübersicht" });
  await expect(summary).toContainText(`${papers.title}`);
  await expect(summary).toContainText(`× ${papers.tierQuantity}`);
  await expect(summary).toContainText(chf(papers.lineTotal));
  await expect(summary).toContainText(chf(SHOP.shippingRate));
  await expect(summary).toContainText(chf(SHOP.checkoutTotal));
  await expect(summary).not.toContainText("(geschätzt)");

  await expect(
    page.getByRole("button", { name: new RegExp(`Jetzt kaufen · CHF\\s*${SHOP.checkoutTotal}`) }),
  ).toBeEnabled();
});

test("Die Kasse verlangt ein Konto", async ({ page }) => {
  await page.goto(`/products/${SHOP.ashtray.handle}`);
  await page.getByRole("button", { name: /In den Warenkorb/ }).click();
  await expect(page.getByRole("dialog", { name: "Warenkorb" })).toContainText(
    chf(SHOP.ashtray.price),
  );

  await page.goto("/checkout");

  await expect(page).toHaveURL(/\/konto\/anmelden\?next=%2Fcheckout$/);
  await expect(page.getByText("Zum Bestellen brauchst du ein Konto")).toBeVisible();
});

test("Eine unvollständige Adresse kommt nicht durch", async ({ page }) => {
  await registerAccount(page, uniqueEmail());

  await page.goto(`/products/${SHOP.ashtray.handle}`);
  await page.getByRole("button", { name: /In den Warenkorb/ }).click();
  await page.getByRole("dialog", { name: "Warenkorb" }).getByRole("link", { name: "Zur Kasse" }).click();

  await page.getByLabel(/^E-Mail/).fill("keine-adresse");
  await page.getByRole("button", { name: "Weiter" }).click();

  await expect(page.getByText("Diese E-Mail-Adresse sieht nicht gültig aus.")).toBeVisible();
  await expect(page.getByText("Vorname fehlt.")).toBeVisible();
});
