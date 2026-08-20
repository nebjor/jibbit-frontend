#!/usr/bin/env node
/**
 * Fehlervariante des jibbit-Laders: ein AUSGEDRÜCKTER Joint.
 *
 * Node-Port der relevanten Teile von gen_joint_loader.py (gleiche Datei,
 * gleiches Verzeichnis) — das Python-Original ist die Quelle der Wahrheit für
 * Palette und Raster, dieser Port MUSS farblich exakt dazu passen. Wer hier
 * einen Farbwert ändert, ändert ihn zuerst drüben.
 *
 * Warum ein Port statt Python: die Build-/Dev-Umgebung hat kein Python mit
 * Bildbibliotheken, Node ist ohnehin da. PNG wird wie im Original von Hand
 * geschrieben (zlib + Chunks), Filtertyp 0 pro Zeile — das hält den Decoder
 * im Test (lib/loader-assets.test.ts) trivial.
 *
 * Gestaltungsabsicht: gleiche Masse (32x56), gleiche Palette, aber erloschen.
 * Keine Glut, kein Rauch, kein Halo — ein Fehlerzustand darf nicht aussehen,
 * als arbeite noch etwas. Stattdessen: der Joint ist ein Stück heruntergebrannt,
 * oben sichtbar plattgedrückt (breiter Asche-/Kohlekopf) und unterhalb davon
 * geknickt. Statisch, ein einziges Bild.
 *
 *   node tools/pixel-art/gen_joint_stub.mjs [--preview] [outdir]
 */

import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const W = 32;
const H = 56;

// ---------------------------------------------------------------- Palette
// 1:1 aus gen_joint_loader.py. EMBER_* und SMOKE_* fehlen hier ABSICHTLICH —
// der Test stellt sicher, dass keine Glutfarbe ins Bild rutscht.
const PAPER_RAMP = [
  [253, 250, 244], [246, 240, 228], [237, 229, 211],
  [221, 209, 186], [199, 184, 156],
];
const CRUTCH_RAMP = [[188, 170, 142], [158, 138, 110], [128, 108, 84]];
const CRUTCH_LINE = [104, 86, 66, 255];
const DUBI_MARK = [48, 42, 36, 255];
const CERAMIC_RAMP = [[246, 246, 243], [231, 231, 226], [208, 208, 201]];
const CERAMIC_SLOT = [74, 70, 64, 255];
const CHAR = [110, 66, 40, 255];
const CHAR_DARK = [66, 38, 24, 255];
const ASH_HI = [186, 183, 178, 255];
const ASH = [128, 124, 119, 255];
const SCORCH = [170, 142, 112, 255]; // die angesengte Zeile unter der Brandkante

// ---------------------------------------------------------------- Geometrie
// Unterhalb des Knicks identisch zum Original, damit Filter und Papierkegel
// pixelgenau dieselben sind wie im Lade-Sprite.
const TIP_Y = 20;
const BURN_Y = 23;
const MOUTH_Y = 55;
const CRUTCH_TOP = 49;
const TIP_X = 19.5;
const TILT = 0.25;
const HW_TIP = 3.0;
const HW_END = 1.0;

// Stub-spezifisch: der Joint ist weiter heruntergebrannt (Brandkante tiefer
// als im Original) und oberhalb des Knicks nach rechts weggefaltet — dieselbe
// Richtung, in die er ohnehin lehnt, nur viel steiler. So liest sich der
// Knick als Folge des Ausdrückens, nicht als zweiter Joint.
const STUB_BURN = 29; // Brandkante der erloschenen Variante
const KINK_Y = 35;    // ab hier knickt die Achse ab
const BEND = 0.55;    // Achsversatz je Zeile oberhalb des Knicks (statt 0.25)

const axisX = (y) => TIP_X - TILT * (y - TIP_Y);

function stubAxisX(y) {
  if (y >= KINK_Y) return axisX(y);
  return axisX(KINK_Y) + (KINK_Y - y) * BEND;
}

function halfWidth(y) {
  const t = (y - BURN_Y) / (MOUTH_Y - BURN_Y);
  return HW_TIP + (HW_END - HW_TIP) * Math.max(0, Math.min(1, t));
}

