import { test, expect } from "./fixtures";

/**
 * «Nicht gefunden, was du suchst?» am Ende der Produktlisten.
 * Das Mock-Backend nimmt den Wunsch wie die echte Route an (204) und gibt ihn
 * über /e2e/produktwunsch zurück.
 */

const BACKEND = `http://127.0.0.1:${process.env.E2E_BACKEND_PORT ?? 9100}`;

type Wunsch = { wunsch: string; email?: string; kontext: Record<string, string> };

async function empfangen(request: import("@playwright/test").APIRequestContext) {
  const res = await request.get(`${BACKEND}/e2e/produktwunsch`);
  return ((await res.json()) as { wuensche: Wunsch[] }).wuensche;
}

const box = (page: import("@playwright/test").Page) =>
  page.getByRole("region", { name: "Nicht gefunden, was du suchst?" });

test.beforeEach(async ({ page }) => {
  // Die Minutenbremse liegt in localStorage; jeder Test beginnt frisch.
  await page.addInitScript(() => {
    try {
      window.localStorage.removeItem("jibbit-produktwunsch-zeit");
    } catch {
      // ohne Speicher nichts zu tun
    }
  });
});

test("Kasten steht am Ende der Kategorieansicht, nach dem Raster", async ({ page }) => {
  await page.goto("/kategorie/papers");

  const b = box(page);
  await expect(b).toBeVisible();
  await expect(
    b.getByText("Sag uns, welches Produkt dir fehlt – wir schauen, ob wir es ins Sortiment nehmen."),
  ).toBeVisible();
  await expect(b.getByLabel("Produktwunsch")).toBeVisible();
  await expect(b.getByLabel(/E-Mail/)).toBeVisible();
  await expect(b.getByRole("button", { name: "Wunsch senden" })).toBeVisible();

  // Nach dem letzten Produkt (Reihenfolge im Dokument).
  const nachProdukt = await page.evaluate(() => {
    const cards = [...document.querySelectorAll("article")];
    const kasten = document.querySelector('section[aria-labelledby="produktwunsch-titel"]');
    const last = cards[cards.length - 1];
    return Boolean(
      last && kasten && last.compareDocumentPosition(kasten) & Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
  expect(nachProdukt).toBe(true);
});

test("Kasten steht auch am Ende der Suchergebnisse und bei null Treffern", async ({ page }) => {
  await page.goto("/suche?q=papers");
  await expect(box(page)).toBeVisible();

  await page.goto("/suche?q=zzzzqqqq");
  await expect(page.getByRole("heading", { name: "Keine Treffer" })).toBeVisible();
  await expect(box(page)).toBeVisible();
});

test("Wunsch senden: Erfolgsmeldung, Kontext kommt im Backend an", async ({ page, request }) => {
  await page.goto("/kategorie/papers");
  const b = box(page);

  await b.getByLabel("Produktwunsch").fill("Hanfblättchen King Size");
  await b.getByLabel(/E-Mail/).fill("kunde@example.ch");
  await b.getByRole("button", { name: "Wunsch senden" }).click();

  await expect(b.getByText("Danke! Wir melden uns, falls wir es aufnehmen.")).toBeVisible();
  await expect(b.getByLabel("Produktwunsch")).toHaveValue("");

  const alle = await empfangen(request);
  const mein = alle.find((w) => w.wunsch === "Hanfblättchen King Size");
  expect(mein).toBeTruthy();
  expect(mein?.email).toBe("kunde@example.ch");
  expect(mein?.kontext.kategorie).toBe("Papers");
  expect(mein?.kontext.url).toContain("/kategorie/papers");
});

test("Wunsch aus der Suche trägt den Suchbegriff", async ({ page, request }) => {
  await page.goto("/suche?q=drehmaschine");
  const b = box(page);
  await b.getByLabel("Produktwunsch").fill("Drehmaschine aus Metall");
  await b.getByRole("button", { name: "Wunsch senden" }).click();
  await expect(b.getByText("Danke! Wir melden uns, falls wir es aufnehmen.")).toBeVisible();

  const mein = (await empfangen(request)).find((w) => w.wunsch === "Drehmaschine aus Metall");
  expect(mein?.kontext.suche).toBe("drehmaschine");
  expect(mein?.email).toBeUndefined();
});

test("Leerer Wunsch wird abgewiesen und nicht gesendet", async ({ page, request }) => {
  // Eindeutige Adresse als Marke: die Projekte laufen parallel gegen dasselbe Mock-Backend.
  const marke = `leer-${Date.now()}@example.ch`;
  await page.goto("/kategorie/papers");
  const b = box(page);

  await b.getByLabel("Produktwunsch").fill("   ");
  await b.getByLabel(/E-Mail/).fill(marke);
  await b.getByRole("button", { name: "Wunsch senden" }).click();

  await expect(b.getByText("Bitte beschreibe kurz, welches Produkt dir fehlt.")).toBeVisible();
  await expect(b.getByLabel("Produktwunsch")).toHaveAttribute("aria-invalid", "true");
  expect((await empfangen(request)).some((w) => w.email === marke)).toBe(false);
});

test("Zweiter Wunsch innerhalb einer Minute wird im Browser gebremst", async ({ page, request }) => {
  await page.goto("/kategorie/papers");
  const b = box(page);
  await b.getByLabel("Produktwunsch").fill("Erster Wunsch für die Bremse");
  await b.getByRole("button", { name: "Wunsch senden" }).click();
  await expect(b.getByText("Danke! Wir melden uns, falls wir es aufnehmen.")).toBeVisible();

  await b.getByLabel("Produktwunsch").fill("Zweiter Wunsch für die Bremse");
  await b.getByRole("button", { name: "Wunsch senden" }).click();
  await expect(b.getByText("Du hast gerade schon einen Wunsch geschickt. Bitte warte eine Minute.")).toBeVisible();

  const alle = await empfangen(request);
  expect(alle.some((w) => w.wunsch === "Zweiter Wunsch für die Bremse")).toBe(false);
});
