import { test as base, expect, type BrowserContext, type Page } from "@playwright/test";

/**
 * Shared setup for the suite.
 *
 * Two overlays stand between a visitor and the shop on a first visit: the age
 * gate and the cookie banner, and on the home page a one-off intro animation
 * runs between them. `test` starts past all three — otherwise every spec would
 * pay 4.3 seconds of animation and become timing-sensitive for no gain. The
 * overlays themselves are exercised for real, once, in `consent.spec.ts`.
 */

export const AGE_COOKIE = "jibbit_alterscheck";
export const CONSENT_COOKIE = "jibbit_cookie_consent";
const INTRO_SESSION_KEY = "jibbit-intro-seen";

// `v` muss CONSENT_VERSION in lib/consent/state.ts entsprechen — ein
// veraltetes Cookie gilt als «nie gefragt», und der Hinweis käme wieder.
const CONSENT_VERSION = 2;

export function consentCookieValue(analytics: boolean): string {
  return encodeURIComponent(
    JSON.stringify({ v: CONSENT_VERSION, analytics, ts: "2026-01-01T00:00:00.000Z" }),
  );
}

const CONSENT_VALUE = consentCookieValue(false);

async function skipIntro(context: BrowserContext) {
  await context.addInitScript((key: string) => {
    try {
      window.sessionStorage.setItem(key, "1");
    } catch {
      // A storage that throws already means "no intro" — nothing to do.
    }
  }, INTRO_SESSION_KEY);
}

/** A visitor who has answered both questions before. */
export const test = base.extend<{ context: BrowserContext }>({
  context: async ({ context, baseURL }, provide) => {
    await context.addCookies([
      {
        name: AGE_COOKIE,
        value: "18plus",
        url: baseURL!,
      },
      {
        name: CONSENT_COOKIE,
        value: CONSENT_VALUE,
        url: baseURL!,
      },
    ]);
    await skipIntro(context);
    await provide(context);
  },
});

/** A first-time visitor: no cookies, but no intro animation either. */
export const firstVisit = base.extend<{ context: BrowserContext }>({
  context: async ({ context }, provide) => {
    await skipIntro(context);
    await provide(context);
  },
});

export { expect };

/**
 * What `e2e/mock-backend/catalog.mjs` serves. Kept here so a spec reads the
 * name of a number instead of the number.
 */
export const SHOP = {
  productCount: 4,
  papers: {
    handle: "ocb-premium-kss-papers-mit-filter",
    title: "OCB Premium King Size Slim mit Filter",
    singlePrice: "2.20",
    tierLabel: "24er Display",
    tierPrice: "1.60",
    tierQuantity: 24,
    lineTotal: "38.40",
  },
  ashtray: {
    handle: "raw-kristallglas-aschenbecher-ruby",
    title: "RAW Kristallglas Aschenbecher Ruby",
    price: "27.00",
    compareAt: "29.00",
  },
  shippingRate: "4.50",
  checkoutTotal: "42.90",
} as const;

export const LEGAL_PATHS = [
  "/impressum",
  "/agb",
  "/datenschutz",
  "/widerrufsrecht",
  "/service/kontakt",
  "/service/versand",
  "/service/zahlungsarten",
  "/service/rueckgabe",
  "/service/faq",
];

/** Amounts render as "CHF 38.40" with a locale-specific space — match loosely. */
export function chf(amount: string): RegExp {
  return new RegExp(`CHF\\s*${amount.replace(".", "\\.")}`);
}

/** Every run registers fresh accounts, so no test depends on another's state. */
export function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@jibbit.test`;
}

export const TEST_PASSWORD = "e2e-passwort-2026";

export async function registerAccount(
  page: Page,
  email: string,
  next?: string,
): Promise<void> {
  const query = next ? `?next=${encodeURIComponent(next)}` : "";
  await page.goto(`/konto/registrieren${query}`);
  await page.getByLabel("Vorname (optional)").fill("Jana");
  await page.getByLabel("Nachname (optional)").fill("Muster");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort", { exact: true }).fill(TEST_PASSWORD);
  await page.getByLabel("Passwort wiederholen").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Konto anlegen" }).click();
  // The action answers with a redirect. Returning before it lands would let the
  // caller's own navigation race it, and the session cookie may not be set yet.
  await page.waitForURL((url) => !url.pathname.startsWith("/konto/registrieren"));
}