function span(y, hw) {
  const cxf = stubAxisX(y);
  return [Math.floor(cxf - hw + 0.5), Math.floor(cxf + hw + 0.5)];
}

function rampColour(ramp, x, l, r) {
  if (r === l) return ramp[Math.floor(ramp.length / 2)];
  const u = (x - l) / (r - l);
  return ramp[Math.min(ramp.length - 1, Math.floor(u * (ramp.length - 0.001)))];
}

// ---------------------------------------------------------------- Leinwand
function newBuf() {
  return Buffer.alloc(W * H * 4);
}

/** Nur deckende Pixel — die Stub-Grafik braucht kein Compositing. */
function put(buf, x, y, rgba) {
  x = Math.round(x);
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 4;
  buf[i] = rgba[0];
  buf[i + 1] = rgba[1];
  buf[i + 2] = rgba[2];
  buf[i + 3] = rgba[3] ?? 255;
}

// ---------------------------------------------------------------- Zeichnen
function drawStub(buf) {
  // --- Papierkegel, von der Brandkante bis zum Mundstück ---------------
  for (let y = STUB_BURN; y <= MOUTH_Y; y++) {
    const [l, r] = span(y, halfWidth(y));
    for (let x = l; x <= r; x++) {
      put(buf, x, y, [...rampColour(PAPER_RAMP, x, l, r), 255]);
    }
  }

  // --- Knickfalte -------------------------------------------------------
  // Eine Zeile dunkleres Papier quer über den Kegel, dazu ein Kohlepixel an
  // der Druckseite (rechts, wohin der Kopf gefaltet ist). Bei 32 px Breite
  // ist das die ganze Erzählung: hier hat jemand draufgedrückt.
  {
    const [l, r] = span(KINK_Y, halfWidth(KINK_Y));
    for (let x = l; x <= r; x++) {
      put(buf, x, KINK_Y, [...PAPER_RAMP[x === l ? 3 : 4], 255]);
    }
    put(buf, r, KINK_Y, CHAR_DARK);
    // die Falte wirft eine kurze Schattenkante in die Zeile darunter
    const [l2, r2] = span(KINK_Y + 1, halfWidth(KINK_Y + 1));
    put(buf, r2, KINK_Y + 1, [...PAPER_RAMP[4], 255]);
    void l2;
  }

  // --- Brandkante, erloschen --------------------------------------------
  // Wie die Original-Brandkante, aber die Mitte ist CHAR statt EMBER_OUT:
  // verkohlt, nicht glühend.
  {
    const [l, r] = span(STUB_BURN, HW_TIP);
    for (let x = l; x <= r; x++) {
      put(buf, x, STUB_BURN, x === l || x === r ? CHAR_DARK : CHAR);
    }
    const [l2, r2] = span(STUB_BURN + 1, halfWidth(STUB_BURN + 1));
    for (let x = l2 + 1; x < r2; x++) put(buf, x, STUB_BURN + 1, SCORCH);
  }

  // --- Plattgedrückter Kopf ----------------------------------------------
  // Statt Aschespitze und Kirsche: ein Kopf, der BREITER ist als das Papier
  // darunter — beim Ausdrücken quillt die Kohle seitlich raus. Drei Zeilen,
  // nach oben schmaler und heller (Asche liegt obenauf).
  // Der Kopf sitzt als kompakter Pilz AUF der Brandkante (feste Achse, nicht
  // weiter der Biegung folgend) — sonst zerfasert er zu einer Diagonale.
  const capCx = stubAxisX(STUB_BURN - 1);
  const capRows = [
    { y: STUB_BURN - 1, hw: HW_TIP + 1.2, edge: CHAR_DARK, fill: CHAR, speck: ASH, speckEvery: 3 },
    { y: STUB_BURN - 2, hw: HW_TIP + 0.6, edge: CHAR, fill: ASH, speck: CHAR, speckEvery: 4 },
    { y: STUB_BURN - 3, hw: HW_TIP - 0.9, edge: ASH, fill: ASH_HI, speck: ASH, speckEvery: 3 },
  ];
  for (const row of capRows) {
    const l = Math.floor(capCx - row.hw + 0.5);
    const r = Math.floor(capCx + row.hw + 0.5);
    for (let x = l; x <= r; x++) {
      let col = x === l || x === r ? row.edge : row.fill;
      if (x !== l && x !== r && (x - l) % row.speckEvery === 2) col = row.speck;
      put(buf, x, row.y, col);
    }
  }

  // --- Abgefallene Aschekrümel -------------------------------------------
  // Zwei Krümel neben dem Kopf. Je zwei Pixel, damit sie als Absicht lesen
  // und nicht als Bildfehler (dieselbe Regel wie der De-Speckle-Pass im
  // Rauch des Originals: einzelne Pixel wirken wie Rauschen).
  {
    put(buf, capCx + 6, STUB_BURN, ASH);
    put(buf, capCx + 7, STUB_BURN, ASH_HI);
    put(buf, capCx - 6, STUB_BURN - 1, ASH);
    put(buf, capCx - 6, STUB_BURN, ASH_HI);
  }

  // --- Filter: dubi Aktivkohlefilter — unverändert aus dem Original ------
  const CAP_TOP = MOUTH_Y - 1;
  const MARK_ROW = MOUTH_Y - 3;

  {
    const [l, r] = span(CRUTCH_TOP - 1, halfWidth(CRUTCH_TOP - 1));
    for (let x = l; x <= r; x++) put(buf, x, CRUTCH_TOP - 1, CRUTCH_LINE);
  }

  for (let y = CRUTCH_TOP; y <= MOUTH_Y; y++) {
    const [l, r] = span(y, halfWidth(y));
    for (let x = l; x <= r; x++) {
      if (y >= CAP_TOP) {
        const shade = y < MOUTH_Y ? 1 : 0;
        put(buf, x, y, [...CERAMIC_RAMP[shade], 255]);
      } else if (y === MARK_ROW) {
        put(buf, x, y, DUBI_MARK);
      } else {
        put(buf, x, y, [...rampColour(CRUTCH_RAMP, x, l, r), 255]);
      }
    }
  }

  {
    const [l, r] = span(MOUTH_Y, halfWidth(MOUTH_Y));
    put(buf, l, MOUTH_Y, [...CERAMIC_RAMP[2], 255]);
    put(buf, r, MOUTH_Y, [...CERAMIC_RAMP[2], 255]);
    if (r - l >= 2) put(buf, Math.round((l + r) / 2), MOUTH_Y, CERAMIC_SLOT);
  }
}

