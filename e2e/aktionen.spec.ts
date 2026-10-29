import { test, expect, SHOP } from "./fixtures";

/**
 * Aktionsbanner. Der Mock-Server (e2e/mock-backend) meldet auf
 * `/store/aktionen` immer eine laufende 20-%-Aktion, die in 23 h 12 min
 * endet — die Seite ist also in jedem Test «mitten in der Aktion».
 *
 * «Server meldet nichts / abgelaufen → kein Banner» ist in den Unit-Tests
 * (lib/aktionen.test.ts, lib/data.test.ts) abgedeckt; der Next-Datencache
 * (60 s) verhindert, den Mock zwischen zwei E2E-Tests umzuschalten. Das
 * SELBST-Ausblenden am Ende der Aktion läuft dagegen im Browser und wird
 * hier mit vorgestellter Uhr geprüft.
 */

test("Banner zeigt Aktion und Restzeit", async ({ page }) => {
  await page.goto("/");

  const banner = page.getByRole("region", { name: "Aktion" });
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("20 % auf alles");
  await expect(banner).toContainText("Wird an der Kasse automatisch abgezogen");
  // Die gecachte Antwort ist bis zu einer Minute alt, die Mock-Aktion endet in 23 h 12 min.
  await expect(page.getByTestId("aktion-restzeit")).toHaveText(/^noch (23|22) h \d+ min$/);
});

test("Banner steht auch auf Produktseite, dazu der Hinweis unter dem Kaufblock", async ({ page }) => {
  await page.goto(`/products/${SHOP.papers.handle}`);

  await expect(page.getByRole("region", { name: "Aktion" })).toContainText("20 % auf alles");
  await expect(page.getByTestId("aktions-hinweis")).toHaveText(
    "20 % Aktionsrabatt wird an der Kasse abgezogen",
  );
});

test("Banner passt auf dem Handy in zwei Zeilen, ohne waagrechtes Scrollen", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/");

  const banner = page.getByRole("region", { name: "Aktion" });
  await expect(banner).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  const lines = await banner.locator("p").count();
  expect(lines).toBe(2);
});

test("Wegklicken blendet den Banner für die Sitzung aus", async ({ page }) => {
  await page.goto("/");
  const banner = page.getByRole("region", { name: "Aktion" });
  await expect(banner).toBeVisible();

  await banner.getByRole("button", { name: "Aktionshinweis schliessen" }).click();
  await expect(banner).toBeHidden();

  // Neu laden und andere Seite: bleibt weg (sessionStorage).
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Shop" })).toBeVisible();
  await expect(banner).toBeHidden();
  await page.goto(`/products/${SHOP.papers.handle}`);
  await expect(page.getByRole("heading", { level: 1, name: SHOP.papers.title })).toBeVisible();
  await expect(banner).toBeHidden();
});

test("Banner verschwindet von selbst, wenn die Aktion endet", async ({ page }) => {
  await page.clock.install({ time: new Date() });
  await page.goto("/");
  const banner = page.getByRole("region", { name: "Aktion" });
  await expect(banner).toBeVisible();

  await page.clock.fastForward("24:00:00");
  await expect(banner).toBeHidden();
});
