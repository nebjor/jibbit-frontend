#!/usr/bin/env node
/**
 * Environment health check.
 *
 *   npm run smoke -- --base-url=https://test.jibbit.ch
 *
 * READ-ONLY BY CONSTRUCTION. Every request below is a GET; nothing creates a
 * cart, an account or an order, so this is safe to point at production. Keep
 * it that way — the moment it writes, nobody will dare run it where it matters.
 *
 * No browser, no Playwright, no dependencies: plain `fetch` on Node 20, so it
 * runs anywhere Node runs, including a box that cannot install Chromium.
 *
 * Exit code 0 when everything passed, 1 otherwise. A WARN never fails the run.
 *
 * Options:
 *   --require-sitemap      an empty sitemap fails the run (indexable deployment)
 *   --skip-target-pages    check every Odoo redirect, but do not request the
 *                          product page behind it — for a stack whose catalogue
 *                          is a fixture (the end-to-end suite)
 */

import { readFile } from "node:fs/promises";

const DEFAULTS = {
  timeout: 15_000,
  concurrency: 6,
  maxUrls: 200,
};

/** Pages that must always answer, on every environment. */
const CORE_PATHS = [
  "/",
  "/impressum",
  "/agb",
  "/datenschutz",
  "/widerrufsrecht",
  "/service/kontakt",
  "/service/versand",
  "/service/zahlungsarten",
  "/service/rueckgabe",
  "/service/faq",
  "/robots.txt",
];

/**
 * Old Odoo addresses that must still land somewhere sensible. Both targets
 * come from `lib/seo/legacy-redirects.ts` — this is the live mapping, not a
 * test fixture.
 */
const REDIRECTS = [
  { from: "/shop", to: "/" },
  { from: "/fr_CH/shop/ocb-slim-filter-bio-10x120-tips-41?search=filter", to: "/products/ocb-slim-filter-bio-120-tips" },
];

const MISSING_PATH = "/products/dieses-produkt-gibt-es-nicht-smoke";

/**
 * The full Odoo mapping — the same file `lib/seo/legacy-redirects.ts` reads.
 * Every target is requested, so a handle renamed in the admin shows up here
 * before Google finds the 404.
 */
const LEGACY_DATA = new URL("../lib/seo/legacy-redirects.data.json", import.meta.url);

const FEED_PATH = "/merchant-feed.tsv";
/** Attributes Merchant Center refuses to work without. */
const FEED_REQUIRED = ["id", "title", "link", "image_link", "availability", "price"];

function parseArgs(argv) {
  const options = {
    ...DEFAULTS,
    baseUrl: null,
    requireSitemap: false,
    skipTargetPages: false,
  };
  for (const arg of argv) {
    const [key, value] = arg.startsWith("--") ? arg.slice(2).split("=") : [null, null];
    if (key === "base-url") options.baseUrl = value;
    else if (key === "require-sitemap") options.requireSitemap = true;
    else if (key === "skip-target-pages") options.skipTargetPages = true;
    else if (key === "timeout") options.timeout = Number(value);
    else if (key === "concurrency") options.concurrency = Number(value);
    else if (key === "max-urls") options.maxUrls = Number(value);
    else {
      console.error(`Unbekannte Option: ${arg}`);
      process.exit(2);
    }
  }
  if (!options.baseUrl) {
    console.error("Usage: npm run smoke -- --base-url=https://test.jibbit.ch");
    console.error("Es gibt bewusst keine Vorgabe — eine Umgebung wird immer genannt.");
    process.exit(2);
  }
  options.baseUrl = options.baseUrl.replace(/\/+$/, "");
  return options;
}

