#!/usr/bin/env node
/**
 * JSON-LD einer beliebigen Seite ansehen — der eigenen oder einer fremden.
 *
 *   node tools/seo/probe-jsonld.mjs <url> [<url> …]
 *   node tools/seo/probe-jsonld.mjs --full <url>     # ganze Knoten statt Feldliste
 *
 * WOZU
 * Strukturierte Daten sind öffentlich: sie stehen im ausgelieferten HTML
 * jeder Seite. Sich anzusehen, WELCHE Felder ein gut laufender Shop füllt,
 * ist deshalb weder ein Trick noch eine Grauzone — es ist dieselbe Auskunft,
 * die Google liest, und der schnellste Weg zu der Frage, die zählt: was
 * hat der andere, das wir nicht haben?
 *
 * WAS MAN ÜBERNIMMT UND WAS NICHT
 * Übernommen wird die FELDDECKUNG — dass es `gtin` gibt, dass `brand`
 * gefüllt ist, dass eine Rückgaberegel dranhängt. Nicht übernommen werden
 * die WERTE: fremde Preise, fremde GTINs, fremde Rückgabefristen sind
 * Aussagen über einen fremden Shop. Im eigenen Markup werden sie zu
 * Falschangaben — und Google gleicht Markup mit der echten Seite und dem
 * Merchant-Center-Feed ab. Eine Rückgabefrist auszuzeichnen, die es an der
 * Kasse nicht gibt, kostet die Shopping-Eignung, nicht nur Vertrauen.
 *
 * Das Skript liest nur, was ein Browser ohnehin lädt: eine GET-Anfrage pro
 * Adresse, kein Crawl, kein Umgehen von Schutzmassnahmen. Antwortet ein Shop
 * mit 403, respektiere das.
 */

const args = process.argv.slice(2);
const full = args.includes("--full");
const urls = args.filter((a) => !a.startsWith("--"));

if (!urls.length) {
  console.error(
    "Aufruf: node tools/seo/probe-jsonld.mjs [--full] <url> [<url> …]",
  );
  process.exit(1);
}

/** Alle <script type="application/ld+json">-Blöcke einer Seite. */
function extractBlocks(html) {
  const re =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const out = [];
  for (const m of html.matchAll(re)) out.push(m[1]);
  return out;
}

/** Ein Block kann ein Knoten, eine Liste oder ein @graph sein. */
function nodesOf(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") {
    return Array.isArray(parsed["@graph"]) ? parsed["@graph"] : [parsed];
  }
  return [];
}

const typesOf = (node) => {
  const t = node?.["@type"];
  return Array.isArray(t) ? t : [t].filter(Boolean);
};

const INTERESSANT = new Set(["Product", "ProductGroup", "Offer", "AggregateOffer"]);

function report(url, html) {
  const blocks = extractBlocks(html);
  console.log(`\n${"=".repeat(72)}\n${url}\n  ${blocks.length} ld+json-Block/Blöcke`);

  for (const raw of blocks) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.log(`  ⚠ unlesbares JSON (${err.message.slice(0, 60)})`);
      continue;
    }

    for (const node of nodesOf(parsed)) {
      const types = typesOf(node);
      const label = types.join(" + ") || "(ohne @type)";

      if (!types.some((t) => INTERESSANT.has(t))) {
        console.log(`  · ${label}`);
        continue;
      }

      if (full) {
        console.log(`  ▸ ${label}\n${JSON.stringify(node, null, 2)}`);
        continue;
      }

      console.log(`  ▸ ${label}: ${Object.keys(node).sort().join(", ")}`);

      const offers = Array.isArray(node.offers) ? node.offers : [node.offers];
      const offer = offers.find((o) => o && typeof o === "object");
      if (!offer) continue;
      console.log(`      offers → ${Object.keys(offer).sort().join(", ")}`);

      // Die drei Felder, an denen sich die Shopping-Kachel entscheidet.
      for (const key of ["gtin", "shippingDetails", "hasMerchantReturnPolicy"]) {
        const value = offer[key] ?? node[key];
        if (value !== undefined) {
          console.log(
            `      ${key}: ${JSON.stringify(value).slice(0, 200)}`,
          );
        }
      }
    }
  }
}

for (const url of urls) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "jibbit-seo-probe/1.0 (+https://jibbit.ch)" },
      redirect: "follow",
    });
    if (!res.ok) {
      console.log(`\n${"=".repeat(72)}\n${url}\n  HTTP ${res.status}`);
      continue;
    }
    report(url, await res.text());
  } catch (err) {
    console.log(`\n${"=".repeat(72)}\n${url}\n  Fehler: ${err.message}`);
  }
}
