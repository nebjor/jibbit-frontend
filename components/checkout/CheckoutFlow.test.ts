import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Vertragstests auf dem QUELLTEXT (vitest läuft in Node, kein DOM) für die
 * Lieferwahl in der Kasse — Lieferung oder Abholung im Laden:
 *
 *  1. Die Wahl ist eine echte Radiogruppe (ein `name`), nicht zwei Knöpfe.
 *  2. Bei Abholung verschwinden die Adressfelder, der Abholort erscheint,
 *     das Telefon wird Pflicht.
 *  3. Die Übersicht und der Warenkorb nennen «Abholung» statt «Versand»,
 *     und der Gratisversand-Balken blendet sich aus.
 *  4. Nichts erkennt die Abholung am Namen der Medusa-Option.
 */

function read(rel: string): string {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
}

const flow = read("./CheckoutFlow.tsx");
const meter = read("../FreeShippingMeter.tsx");
const drawer = read("../CartDrawer.tsx");
const css = read("./checkout.module.css");

describe("CheckoutFlow — Lieferung oder Abholung", () => {
  it("bietet beide als Radiogruppe mit gemeinsamem name an", () => {
    expect(flow).toMatch(/type="radio"/);
    expect(flow).toMatch(/name="delivery"/);
    expect(flow).toMatch(/deliveryOption\(\s*"shipping"/);
    expect(flow).toMatch(/deliveryOption\(\s*"pickup"/);
    // Der Text kommt aus der Konfiguration, nicht aus der Komponente.
    expect(flow).toMatch(/PICKUP\.label/);
    expect(flow).toMatch(/PICKUP\.enabled/);
  });

  it("schickt die Wahl mit — der Server bildet sie auf die Medusa-Option ab", () => {
    expect(flow).toMatch(/saveAddressAction\(email, address, delivery\)/);
  });

  it("zeigt bei Abholung Abholort und Zeiten statt der Adressfelder, Telefon wird Pflicht", () => {
    expect(flow).toMatch(/isPickup \? \(/);
    expect(flow).toMatch(/data-testid="pickup-address"/);
    expect(flow).toMatch(/pickupAddressLines\(\)/);
    expect(flow).toMatch(/pickupHoursText\(\)/);
    expect(flow).toMatch(/field\("phone", "Telefon", \{\s*required: true/);
    expect(css).toMatch(/\.pickupBox\s*\{/);
    expect(css).toMatch(/\.choice\[data-checked="true"\]/);
  });

  it("übernimmt die Ladenadresse eines Abhol-Carts NICHT als Adresse der Kundin", () => {
    expect(flow).toMatch(/initialCart\.pickup && initialCart\.address/);
  });

  it("nennt in der Übersicht «Abholung» mit CHF 0.00 und ohne Schätzung", () => {
    expect(flow).toMatch(/cart\.pickup \? "Abholung" : "Versand"/);
    expect(flow).toMatch(/cart\.shippingIsEstimate && !cart\.pickup/);
    expect(flow).toMatch(/cart\.pickup\s*\?\s*formatPrice\(0\)/);
  });
});

describe("Warenkorb und Gratisversand-Balken", () => {
  it("der Balken blendet sich bei Abholung aus", () => {
    expect(meter).toMatch(/if \(count === 0 \|\| pickup\) return null;/);
  });

  it("die Schublade nennt «Abholung» und keine Schätzung", () => {
    expect(drawer).toMatch(/pickup \? "Abholung" : "Versand"/);
    expect(drawer).toMatch(/shippingIsEstimate && !pickup/);
  });
});

describe("Kein Namensvergleich", () => {
  it("weder Kasse noch Logik prüfen den Namen der Shipping Option", () => {
    const logic = [
      read("../../lib/checkout/pickup.ts"),
      read("../../lib/checkout/shipping-choice.ts"),
      read("../../lib/checkout/server.ts"),
      read("../../lib/cart/adapter.ts"),
    ].join("\n");
    expect(logic).not.toMatch(/\.name\s*===\s*["']Abholung/);
    expect(logic).not.toMatch(/name\.includes\(["']Abhol/);
    expect(logic).not.toMatch(/\/Abhol/);
  });
});
