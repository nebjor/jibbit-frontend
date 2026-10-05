import { test, expect, AGE_COOKIE, CONSENT_COOKIE, consentCookieValue } from "./fixtures";
import { GOOGLE_PROFIL, formatRating, formatReviewCount } from "../lib/trust";

/**
 * Vertrauensleiste (components/TrustBar.tsx) und Google Store Widget
 * (components/GoogleKundenrezensionenBadge.tsx).
 *
 * Die Leiste steht auf jeder Seite über dem Header, fertig im HTML, ohne
 * Client-JS. Geprüft wird, dass die vier Zusagen aus lib/trust.ts sichtbar
 * sind — mobil die ersten zwei direkt, die übrigen per Wischen — und dass
 * die Google-Zahl GENAU die aus GOOGLE_PROFIL ist (die Suite läuft ohne
 * GOOGLE_PLACES_API_KEY, also mit der Konstante) und auf das öffentliche
 * Profil verlinkt, wo jede Kundin sie prüfen kann. Die anderen Zeilen
 * tragen keine Sterne und keine Noten.
 *
 * Das Store Widget ist standardmässig AUS (GOOGLE_KUNDENREZENSIONEN_BADGE in
 * playwright.config.ts nicht gesetzt) und bliebe auf dem Staging-Mandanten
 * test.jibbit.ch ohnehin aus (Domain-Sperre). Geprüft wird NEGATIV: kein
 * Request an gstatic.com, auch mit erteilter Einwilligung.
 */

const BAR = (page: import("@playwright/test").Page) =>
  page.getByRole("list", { name: "Unsere Versprechen" });

const GOOGLE_TEXT = `${formatRating(GOOGLE_PROFIL.rating)} bei Google · ${formatReviewCount(GOOGLE_PROFIL.count)}`;

test("Vertrauensleiste nennt Google-Profil, Versand, Gratisversand und Zahlung", async ({ page }) => {
  await page.goto("/");

  const bar = BAR(page);
  await expect(bar).toBeVisible();
  const items = bar.getByRole("listitem");
  await expect(items).toHaveCount(4);

  await expect(items.nth(0)).toHaveText(GOOGLE_TEXT);
  await expect(items.nth(1)).toHaveText("Versand aus der Schweiz");
  await expect(items.nth(2)).toHaveText(/Gratisversand ab CHF\s69\.00/);
  await expect(items.nth(3)).toHaveText("Sichere Zahlung: TWINT, Karte, PostFinance");

  // Mobil ist die Leiste eine scrollbare Zeile; jeder Eintrag muss
  // erreichbar sein, der letzte durch Wischen.
  await items.nth(3).scrollIntoViewIfNeeded();
  await expect(items.nth(3)).toBeInViewport();
});

test("Google-Zahl verlinkt auf das öffentliche Unternehmensprofil (neuer Tab, noopener)", async ({
  page,
}) => {
  await page.goto("/");

  const link = BAR(page).locator("[data-trust='google'] a");
  await expect(link).toHaveAttribute("href", GOOGLE_PROFIL.url);
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noopener");
  await expect(link).toHaveAttribute("aria-label", /von 5 Sternen bei Google/);
});

test("ausser dem Profil trägt keine Zeile Sterne oder Noten", async ({ page }) => {
  await page.goto("/");

  const others = BAR(page).locator("li:not([data-trust='google'])");
  await expect(others).toHaveCount(3);
  const text = (await others.allTextContents()).join(" ");
  expect(text).not.toMatch(/[★☆⭐]/);
  expect(text).not.toMatch(/\d\s*[.,]\s*\d\s*(\/|von|bei)\s*(5|Google)/);
  expect(text).not.toMatch(/\d+\s*(Sterne|Bewertungen|Rezensionen)/i);
  // Kein aggregateRating in den strukturierten Daten der Seite.
  const jsonld = await page.locator("script[type='application/ld+json']").allTextContents();
  expect(jsonld.join("\n")).not.toMatch(/aggregateRating|ratingValue/);
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
  await expect(BAR(page)).toBeVisible();
  await page.waitForLoadState("networkidle");

  expect(google).toEqual([]);
  expect(await page.locator("script[src*='merchantwidget']").count()).toBe(0);
  expect(await page.evaluate(() => typeof window.merchantwidget)).toBe("undefined");
});
