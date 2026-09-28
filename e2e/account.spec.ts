import { test, expect, registerAccount, uniqueEmail, TEST_PASSWORD } from "./fixtures";

test("Konto anlegen, abmelden, wieder anmelden", async ({ page }) => {
  const email = uniqueEmail();

  await registerAccount(page, email);

  await expect(page).toHaveURL(/\/konto$/);
  await expect(page.getByRole("heading", { level: 1, name: "Hallo Jana" })).toBeVisible();

  await page.getByRole("button", { name: "Abmelden" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Shop" })).toBeVisible();

  await page.goto("/konto/anmelden");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Anmelden" }).click();

  await expect(page).toHaveURL(/\/konto$/);
  await expect(page.getByRole("heading", { level: 1, name: "Hallo Jana" })).toBeVisible();
});

test("Eine falsche Anmeldung nennt nur eine allgemeine Meldung", async ({ page }) => {
  await page.goto("/konto/anmelden");

  await page.getByLabel("E-Mail").fill(uniqueEmail());
  await page.getByLabel("Passwort", { exact: true }).fill("falsches-passwort");
  await page.getByRole("button", { name: "Anmelden" }).click();

  await expect(
    page.getByText("E-Mail-Adresse oder Passwort stimmen nicht"),
  ).toBeVisible();
});

test("Der Kontobereich ist ohne Anmeldung nicht erreichbar", async ({ page }) => {
  await page.goto("/konto/bestellungen");

  await expect(page).toHaveURL(/\/konto\/anmelden$/);
  await expect(page.getByRole("heading", { level: 1, name: "Anmelden" })).toBeVisible();
});
