import { test, expect, AGE_COOKIE, CONSENT_COOKIE, consentCookieValue } from "./fixtures";
import { GOOGLE_PROFIL } from "../lib/trust";

/**
 * Vertrauenszeile im Shop-Kopf (components/ShopTrust.tsx) und Google Store
 * Widget (components/GoogleKundenrezensionenBadge.tsx).
 *
 * Die Zeile steht unter Titel/Beschreibung des Katalogs (Startseite,
 * Kategorien) und der Suche, fertig im HTML, ohne Client-JS. Die Google-Zahl
 * kommt in dieser Suite aus dem Mock-Backend (playwright.config.ts:
 * GOOGLE_PLACES_ENDPOINT → e2e/mock-backend, Fixture 4.8 / 27) — geprüft
 * wird also die echte Darstellung mit Sternen und Zahl, der Link aufs
 * öffentliche Profil, die drei Fakten daneben und dass der Promo-Streifen im
 * Header unverändert steht. Keine Google-Requests aus dem Browser: der
 * Abruf ist serverseitig.
 *
 * Das Store Widget ist standardmässig AUS (GOOGLE_KUNDENREZENSIONEN_BADGE in
 * playwright.config.ts nicht gesetzt) und bliebe auf dem Staging-Mandanten
 * test.jibbit.ch ohnehin aus (Domain-Sperre). Geprüft wird NEGATIV: kein
 * Request an gstatic.com, auch mit erteilter Einwilligung.
 */

const FIXTURE_TEXT = "4.8 bei Google · 27 Bewertungen";

test("Shop-Kopf: Sterne, Zahl und Link aufs Google-Profil — unter dem Titel", async ({ page }) => {
  await page.goto("/");

  const head = page.locator("header").filter({ has: page.getByRole("heading", { level: 1, name: "Online Headshop Schweiz" }) });
  const google = head.locator("[data-trust='google']");
  await expect(google).toBeVisible();
  await expect(google).toHaveText(FIXTURE_TEXT);
  await expect(google).toHaveAttribute("href", GOOGLE_PROFIL.url);
  await expect(google).toHaveAttribute("target", "_blank");
  await expect(google).toHaveAttribute("rel", "noopener");
  await expect(google).toHaveAttribute("aria-label", /4\.8 von 5 Sternen bei Google, 27 Bewertungen/);

  // Fünf Umriss-Sterne, Füllschicht auf 96 % (4.8 / 5).
  await expect(google.locator("svg")).toHaveCount(10);
  await expect(google.locator("span[style]")).toHaveAttribute("style", /width:\s*96%/);
  await expect(head.locator("[data-trust-source]")).toHaveAttribute("data-trust-source", "places");
});

test("Shop-Kopf: die drei Fakten daneben, intern verlinkt", async ({ page }) => {
  await page.goto("/");

  const facts = page.getByRole("list", { name: "Unsere Versprechen" }).getByRole("listitem");
  await expect(facts).toHaveCount(3);
  await expect(facts.nth(0)).toHaveText("Versand aus der Schweiz");
  await expect(facts.nth(1)).toHaveText(/Gratisversand ab CHF\s69\.00/);
  await expect(facts.nth(2)).toHaveText("Sichere Zahlung");
  await expect(facts.nth(2).getByRole("link")).toHaveAttribute("href", "/service/zahlungsarten");
  for (let i = 0; i < 3; i++) await expect(facts.nth(i)).toBeVisible();

  const text = (await facts.allTextContents()).join(" ");
  expect(text).not.toMatch(/[★☆⭐]/);
  expect(text).not.toMatch(/\d+\s*(Sterne|Bewertungen|Rezensionen)/i);
});

test("auch auf Kategorieseite und Suche; Promo-Streifen im Header bleibt", async ({ page }) => {
  await page.goto("/kategorie/papers");
  await expect(page.getByRole("heading", { level: 1, name: "Papers kaufen in der Schweiz" })).toBeVisible();
  await expect(page.locator("[data-trust='google']")).toHaveText(FIXTURE_TEXT);

  await page.goto("/suche?q=papers");
  await expect(page.locator("[data-trust='google']")).toHaveText(FIXTURE_TEXT);

  // Der dunkle Promo-Streifen über der Kopfleiste steht wie auf main.
  await expect(page.getByText("Dauertiefpreise", { exact: false }).first()).toBeVisible();
  await expect(page.locator("body")).toContainText(/Gratisversand ab CHF\s69\.00/);
});

test("kein aggregateRating in den strukturierten Daten, keine Google-Requests aus dem Browser", async ({
  page,
}) => {
  const google: string[] = [];
  page.on("request", (req) => {
    if (/google\.com|gstatic\.com|googleapis\.com/.test(req.url())) google.push(req.url());
  });
  await page.goto("/");
  await expect(page.locator("[data-trust='google']")).toBeVisible();
  await page.waitForLoadState("networkidle");

  const jsonld = await page.locator("script[type='application/ld+json']").allTextContents();
  expect(jsonld.join("\n")).not.toMatch(/aggregateRating|ratingValue/);
  expect(google).toEqual([]);
});

test("Store Widget: ohne Schalter kein Google — auch mit Einwilligung", async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([
    { name: AGE_COOKIE, value: "18plus", url: baseURL! },
    { name: CONSENT_COOKIE, value: consentCookieValue(true), url: baseURL! },
  ]);
  const google: string[] = [];
  page.on("request", (req) => {
    if (/google\.com|gstatic\.com|googleapis\.com/.test(req.url())) google.push(req.url());
  });

  await page.goto("/");
  await expect(page.locator("[data-trust='google']")).toBeVisible();
  await page.waitForLoadState("networkidle");

  expect(google).toEqual([]);
  expect(await page.locator("script[src*='merchantwidget']").count()).toBe(0);
  expect(await page.evaluate(() => typeof window.merchantwidget)).toBe("undefined");
});
