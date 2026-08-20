import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";

/**
 * Die Pixel-Art-Assets unter public/loader/ sind GENERIERT
 * (tools/pixel-art/gen_joint_loader.py bzw. gen_joint_stub.mjs) und müssen
 * zueinander passen: gleiche Masse, gleiche Palette, unterhalb des Knicks
 * sogar pixelidentisch. Ein leicht danebenliegender Farbton fällt bei
 * Pixel-Art sofort auf — dieser Test macht die Abweichung zum Testfehler,
 * bevor sie jemand im Shop sieht.
 *
 * Der Mini-Decoder unten kann absichtlich NUR, was die beiden Generatoren
 * schreiben: 8-Bit-RGBA, Filtertyp 0 je Zeile. Schreibt ein künftiger
 * Generator anders, soll der Test laut scheitern statt still raten.
 */

function decodePng(path: string): { width: number; height: number; rgba: Buffer } {
  const buf = readFileSync(path);
  expect(buf.subarray(0, 8)).toEqual(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  );

  let off = 8;
  let width = 0;
  let height = 0;
  const idat: Buffer[] = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const tag = buf.toString("latin1", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (tag === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      expect(data[8], "Bittiefe").toBe(8);
      expect(data[9], "Farbtyp (6 = RGBA)").toBe(6);
      expect(data[12], "Interlacing").toBe(0);
    } else if (tag === "IDAT") {
      idat.push(data);
    }
    off += 12 + len;
  }

  const raw = inflateSync(Buffer.concat(idat));
  const stride = 1 + width * 4;
  expect(raw.length).toBe(height * stride);

  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    expect(raw[y * stride], `Zeilenfilter in Zeile ${y}`).toBe(0);
    raw.copy(rgba, y * width * 4, y * stride + 1, (y + 1) * stride);
  }
  return { width, height, rgba };
}

const asset = (name: string) =>
  fileURLToPath(new URL(`../public/loader/${name}`, import.meta.url));

/** Palette aus gen_joint_loader.py — OHNE Glut (EMBER_*) und Rauch. */
const EXTINGUISHED_PALETTE = new Set(
  [
    // Papier
    "253,250,244", "246,240,228", "237,229,211", "221,209,186", "199,184,156",
    // Filter (Kraftpapier, Druck, Keramikkappe)
    "188,170,142", "158,138,110", "128,108,84", "104,86,66", "48,42,36",
    "246,246,243", "231,231,226", "208,208,201", "74,70,64",
    // Kohle, Asche, angesengte Kante
    "110,66,40", "66,38,24", "186,183,178", "128,124,119", "170,142,112",
  ].map((s) => s),
);

describe("joint-stub.png — die Fehlervariante", () => {
  const { width, height, rgba } = decodePng(asset("joint-stub.png"));

  it("hat dieselben Masse wie ein Bild des Laders (32x56)", () => {
    expect([width, height]).toEqual([32, 56]);
  });

  it("nutzt nur Palettenfarben des Originals — und keine Glut, keinen Rauch", () => {
    for (let i = 0; i < rgba.length; i += 4) {
      const a = rgba[i + 3];
      // Pixel-Art: deckend oder leer, keine weichen Kanten wie beim Rauch.
      expect([0, 255]).toContain(a);
      if (a === 0) continue;
      const key = `${rgba[i]},${rgba[i + 1]},${rgba[i + 2]}`;
      expect(
        EXTINGUISHED_PALETTE.has(key),
        `Fremdfarbe ${key} bei Pixel ${i / 4}`,
      ).toBe(true);
    }
  });

  it("ist unterhalb des Knicks pixelidentisch mit dem Lade-Sprite", () => {
    // Papierkegel ab y=36 und der komplette Filter sind unverändert — nur so
    // liest sich der Stub als DERSELBE Joint, bloss ausgedrückt.
    const sheet = decodePng(asset("joint-loader-sheet.png"));
    for (let y = 36; y < 56; y++) {
      const stubRow = rgba.subarray(y * 32 * 4, (y + 1) * 32 * 4);
      const sheetRow = sheet.rgba.subarray(y * 512 * 4, y * 512 * 4 + 32 * 4);
      expect(stubRow.equals(sheetRow), `Zeile ${y} weicht ab`).toBe(true);
    }
  });
});

describe("joint-loader-sheet.png — das Lade-Sprite", () => {
  const { width, height, rgba } = decodePng(asset("joint-loader-sheet.png"));

  it("trägt 16 Bilder à 32x56 nebeneinander — die Masse, auf die sich PixelJoint.module.css verlässt", () => {
    expect([width, height]).toEqual([512, 56]);
  });

  it("hat unterschiedliche Bilder (sonst wäre die Animation ein Standbild)", () => {
    const frame = (n: number) => {
      const out = Buffer.alloc(32 * 56 * 4);
      for (let y = 0; y < 56; y++) {
        rgba.copy(out, y * 32 * 4, (y * 512 + n * 32) * 4, (y * 512 + n * 32 + 32) * 4);
      }
      return out;
    };
    expect(frame(0).equals(frame(8))).toBe(false);
  });
});