async function request(url, options, { redirect = "follow" } = {}) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeout);
  try {
    const response = await fetch(url, {
      redirect,
      signal: controller.signal,
      headers: { "user-agent": "jibbit-smoke/1.0", accept: "text/html,*/*" },
    });
    return { response, ms: Date.now() - started };
  } catch (error) {
    return { error, ms: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

/** Runs `worker` over `items`, at most `limit` at a time, keeping input order. */
async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

function row(status, check, detail) {
  return { status, check, detail };
}

async function checkStatus(options, path, expected) {
  const { response, error, ms } = await request(options.baseUrl + path, options);
  if (error) return row("FAIL", path, `nicht erreichbar: ${error.message}`);
  return response.status === expected
    ? row("PASS", path, `${response.status} · ${ms} ms`)
    : row("FAIL", path, `${response.status}, erwartet ${expected}`);
}

async function checkRedirect(options, { from, to }) {
  const { response, error } = await request(options.baseUrl + from, options, {
    redirect: "manual",
  });
  if (error) return row("FAIL", from, `nicht erreichbar: ${error.message}`);
  if (response.status !== 301) {
    return row("FAIL", from, `${response.status}, erwartet 301`);
  }
  const location = response.headers.get("location");
  if (!location) return row("FAIL", from, "301 ohne Location-Header");
  // Absolute target under the tenant's own domain — only the path is ours.
  const target = new URL(location, options.baseUrl);
  return target.pathname === to
    ? row("PASS", `301 ${from}`, `→ ${target.pathname}`)
    : row("FAIL", `301 ${from}`, `→ ${target.pathname}, erwartet ${to}`);
}

async function checkHomeContent(options) {
  const { response, error } = await request(options.baseUrl + "/", options);
  if (error) return row("FAIL", "Startseite", `nicht erreichbar: ${error.message}`);
  const html = await response.text();
  if (!html.includes('lang="de-CH"')) {
    return row("FAIL", "Startseite", "kein <html lang=\"de-CH\"> — falscher Mandant?");
  }
  return row("PASS", "Startseite", `${Math.round(html.length / 1024)} kB HTML`);
}

/**
 * Every old Odoo product address: one 301, onto the mapped handle, and the
 * page behind it answers 200.
 *
 * Targets listed under `unveroeffentlicht` are drafts in the admin. Their 404
 * is expected until the owner publishes them, so it is reported as ONE named
 * warning with the handles — visible, but not a failure. Any other target
 * that does not answer 200 fails the run.
 */
async function checkLegacyTargets(options) {
  const label = "Odoo-Weiterleitungen";
  let data;
  try {
    data = JSON.parse(await readFile(LEGACY_DATA, "utf8"));
  } catch (error) {
    return [row("FAIL", label, `Zuordnung nicht lesbar: ${error.message}`)];
  }
  const pending = new Set(data.unveroeffentlicht ?? []);
  const entries = Object.entries(data.produkte ?? {});

  const results = await mapLimit(entries, options.concurrency, async ([id, target]) => {
    const from = `/shop/x-${id}`;
    const expected = target.startsWith("/") ? target : `/products/${target}`;
    const hop = await request(options.baseUrl + from, options, { redirect: "manual" });
    if (hop.error) return { id, target, problem: `${from}: ${hop.error.message}` };
    if (hop.response.status !== 301) {
      return { id, target, problem: `${from}: ${hop.response.status}, erwartet 301` };
    }
    const location = new URL(hop.response.headers.get("location") ?? "", options.baseUrl);
    const actual = location.pathname + location.search;
    if (actual !== expected) {
      return { id, target, problem: `${from} → ${actual}, erwartet ${expected}` };
    }
    if (options.skipTargetPages) return { id, target, expected, status: 200, skipped: true };
    const page = await request(options.baseUrl + expected, options, { redirect: "manual" });
    if (page.error) return { id, target, problem: `${expected}: ${page.error.message}` };
    return { id, target, expected, status: page.response.status };
  });

  const byTarget = (list) => {
    const ids = new Map();
    for (const { id, target } of list) ids.set(target, [...(ids.get(target) ?? []), id]);
    return [...ids].map(([target, odoo]) => `${target} (Odoo ${odoo.join(", ")})`);
  };

  const broken = results.filter(
    (r) => r.problem || (r.status !== 200 && !(r.status === 404 && pending.has(r.target))),
  );
  const drafts = results.filter((r) => !r.problem && r.status === 404 && pending.has(r.target));
  const published = results.filter(
    (r) => !r.problem && !r.skipped && r.status === 200 && pending.has(r.target),
  );
  const fine = results.length - broken.length - drafts.length;

  const rows = [
    broken.length
      ? row("FAIL", label, `${broken.length} von ${results.length} kaputt`)
      : row(
          "PASS",
          label,
          options.skipTargetPages
            ? `${results.length} Adressen leiten richtig um (Zielseiten nicht geprüft)`
            : `${fine} von ${results.length} Zielen antworten mit 200`,
        ),
    ...broken.map((r) =>
      row("FAIL", `  Odoo ${r.id}`, r.problem ?? `${r.expected}: ${r.status}, erwartet 200`),
    ),
  ];
  if (drafts.length) {
    const handles = byTarget(drafts);
    rows.push(
      row(
        "WARN",
        "UNVERÖFFENTLICHTE ZIELE",
        `${handles.length} Produkte sind noch Entwurf (404) — vor dem Go-live veröffentlichen`,
      ),
      ...handles.map((text) => row("WARN", "  Entwurf", text)),
    );
  }
  for (const text of byTarget(published)) {
    rows.push(row("WARN", "  veröffentlicht", `${text} — aus «unveroeffentlicht» streichen`));
  }
  return rows;
}

/**
 * The Merchant Center feed: answers, carries the required columns, links
 * only to pages that exist — and lists every product the sitemap lists.
 */
async function checkFeed(options, sitemapPaths) {
  const { response, error } = await request(options.baseUrl + FEED_PATH, options);
  if (error) return [row("FAIL", FEED_PATH, `nicht erreichbar: ${error.message}`)];
  if (!response.ok) return [row("FAIL", FEED_PATH, `${response.status}, erwartet 200`)];

  const [head, ...lines] = (await response.text()).trimEnd().split("\n");
  const columns = head.split("\t");
  const items = lines.map((line) => {
    const cells = line.split("\t");
    return Object.fromEntries(columns.map((name, i) => [name, cells[i] ?? ""]));
  });
  if (items.length === 0) return [row("FAIL", FEED_PATH, "keine einzige Zeile")];

  const rows = [row("PASS", FEED_PATH, `${items.length} Artikel, ${columns.length} Spalten`)];

  const ids = items.map((item) => item.id);
  const duplicates = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
  if (duplicates.length) {
    rows.push(row("FAIL", "  Feed: id", `doppelt: ${duplicates.slice(0, 5).join(", ")}`));
  }

  for (const name of FEED_REQUIRED) {
    const empty = items.filter((item) => !item[name]).map((item) => item.id);
    if (empty.length) {
      rows.push(
        row("FAIL", `  Feed: ${name}`, `leer bei ${empty.length}: ${empty.slice(0, 5).join(", ")}`),
      );
    }
  }
  // Google lehnt einen Preis von 0 ab; meist fehlt dann der Preis im Admin.
  const free = items.filter((item) => /^0+(\.0+)? /.test(item.price)).map((item) => item.id);
  if (free.length) {
    rows.push(row("FAIL", "  Feed: price", `0.00 bei ${free.length}: ${free.slice(0, 5).join(", ")}`));
  }
  for (const name of ["brand", "description", "gtin"]) {
    if (!columns.includes(name)) continue;
    const empty = items.filter((item) => !item[name]).length;
    if (empty) rows.push(row("WARN", `  Feed: ${name}`, `leer bei ${empty} von ${items.length}`));
  }

  // Links zeigen auf die Domain des Mandanten; geprüft wird diese Umgebung.
  const paths = [...new Set(items.map((item) => new URL(item.link).pathname))];
  const dead = (
    await mapLimit(paths.slice(0, options.maxUrls), options.concurrency, async (path) => {
      const page = await request(options.baseUrl + path, options, { redirect: "manual" });
      if (page.error) return `${path} (${page.error.message})`;
      return page.response.status === 200 ? null : `${path} (${page.response.status})`;
    })
  ).filter(Boolean);
  rows.push(
    dead.length
      ? row("FAIL", "  Feed: link", `${dead.length} ohne 200: ${dead.slice(0, 5).join(", ")}`)
      : row("PASS", "  Feed: link", `${paths.length} Produktseiten, alle 200`),
  );

  // Nur mit Sitemap vergleichbar — auf einem gesperrten Deployment ist sie leer.
  const listed = sitemapPaths.filter((path) => path.startsWith("/products/"));
  if (listed.length) {
    const inFeed = new Set(paths);
    const missing = listed.filter((path) => !inFeed.has(path));
    const extra = paths.filter((path) => !listed.includes(path));
    rows.push(
      missing.length || extra.length
        ? row(
            "FAIL",
            "  Feed ↔ Sitemap",
            `im Feed fehlen ${missing.length}, in der Sitemap fehlen ${extra.length}: ` +
              [...missing, ...extra].slice(0, 5).join(", "),
          )
        : row("PASS", "  Feed ↔ Sitemap", `dieselben ${listed.length} Produkte`),
    );
  }
  return rows;
}

/** An indexable deployment must point crawlers at its sitemap. */
async function checkRobotsSitemap(options) {
  const { response, error } = await request(options.baseUrl + "/robots.txt", options);
  if (error || !response.ok) return row("FAIL", "robots.txt: Sitemap", "nicht lesbar");
  const line = /^sitemap:\s*(\S+)/im.exec(await response.text());
  return line
    ? row("PASS", "robots.txt: Sitemap", line[1])
    : row("FAIL", "robots.txt: Sitemap", "Zeile fehlt, obwohl die Sitemap URLs führt");
}

/** Sitemap URLs, rewritten onto the environment under test. */
async function readSitemap(options) {
  const { response, error } = await request(options.baseUrl + "/sitemap.xml", options);
  if (error || !response.ok) {
    return { rows: [row("FAIL", "/sitemap.xml", error ? error.message : String(response.status))], paths: [] };
  }
  const xml = await response.text();
  const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((match) => {
      try {
        const url = new URL(match[1].trim());
        return url.pathname + url.search;
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  if (paths.length === 0) {
    return {
      rows: [
        row(
          options.requireSitemap ? "FAIL" : "WARN",
          "/sitemap.xml",
          "0 URLs — Deployment steht auf noindex (SITE_INDEXABLE)",
        ),
      ],
      paths: [],
    };
  }
  return { rows: [row("PASS", "/sitemap.xml", `${paths.length} URLs`)], paths };
}

async function crawl(options, paths) {
  const limited = paths.slice(0, options.maxUrls);
  const results = await mapLimit(limited, options.concurrency, async (path) => {
    const { response, error } = await request(options.baseUrl + path, options);
    if (error) return { path, detail: error.message };
    return response.status === 200 ? null : { path, detail: String(response.status) };
  });

  const broken = results.filter(Boolean);
  const skipped = paths.length - limited.length;
  const label = `Sitemap-Crawl (${limited.length} URLs${skipped ? `, ${skipped} übersprungen` : ""})`;

  if (broken.length === 0) return [row("PASS", label, "alle 200")];
  return [
    row("FAIL", label, `${broken.length} kaputt`),
    ...broken.slice(0, 10).map((b) => row("FAIL", `  ${b.path}`, b.detail)),
  ];
}

function print(rows, baseUrl) {
  const width = Math.max(...rows.map((r) => r.check.length), 20);
  console.log(`\njibbit Smoke-Test — ${baseUrl}\n`);
  for (const { status, check, detail } of rows) {
    console.log(`  ${status.padEnd(4)}  ${check.padEnd(width)}  ${detail}`);
  }
  const failed = rows.filter((r) => r.status === "FAIL").length;
  const warned = rows.filter((r) => r.status === "WARN").length;
  console.log(
    `\n  ${rows.length - failed - warned} bestanden, ${warned} Hinweise, ${failed} fehlgeschlagen\n`,
  );
  return failed;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const rows = [];

  rows.push(await checkStatus(options, "/healthz", 200));
  rows.push(await checkHomeContent(options));

  rows.push(
    ...(await mapLimit(CORE_PATHS, options.concurrency, (path) =>
      checkStatus(options, path, 200),
    )),
  );

  const sitemap = await readSitemap(options);
  rows.push(...sitemap.rows);
  if (sitemap.paths.length) {
    rows.push(...(await crawl(options, sitemap.paths)));

    rows.push(await checkRobotsSitemap(options));

    const product = sitemap.paths.find((path) => path.startsWith("/products/"));
    if (product) {
      rows.push(await checkStatus(options, product, 200));
    } else {
      rows.push(row("WARN", "Produktseite", "keine in der Sitemap"));
    }
  }

  rows.push(...(await checkFeed(options, sitemap.paths)));

  for (const redirect of REDIRECTS) {
    rows.push(await checkRedirect(options, redirect));
  }
  rows.push(...(await checkLegacyTargets(options)));
  rows.push(await checkStatus(options, MISSING_PATH, 404));

  process.exitCode = print(rows, options.baseUrl) > 0 ? 1 : 0;
}

await main();
