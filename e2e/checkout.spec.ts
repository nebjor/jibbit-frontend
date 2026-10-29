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

  // Schritt 1 eingeklappt: Lieferart und Kosten, nicht nur die Adresse.
  const shippingLine = page.getByTestId("shipping-summary");
  await expect(shippingLine).toContainText("Versand mit der Schweizerischen Post");
  await expect(shippingLine).toContainText(chf(SHOP.shippingRate));
  await expect(shippingLine).toContainText("innerhalb von 1–3 Werktagen");
  await expect(shippingLine).not.toContainText("(geschätzt)");

  // Schritt 2: Zusammenfassung mit Medusas Zahlen — Total = Button.
  const review = page.getByTestId("review-summary");
  await expect(review.getByRole("rowheader", { name: papers.title })).toBeVisible();
  await expect(review).toContainText(`${papers.tierQuantity} × `);
  await expect(review.getByRole("row", { name: /^Zwischensumme/ })).toContainText(
    chf(papers.lineTotal),
  );
  await expect(review.getByRole("row", { name: /^Versand mit der Schweizerischen Post/ })).toContainText(
    chf(SHOP.shippingRate),
  );
  await expect(review.getByRole("row", { name: /^Total/ })).toContainText(chf(SHOP.checkoutTotal));
  await expect(page.getByTestId("free-hint")).toHaveText(/^Noch\sCHF\s\S+\sbis Gratisversand$/);

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

test("Kasse: ab CHF 69 steht «Gratis» in der Lieferart und in der Zusammenfassung", async ({
  page,
}) => {
  const email = uniqueEmail();
  await registerAccount(page, email);

  // 38.40 + 2 × 27.00 = 92.40, über der Schwelle.
  await page.goto(`/products/${papers.handle}`);
  await page.getByRole("button", { name: new RegExp(papers.tierLabel) }).click();
  await page.getByRole("button", { name: /In den Warenkorb/ }).click();
  await page.goto(`/products/${SHOP.ashtray.handle}`);
  await page.getByRole("button", { name: /In den Warenkorb/ }).click();
  const drawer = page.getByRole("dialog", { name: "Warenkorb" });
  await expect(drawer).toContainText(SHOP.ashtray.title);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /In den Warenkorb/ }).click();
  await expect(drawer).toContainText("92.40");
  await drawer.getByRole("link", { name: "Zur Kasse" }).click();

  await page.getByLabel(/^E-Mail/).fill(email);
  await page.getByLabel(/^Vorname/).fill("Jana");
  await page.getByLabel(/^Nachname/).fill("Muster");
  await page.getByLabel(/^Strasse und Nummer/).fill("Unterwegli 1");
  await page.getByLabel(/^PLZ/).fill("8404");
  await page.getByLabel(/^Ort/).fill("Winterthur");
  await page.getByRole("button", { name: "Weiter" }).click();

  await expect(page.getByRole("heading", { name: "2 · Kaufen" })).toBeVisible();
  const shippingLine = page.getByTestId("shipping-summary");
  await expect(shippingLine).toContainText("Versand mit der Schweizerischen Post");
  await expect(shippingLine).toContainText("Gratis");

  const review = page.getByTestId("review-summary");
  await expect(review.getByRole("row", { name: /^Versand mit der Schweizerischen Post/ })).toContainText(
    "Gratis",
  );
  await expect(review.getByRole("row", { name: /^Total/ })).toContainText(chf("92.40"));
  await expect(page.getByTestId("free-hint")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Jetzt kaufen · CHF\s*92\.40/ }),
  ).toBeEnabled();
});

test("Kasse: Abholung im Laden — nur Name und Telefon, CHF 0.00, kein Gratisversand-Hinweis", async ({
  page,
}) => {
  const email = uniqueEmail();
  await registerAccount(page, email);

  await page.goto(`/products/${papers.handle}`);
  await page.getByRole("button", { name: new RegExp(papers.tierLabel) }).click();
  await page.getByRole("button", { name: /In den Warenkorb/ }).click();
  const drawer = page.getByRole("dialog", { name: "Warenkorb" });
  // Vor der Wahl: Lieferung ist die Vorgabe, der Hinweis steht.
  await expect(drawer).toContainText("bis Gratisversand");
  await drawer.getByRole("link", { name: "Zur Kasse" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Kasse" })).toBeVisible();
  const summary = page.getByRole("complementary", { name: "Bestellübersicht" });
  await expect(summary).toContainText("Versand");

  await page.getByRole("radio", { name: /Abholung im Laden/ }).check();

  // Die Adressfelder sind weg, der Abholort steht da.
  await expect(page.getByLabel(/^Strasse und Nummer/)).toHaveCount(0);
  await expect(page.getByLabel(/^PLZ/)).toHaveCount(0);
  await expect(page.getByTestId("pickup-address")).toContainText("Unterwegli 1");
  await expect(page.getByTestId("pickup-address")).toContainText("8404 Winterthur");
  await expect(page.getByTestId("pickup-address")).toContainText("Mo–Sa 09:00–17:00");

  // Ohne Telefon geht es nicht weiter.
  await page.getByLabel(/^E-Mail/).fill(email);
  await page.getByLabel(/^Vorname/).fill("Jana");
  await page.getByLabel(/^Nachname/).fill("Muster");
  await page.getByRole("button", { name: "Weiter" }).click();
  await expect(page.getByText("Telefonnummer fehlt")).toBeVisible();

  await page.getByLabel(/^Telefon/).fill("076 414 08 90");
  await page.getByRole("button", { name: "Weiter" }).click();

  await expect(page.getByRole("heading", { name: "2 · Kaufen" })).toBeVisible();
  await expect(page.getByTestId("pickup-summary")).toContainText("Abholung im Laden");
  await expect(page.getByTestId("pickup-summary")).toContainText("Unterwegli 1");

  await expect(summary).toContainText("Abholung");
  await expect(summary).toContainText(chf("0.00"));
  await expect(summary).not.toContainText("Versand");
  await expect(summary).not.toContainText("Gratisversand");
  await expect(summary).not.toContainText("(geschätzt)");
  // Total = Warenwert, kein Porto.
  await expect(
    page.getByRole("button", { name: new RegExp(`Jetzt kaufen · CHF\\s*${papers.lineTotal}`) }),
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
