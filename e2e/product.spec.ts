import { test, expect, SHOP, chf } from "./fixtures";

const { papers } = SHOP;

test("Produktseite zeigt Preis, Stufen und Bild", async ({ page }) => {
  await page.goto(`/products/${papers.handle}`);

  await expect(page.getByRole("heading", { level: 1, name: papers.title })).toBeVisible();
  await expect(page.getByAltText(papers.title, { exact: true }).first()).toBeVisible();

  const tiers = page.getByRole("group", { name: "Menge wählen" });
  await expect(tiers.getByRole("button")).toHaveCount(3);
  await expect(tiers).toContainText(papers.tierLabel);

  await expect(
    page.getByRole("button", { name: /In den Warenkorb/ }),
  ).toContainText(chf(papers.singlePrice));
});

test("Eine Preisstufe zu wählen ändert Preis, Menge und Foto", async ({ page }) => {
  await page.goto(`/products/${papers.handle}`);

  const tierPhoto = page.getByAltText(`${papers.title} — Ansicht 2`).first();
  await expect(tierPhoto).toBeHidden();

  await page.getByRole("button", { name: new RegExp(papers.tierLabel) }).click();

  await expect(page.getByLabel("Menge", { exact: true })).toHaveValue(String(papers.tierQuantity));
  await expect(page.getByRole("button", { name: /In den Warenkorb/ })).toContainText(
    chf(papers.lineTotal),
  );
  await expect(tierPhoto).toBeVisible();
});

test("Ein Produkt ohne Mengenrabatt zeigt keine Stufenwahl", async ({ page }) => {
  await page.goto(`/products/${SHOP.ashtray.handle}`);

  await expect(
    page.getByRole("heading", { level: 1, name: SHOP.ashtray.title }),
  ).toBeVisible();
  await expect(page.getByRole("group", { name: "Menge wählen" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Mengenrabatt" })).toHaveCount(0);
});

test("Die Menge ist frei eintippbar, Stufe und Preis folgen sofort", async ({ page }) => {
  await page.goto(`/products/${papers.handle}`);
  const input = page.getByLabel("Menge", { exact: true });
  const tiers = page.getByRole("group", { name: "Menge wählen" });
  const tierChip = (label: string) => tiers.getByRole("button", { name: new RegExp(label) });

  // Auch nach einer Stufenwahl bleibt das Feld editierbar: 24 -> 23.
  await tierChip(papers.tierLabel).click();
  await expect(input).toHaveValue("24");
  await input.fill("23");
  await expect(tierChip("10 Stück")).toHaveAttribute("aria-pressed", "true");
  await expect(tierChip(papers.tierLabel)).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: /In den Warenkorb/ })).toBeVisible();

  // Ziffern only; leer ist beim Tippen erlaubt, beim Verlassen wird es 1.
  await input.fill("2a4");
  await expect(input).toHaveValue("24");
  await expect(tierChip(papers.tierLabel)).toHaveAttribute("aria-pressed", "true");
  await input.fill("");
  await expect(input).toHaveValue("");
  await input.blur();
  await expect(input).toHaveValue("1");

  // Über dem Maximum wird auf 9999 begrenzt; "−" ist bei 1 gesperrt.
  await expect(page.getByRole("button", { name: "Menge verringern" })).toBeDisabled();
  await input.fill("50000");
  await expect(input).toHaveValue("9999");
});
