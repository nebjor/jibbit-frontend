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

  // Schritt 1 eingeklappt: zwei Kacheln, Kontakt & Adresse und Lieferung.
  const contact = page.getByTestId("tile-contact");
  await expect(contact.getByRole("heading", { name: "Kontakt & Adresse" })).toBeVisible();
  await expect(contact).toContainText(email);
  await expect(contact).toContainText("Jana Muster");
  await expect(contact).toContainText("Unterwegli 1");
  await expect(contact).toContainText("8404 Winterthur");
  await expect(contact.getByRole("button", { name: "Ändern" })).toBeVisible();

  const delivery = page.getByRole("group", { name: "Lieferung" });
  await expect(
    delivery.getByRole("radio", { name: /Versand mit der Schweizerischen Post/ }),
  ).toBeChecked();
  await expect(delivery.getByRole("radio", { name: /Abholung im Laden/ })).not.toBeChecked();
  await expect(delivery).toContainText(chf(SHOP.shippingRate));
  await expect(delivery).toContainText("innerhalb von 1–3 Werktagen");
  await expect(delivery).toContainText("Gratis");

  // Schritt 2 ohne Artikeltabelle: die Übersicht steht nur in der Seitenleiste.
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.getByTestId("free-hint")).toHaveCount(0);

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
  const delivery = page.getByRole("group", { name: "Lieferung" });
  await expect(
    delivery.getByRole("radio", { name: /Versand mit der Schweizerischen Post/ }),
  ).toBeChecked();
  await expect(delivery).toContainText("Gratis");
  await expect(page.getByRole("table")).toHaveCount(0);
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
  await expect(page.getByTestId("tile-contact")).toContainText("Jana Muster");
  await expect(page.getByRole("radio", { name: /Abholung im Laden/ })).toBeChecked();
  await expect(page.getByTestId("tile-delivery")).toContainText("Unterwegli 1");

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

async function fillPaidCartUntilTiles(page: import("@playwright/test").Page, phone?: string) {
  const email = uniqueEmail();
  await registerAccount(page, email);
  await page.goto(`/products/${papers.handle}`);
  await page.getByRole("button", { name: new RegExp(papers.tierLabel) }).click();
  await page.getByRole("button", { name: /In den Warenkorb/ }).click();
  await page
    .getByRole("dialog", { name: "Warenkorb" })
    .getByRole("link", { name: "Zur Kasse" })
    .click();

  await page.getByLabel(/^E-Mail/).fill(email);
  await page.getByLabel(/^Vorname/).fill("Jana");
  await page.getByLabel(/^Nachname/).fill("Muster");
  await page.getByLabel(/^Strasse und Nummer/).fill("Unterwegli 1");
  await page.getByLabel(/^PLZ/).fill("8404");
  await page.getByLabel(/^Ort/).fill("Winterthur");
  if (phone) await page.getByLabel(/^Telefon/).fill(phone);
  await page.getByRole("button", { name: "Weiter" }).click();
  await expect(page.getByRole("heading", { name: "2 · Kaufen" })).toBeVisible();
}

test("Kasse: Lieferart in der eingeklappten Kasse per Radio wechseln, Total im Button folgt", async ({
  page,
}) => {
  await fillPaidCartUntilTiles(page, "076 414 08 90");

  const delivery = page.getByRole("group", { name: "Lieferung" });
  const post = delivery.getByRole("radio", { name: /Versand mit der Schweizerischen Post/ });
  const pickup = delivery.getByRole("radio", { name: /Abholung im Laden/ });
  const buyWithPost = page.getByRole("button", {
    name: new RegExp(`Jetzt kaufen · CHF\\s*${SHOP.checkoutTotal}`),
  });
  await expect(buyWithPost).toBeEnabled();

  // Abholung: ohne «Ändern», Total ohne Porto.
  await pickup.check();
  await expect(pickup).toBeChecked();
  await expect(
    page.getByRole("button", { name: new RegExp(`Jetzt kaufen · CHF\\s*${papers.lineTotal}`) }),
  ).toBeEnabled();
  const summary = page.getByRole("complementary", { name: "Bestellübersicht" });
  await expect(summary).toContainText("Abholung");
  await expect(summary).not.toContainText("Gratisversand");
  // Die Adresse bleibt in der linken Kachel stehen.
  await expect(page.getByTestId("tile-contact")).toContainText("Jana Muster");

  // Zurück zum Versand: Porto wieder im Total.
  await post.check();
  await expect(post).toBeChecked();
  await expect(buyWithPost).toBeEnabled();
  await expect(summary).toContainText(chf(SHOP.shippingRate));

  // Mit der Tastatur: Pfeil nach unten wählt die nächste Lieferart.
  await post.focus();
  await page.keyboard.press("ArrowDown");
  await expect(pickup).toBeChecked();
});

test("Kasse: Abholung ohne Telefon öffnet das Formular statt still zu scheitern", async ({
  page,
}) => {
  await fillPaidCartUntilTiles(page);

  await page.getByRole("radio", { name: /Abholung im Laden/ }).check();

  await expect(page.getByText("Telefonnummer fehlt")).toBeVisible();
  await expect(page.getByRole("radio", { name: /Abholung im Laden/ })).toBeChecked();
  await expect(page.getByLabel(/^Strasse und Nummer/)).toHaveCount(0);
});