// ---------------------------------------------------------------- PNG
function chunk(tag, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const tagBuf = Buffer.from(tag, "latin1");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([tagBuf, data])) >>> 0);
  return Buffer.concat([len, tagBuf, data, crcBuf]);
}

// zlib.crc32 gibt es erst ab Node 22 — von Hand ist es zeilenweise trivial.
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function rawScanlines(buf) {
  const out = Buffer.alloc(H * (1 + W * 4));
  for (let y = 0; y < H; y++) {
    out[y * (1 + W * 4)] = 0; // Filtertyp 0
    buf.copy(out, y * (1 + W * 4) + 1, y * W * 4, (y + 1) * W * 4);
  }
  return out;
}

function writePng(path, buf) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(rawScanlines(buf), { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  writeFileSync(path, png);
  console.log(`${path}  ${png.length} B`);
}

// ---------------------------------------------------------------- Vorschau
function asciiDump(buf) {
  for (let y = 0; y < H; y++) {
    let row = "";
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const [r, g, b, a] = [buf[i], buf[i + 1], buf[i + 2], buf[i + 3]];
      if (a < 12) row += " ";
      else if (r > 230 && g > 220 && b > 200) row += "."; // helles Papier/Keramik
      else if (r > 180 && g > 160 && b > 130) row += "o"; // Papier/Kraft
      else if (r > 150 && g > 145 && b > 135) row += "#"; // Asche hell
      else if (r > 110 && g > 105 && b > 100) row += "%"; // Asche
      else if (r > 90 && g > 50) row += "B"; // Kohle
      else row += "@"; // dunkel
    }
    console.log("|" + row + "|");
  }
}

const args = process.argv.slice(2);
const buf = newBuf();
drawStub(buf);
if (args.includes("--preview")) {
  asciiDump(buf);
} else {
  const outdir = args.find((a) => !a.startsWith("--")) ?? "public/loader";
  writePng(join(outdir, "joint-stub.png"), buf);
}
