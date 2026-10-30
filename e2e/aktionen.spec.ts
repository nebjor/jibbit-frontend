import { test, expect, SHOP, chf, registerAccount, uniqueEmail } from "./fixtures";

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

const KATEGORIE = "/?kategorie=papers";

test("Banner zeigt Aktion und Restzeit", async ({ page }) => {
  await page.goto(KATEGORIE);

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
  await page.goto(KATEGORIE);

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
  await page.goto(KATEGORIE);
  const banner = page.getByRole("region", { name: "Aktion" });
  await expect(banner).toBeVisible();

  await banner.getByRole("button", { name: "Aktionshinweis schliessen" }).click();
  await expect(banner).toBeHidden();

  // Neu laden und andere Seite: bleibt weg (sessionStorage).
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Papers" })).toBeVisible();
  await expect(banner).toBeHidden();
  await page.goto(`/products/${SHOP.papers.handle}`);
  await expect(page.getByRole("heading", { level: 1, name: SHOP.papers.title })).toBeVisible();
  await expect(banner).toBeHidden();
});

test("Banner verschwindet von selbst, wenn die Aktion endet", async ({ page }) => {
  await page.clock.install({ time: new Date() });
  await page.goto(KATEGORIE);
  const banner = page.getByRole("region", { name: "Aktion" });
  await expect(banner).toBeVisible();

  await page.clock.fastForward("24:00:00");
  await expect(banner).toBeHidden();
});

test.describe("Hero auf der Startseite", () => {
  test("zeigt die Aktion gross, ohne schmalen Banner", async ({ page }) => {
    await page.goto("/");

    const hero = page.getByTestId("aktions-hero");
    await expect(hero).toBeVisible();
    await expect(hero.getByRole("heading", { level: 2 })).toHaveText(/20 % auf alles/i);
    await expect(hero).toContainText(/Nur bis \d{1,2}\. \w+, \d{2}:\d{2} Uhr/);
    await expect(hero).toContainText("Wird an der Kasse automatisch abgezogen");
    await expect(hero.getByTestId("aktion-restzeit")).toHaveText(/^noch /);
    // Genau eine Region «Aktion»: der schmale Banner fehlt auf der Startseite.
    await expect(page.getByRole("region", { name: "Aktion" })).toHaveCount(1);
    // Der Hero steht über der Überschrift «Shop».
    const heroBox = await hero.boundingBox();
    const h1Box = await page.getByRole("heading", { level: 1, name: "Shop" }).boundingBox();
    expect(heroBox!.y).toBeLessThan(h1Box!.y);
  });

  test("«Jetzt sparen» springt zum Produktraster", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Jetzt sparen" }).click();
    await expect(page).toHaveURL(/#sortiment$/);
    await expect(page.locator("#sortiment")).toBeInViewport();
  });

  test("Kategorieansicht: schmaler Banner, kein Hero", async ({ page }) => {
    await page.goto(KATEGORIE);
    await expect(page.getByRole("region", { name: "Aktion" })).toBeVisible();
    await expect(page.getByTestId("aktions-hero")).toHaveCount(0);
  });

  test("Handy: kein waagrechtes Scrollen, höchstens 40 % der Höhe", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/");
    const hero = page.getByTestId("aktions-hero");
    await expect(hero).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    expect((await hero.boundingBox())!.height).toBeLessThanOrEqual(740 * 0.4 + 1);
  });

  test("verschwindet von selbst, wenn die Aktion endet", async ({ page }) => {
    await page.clock.install({ time: new Date() });
    await page.goto("/");
    const hero = page.getByTestId("aktions-hero");
    await expect(hero).toBeVisible();
    await page.clock.fastForward("24:00:00");
    await expect(hero).toBeHidden();
    // Und der schmale Banner kommt auf der Startseite nicht als Ersatz zurück.
    await expect(page.getByRole("region", { name: "Aktion" })).toHaveCount(0);
  });
});

test.describe("Aktion im älteren Warenkorb", () => {
  // Medusa rechnet Promotionen nur beim Schreiben. Der Mock bildet das nach:
  // ein per /__aktion-veraltet markierter Warenkorb bleibt ohne Rabatt, bis die
  // Storefront ihn nachzieht (Update mit Prüfmarker, lib/cart/aktion-refresh.ts).
  test("Schublade und Kasse ziehen die Aktion nach", async ({ page, request }) => {
    // Die Kasse verlangt ein Konto; die Anmeldung legt noch keinen Warenkorb an.
    await registerAccount(page, uniqueEmail());
    const backend = `http://127.0.0.1:${process.env.E2E_BACKEND_PORT ?? 9100}`;
    await request.post(`${backend}/__aktion-veraltet`);

    await page.goto(`/products/${SHOP.papers.handle}`);
    await page.getByRole("button", { name: new RegExp(SHOP.papers.tierLabel) }).click();
    await page.getByRole("button", { name: /In den Warenkorb/ }).click();

    // Direkt nach dem Hinzufügen: noch der alte Stand ohne Aktion.
    const drawer = page.getByRole("dialog", { name: "Warenkorb" });
    await expect(drawer).toContainText(`${SHOP.papers.tierQuantity} Artikel`);
    await expect(drawer).not.toContainText("Aktionsrabatt");

    // Wer später zurückkommt, sieht die Aktion: 38.40 - 20 % = 30.72, + 4.50 Versand.
    await page.reload();
    await page.getByRole("button", { name: "Warenkorb öffnen" }).click();
    await expect(drawer).toContainText("Aktionsrabatt");
    await expect(drawer).toContainText(chf("7.68"));
    await expect(drawer).toContainText(chf("30.72"));
    await expect(drawer).toContainText(chf("35.22"));

    // Die Kasse zeigt dieselbe Summe.
    await drawer.getByRole("link", { name: "Zur Kasse" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Kasse" })).toBeVisible();
    await expect(page.getByText("Aktionsrabatt (bereits abgezogen)")).toBeVisible();
    await expect(page.getByText(chf("30.72")).first()).toBeVisible();
  });
});
