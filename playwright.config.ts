import { defineConfig } from "@playwright/test";

/**
 * End-to-end suite.
 *
 * The stack under test is a PRODUCTION build (`next build` + `next start`)
 * talking to `e2e/mock-backend`. Production mode is not incidental: under
 * `NODE_ENV !== "production"` an unreachable backend silently falls back to
 * `lib/mock-catalog.ts` (see lib/data.ts), so a broken data layer would still
 * render a green suite. It also disables the single-tenant dev fallback, which
 * forces the run through `STATIC_TENANTS` — the same path production uses.
 *
 * The tenant's `theme.domain` is `test.jibbit.ch` while its `host` is the
 * loopback address the server actually listens on. That split is what lets the
 * legacy-URL redirects (`lib/seo/legacy-redirects.ts`, gated on a jibbit.ch
 * domain) be exercised without a single request to the real site.
 */

const APP_PORT = Number(process.env.E2E_PORT ?? 3100);
const BACKEND_PORT = Number(process.env.E2E_BACKEND_PORT ?? 9100);

export const BASE_URL = `http://127.0.0.1:${APP_PORT}`;
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;

const STATIC_TENANTS = JSON.stringify([
  {
    id: "e2e",
    host: "127.0.0.1",
    backendUrl: BACKEND_URL,
    publishableKey: "pk_e2e",
    theme: {
      storeName: "jibbit",
      domain: "test.jibbit.ch",
      themeColor: "#F6F5F3",
    },
  },
]);

const appEnv = {
  NODE_ENV: "production",
  HOSTNAME: "127.0.0.1",
  PORT: String(APP_PORT),
  STATIC_TENANTS,
  SITE_INDEXABLE: "true",
  CHECKOUT_REQUIRE_ACCOUNT: "true",
  LOCAL_TENANT_ENABLED: "false",
  POSTHOG_KEY: "",
  // Bewusst GESETZT, obwohl der Mandant test.jibbit.ch heisst: so prüft
  // e2e/bestellung.spec.ts die Domain-Sperre des Google-Opt-ins und nicht
  // bloss eine fehlende Variable.
  GOOGLE_KUNDENREZENSIONEN_MERCHANT_ID: "5618479597",
  // Vertrauenszeile im Shop-Kopf: die Google-Profilbewertung kommt aus dem
  // Mock-Backend (Route /places/v1/places/…), nicht von Google — so wird
  // die Sterne-Darstellung mit Zahl geprüft, ohne Netz und ohne Schlüssel.
  GOOGLE_PLACES_API_KEY: "e2e-key",
  GOOGLE_PLACE_ID: "e2e-place",
  GOOGLE_PLACES_ENDPOINT: `${BACKEND_URL}/places/v1/places/`,
  E2E_BACKEND_PORT: String(BACKEND_PORT),
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  timeout: 60_000,
  // Generous on purpose: every cart and checkout step is a Server Action, and
  // on a loaded CI runner a round trip plus re-render can take several seconds.
  // A tight budget here buys nothing and costs reruns.
  expect: { timeout: 20_000 },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "mobile",
      use: {
        browserName: "chromium",
        viewport: { width: 375, height: 812 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "desktop",
      use: {
        browserName: "chromium",
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  webServer: [
    {
      command: "node e2e/mock-backend/server.mjs",
      url: `${BACKEND_URL}/health`,
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
      env: { E2E_BACKEND_PORT: String(BACKEND_PORT) },
    },
    {
      command: "node e2e/start-app.mjs",
      url: `${BASE_URL}/healthz`,
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
      timeout: 120_000,
      env: appEnv,
    },
  ],
});
