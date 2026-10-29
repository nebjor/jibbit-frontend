import { test, expect, SHOP, chf } from "./fixtures";

const { papers } = SHOP;

test("Hinzufügen öffnet die Schublade mit der Summe der gewählten Stufe", async ({
  page,
}) => {
  await page.goto(`/products/${papers.handle}`);
  await page.getByRole("button", { name: new RegExp(papers.tierLabel) }).click();
  await page.getByRole("button", { name: /In den Warenkorb/ }).click();

  const drawer = page.getByRole("dialog", { name: "Warenkorb" });
  await expect(drawer).toBeVisible();
  await expect(drawer).toContainText(`${papers.tierQuantity} Artikel`);
  await expect(drawer).toContainText(chf(papers.lineTotal));
  await expect(drawer).toContainText(chf(SHOP.shippingRate));
  await expect(drawer).toContainText(chf(SHOP.checkoutTotal));
});

test("Die Mengenknöpfe ändern um 1 und rechnen neu", async ({ page }) => {
  await page.goto(`/products/${papers.handle}`);
  await page.getByRole("button", { name: new RegExp(papers.tierLabel) }).click();
  await page.getByRole("button", { name: /In den Warenkorb/ }).click();
  await expect(page.getByRole("dialog", { name: "Warenkorb" })).toContainText(
    `${papers.tierQuantity} Artikel`,
  );

  // Neu laden und die Schublade von Hand öffnen: so sieht sie jemand, der
  // später zurückkommt — und der Warenkorb steht dabei nachweislich still,
  // statt noch an der letzten Änderung zu arbeiten.
  await page.reload();
  await page.getByRole("button", { name: "Warenkorb öffnen" }).click();

  const drawer = page.getByRole("dialog", { name: "Warenkorb" });
  const more = drawer.getByRole("button", { name: `Menge von ${papers.title} erhöhen` });
  const less = drawer.getByRole("button", {
    name: `Menge von ${papers.title} verringern`,
  });

  // "+" erhöht um 1 (nicht um die Stufe), "−" senkt um 1 — die Zeile bleibt.
  await more.click();
  await expect(drawer).toContainText(`${papers.tierQuantity + 1} Artikel`);
  await expect(less).toBeEnabled();
  await less.click();
  await expect(drawer).toContainText(`${papers.tierQuantity} Artikel`);
  await expect(drawer).toContainText(chf(papers.lineTotal));

  // Unter die Stufe: 24 -> 23 verlässt den Stufenpreis, die Zeile bleibt.
  await less.click();
  await expect(drawer).toContainText(`${papers.tierQuantity - 1} Artikel`);
  await expect(drawer).toContainText(chf("44.85")); // 23 x 1.95 (Stufe ab 10)
});

test("Öffnen und Schliessen verschieben den Seiteninhalt nicht", async ({ page }) => {
  await page.goto("/");
  const logo = page.getByRole("link", { name: "jibbit — Startseite" });
  const before = await logo.boundingBox();

  await page.getByRole("button", { name: "Warenkorb öffnen" }).click();
  const drawer = page.getByRole("dialog", { name: "Warenkorb" });
  await expect(drawer).toBeVisible();
  // Die Scrollleiste ist weg, ihr Platz aber ausgeglichen: der Inhalt steht.
  expect(await logo.boundingBox()).toEqual(before);
  const lock = await page.evaluate(() => ({
    overflow: document.body.style.overflow,
    gap: window.innerWidth - document.documentElement.clientWidth,
    padding: document.body.style.paddingRight,
  }));
  expect(lock.overflow).toBe("hidden");
  expect(lock.gap).toBe(0);

  // Schliessen: die Schublade bleibt für die Austritts-Animation kurz im DOM
  // (data-state=closed, inert) und verschwindet dann ganz.
  await page.getByRole("button", { name: "Schliessen", exact: true }).click();
  await expect(page.locator('[data-state="closed"][inert]')).toHaveCount(1);
  await expect(drawer).toHaveCount(0);
  expect(await logo.boundingBox()).toEqual(before);
  expect(
    await page.evaluate(() => [
      document.body.style.overflow,
      document.body.style.paddingRight,
    ]),
  ).toEqual(["", ""]);
});

test("Ein leerer Warenkorb sagt es und verlinkt zurück in den Shop", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Warenkorb öffnen" }).click();

  const drawer = page.getByRole("dialog", { name: "Warenkorb" });
  await expect(drawer).toContainText("Noch nix drin.");
  await expect(drawer.getByRole("link", { name: "Zum Shop" })).toBeVisible();
});
