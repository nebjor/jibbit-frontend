import { test, expect } from "./fixtures";

/**
 * Bestand im Shop. Die Fixtures stehen in e2e/mock-backend/catalog.mjs:
 *   - Kailar:  Bestandsführung an, 7 Stück, Stufen ab 1 und ab 10
 *   - PURIZE:  Bestandsführung an, 0 Stück
 * Alle übrigen Produkte führen keinen Bestand (unbegrenzt).
 */
const knapp = { handle: "kailar-filter-5-9mm-65stk-weiss", title: "Kailar Filter 5.9 mm, 65 Stk. weiss" };
const leer = { handle: "purize-xtra-slim-6mm", title: "PURIZE XTRA Slim Aktivkohlefilter 6 mm" };

test("Stufe über dem Bestand ist gesperrt und nennt den Grund", async ({ page }) => {
  await page.goto(`/products/${knapp.handle}`);

  const tiers = page.getByRole("group", { name: "Menge wählen" });
  const zehn = tiers.getByRole("button", { name: /10 Stück/ });
  await expect(zehn).toBeDisabled();
  await expect(zehn).toHaveAttribute("title", "Nur noch 7 Stück verfügbar");
  await expect(zehn).toHaveAccessibleName(/Nur noch 7 Stück verfügbar/);
  await expect(page.getByText("Nur noch 7 verfügbar")).toBeVisible();
});

test("Die Mengeneingabe wird auf den Bestand gekappt", async ({ page }) => {
  await page.goto(`/products/${knapp.handle}`);
  const input = page.getByLabel("Menge", { exact: true });
  const plus = page.getByRole("button", { name: "Menge erhöhen" });

  await input.fill("50");
  await expect(input).toHaveValue("7");
  await expect(plus).toBeDisabled();

  await input.fill("6");
  await expect(plus).toBeEnabled();
  await plus.click();
  await expect(input).toHaveValue("7");
  await expect(plus).toBeDisabled();
});

test("Im Warenkorb endet das «+» beim Bestand", async ({ page }) => {
  await page.goto(`/products/${knapp.handle}`);
  await page.getByLabel("Menge", { exact: true }).fill("50");
  await page.getByRole("button", { name: /In den Warenkorb/ }).click();

  const drawer = page.getByRole("dialog", { name: "Warenkorb" });
  await expect(drawer).toContainText("7 Artikel");
  await expect(
    drawer.getByRole("button", { name: `Menge von ${knapp.title} erhöhen` }),
  ).toBeDisabled();
  await expect(drawer.getByRole("link", { name: "Zur Kasse" })).toBeVisible();
});

test("Ausverkaufte Produkte lassen sich nicht bestellen", async ({ page }) => {
  await page.goto(`/products/${leer.handle}`);
  await expect(page.getByRole("button", { name: "Ausverkauft" })).toBeDisabled();
});
