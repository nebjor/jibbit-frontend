import { firstVisit as test, expect } from "./fixtures";

test.describe("Erstbesuch", () => {
  test("Altersabfrage und Cookie-Hinweis lassen sich nacheinander wegklicken", async ({
    page,
  }) => {
    await page.goto("/");

    const ageGate = page.getByRole("dialog", { name: /Bist du 18 oder älter/ });
    await expect(ageGate).toBeVisible();

    await page.getByRole("button", { name: "Ja, ich bin 18 oder älter" }).click();
    await expect(ageGate).toBeHidden();

    const banner = page.getByRole("dialog", { name: "Cookies" });
    await expect(banner).toBeVisible();

    await page.getByRole("button", { name: "Nur notwendige" }).click();
    await expect(banner).toBeHidden();

    await expect(page.getByRole("heading", { level: 1, name: "Shop" })).toBeVisible();
  });

  test("«Nein» sperrt den Shop, statt ihn freizugeben", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Nein, noch nicht" }).click();

    await expect(page.getByRole("dialog", { name: "Bis später" })).toBeVisible();
  });
});
