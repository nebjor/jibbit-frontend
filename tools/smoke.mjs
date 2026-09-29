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
 */

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

function parseArgs(argv) {
  const options = { ...DEFAULTS, baseUrl: null, requireSitemap: false };
  for (const arg of argv) {
    const [key, value] = arg.startsWith("--") ? arg.slice(2).split("=") : [null, null];
    if (key === "base-url") options.baseUrl = value;
    else if (key === "require-sitemap") options.requireSitemap = true;
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

    const product = sitemap.paths.find((path) => path.startsWith("/products/"));
    if (product) {
      rows.push(await checkStatus(options, product, 200));
    } else {
      rows.push(row("WARN", "Produktseite", "keine in der Sitemap"));
    }
  }

  for (const redirect of REDIRECTS) {
    rows.push(await checkRedirect(options, redirect));
  }
  rows.push(await checkStatus(options, MISSING_PATH, 404));

  process.exitCode = print(rows, options.baseUrl) > 0 ? 1 : 0;
}

await main();
