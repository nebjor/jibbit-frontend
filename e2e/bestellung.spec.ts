import { test, expect, AGE_COOKIE, CONSENT_COOKIE, SHOP, consentCookieValue } from "./fixtures";
import type { APIRequestContext, Page } from "@playwright/test";

/**
 * Bestellbestätigung (/checkout/bestellung/[id]).
 *
 * Die Zahlung läuft im echten Shop über die zahls.ch-Bezahlseite — die kann
 * der Mock nicht nachspielen. Die Bestellung entsteht deshalb direkt über die
 * Store-API des Mock-Backends (Cart anlegen, Artikel, Adresse, abschliessen),
 * und der Browser öffnet nur die Bestätigung — genau so, wie eine Kundin sie
 * später aus der Mail wieder öffnet.
 *
 * GOOGLE KUNDENREZENSIONEN: Das Opt-in-Modul darf nur auf jibbit.ch laden.
 * Der E2E-Mandant heisst test.jibbit.ch (playwright.config.ts) und bekommt
 * die Merchant-ID ausdrücklich gesetzt — fiele die Domain-Prüfung weg, würde
 * hier also Googles Skript angefragt. Geprüft wird darum NEGATIV: kein
 * Request an apis.google.com, kein `renderOptIn`, selbst MIT erteilter
 * Analyse-Einwilligung.
 */

const BACKEND_URL = `http://127.0.0.1:${process.env.E2E_BACKEND_PORT ?? 9100}`;

async function placeOrder(request: APIRequestContext): Promise<string> {
  const headers = { "x-publishable-api-key": "pk_e2e" };
  const { cart } = await (await request.post(`${BACKEND_URL}/store/carts`, { headers })).json();

  await request.post(`${BACKEND_URL}/store/carts/${cart.id}/line-items`, {
    headers,
    data: { variant_id: "var_raw_ruby", quantity: 1 },
  });
  await request.post(`${BACKEND_URL}/store/carts/${cart.id}`, {
    headers,
    data: {
      email: "kundin@example.ch",
      shipping_address: {
        first_name: "Jana",
        last_name: "Muster",
        address_1: "Musterweg 1",
        postal_code: "8001",
        city: "Zürich",
        country_code: "ch",
      },
    },
  });

  const completed = await (
    await request.post(`${BACKEND_URL}/store/carts/${cart.id}/complete`, { headers })
  ).json();
  expect(completed.type).toBe("order");
  return completed.order.id as string;
}

/** Sammelt jede Anfrage an Google, solange die Seite lebt. */
function watchGoogleRequests(page: Page): string[] {
  const seen: string[] = [];
  page.on("request", (req) => {
    if (/google\.com|gstatic\.com|googleapis\.com/.test(req.url())) seen.push(req.url());
  });
  return seen;
}

test("zeigt Bestellnummer, Artikel und Adresse", async ({ page, request }) => {
  const orderId = await placeOrder(request);

  await page.goto(`/checkout/bestellung/${orderId}`);

  await expect(
    page.getByRole("heading", { level: 1, name: "Danke — das ist bestellt." }),
  ).toBeVisible();
  await expect(page.getByText("kundin@example.ch")).toBeVisible();
  await expect(page.getByText(SHOP.ashtray.title)).toBeVisible();
  await expect(page.getByText("8001 Zürich")).toBeVisible();
});

test("lädt Googles Opt-in-Modul NICHT auf dem Staging-Mandanten — auch mit Einwilligung", async ({
  page,
  context,
  request,
  baseURL,
}) => {
  // Einwilligung erteilt: der einzige Wächter, der hier noch greift, ist die
  // Domain-Prüfung (test.jibbit.ch !== jibbit.ch).
  await context.addCookies([
    { name: AGE_COOKIE, value: "18plus", url: baseURL! },
    { name: CONSENT_COOKIE, value: consentCookieValue(true), url: baseURL! },
  ]);
  const orderId = await placeOrder(request);
  const google = watchGoogleRequests(page);

  await page.goto(`/checkout/bestellung/${orderId}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Danke — das ist bestellt." }),
  ).toBeVisible();
  // Das Skript käme per next/script NACH der Hydration — kurz warten, damit
  // ein Fehlalarm «grün» nicht nur am Timing hängt.
  await page.waitForLoadState("networkidle");

  expect(google).toEqual([]);
  expect(await page.locator("script[src*='apis.google.com']").count()).toBe(0);
  expect(await page.evaluate(() => typeof window.renderOptIn)).toBe("undefined");
});

test("lädt ohne Einwilligung keine Drittskripte", async ({ page, request }) => {
  // Standard-Fixture: Einwilligung «nur notwendige».
  const orderId = await placeOrder(request);
  const google = watchGoogleRequests(page);

  await page.goto(`/checkout/bestellung/${orderId}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Danke — das ist bestellt." }),
  ).toBeVisible();
  await page.waitForLoadState("networkidle");

  expect(google).toEqual([]);
  expect(await page.locator("script[src*='apis.google.com']").count()).toBe(0);
});
