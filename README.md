# jibbit-frontend

Storefront for **jibbit.ch** — a Swiss online headshop.
Next.js (App Router) + TypeScript + CSS Modules, talking to a **MedusaJS v2**
backend via the official JS SDK.

Language: Swiss German (de-CH). Currency: CHF.

---

## Running it

```bash
npm install
cp .env.example .env.local   # optional until the backend exists
npm run dev                  # http://localhost:8000
npm run build && npm start   # production build
npm test                     # vitest — tenant resolution, config cache, cross-tenant isolation
```

The dev server runs on **port 8000** deliberately — Medusa's default CORS
configuration expects the storefront there. Changing the port means updating
`store_cors` in the backend's `medusa-config.ts`.

### The backend does not have to be running

Every backend call goes through `lib/data.ts`, which tries the Medusa SDK and
falls back to `lib/mock-catalog.ts` when the backend is unreachable or when
`NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` is unset. The fallback logs one line:

```
[jibbit] Medusa backend unavailable — serving MOCK catalog. (...)
```

Builds and dev runs therefore work with the backend down. To go live against
Medusa, set both env vars in `.env.local` — no code change required.

### Known issue: `@medusajs/*` are pinned to tarball URLs

At setup time, npm's **metadata** endpoint was returning `429 Too Many Requests`
for the entire `@medusajs` scope (confirmed server-side: a raw `curl` of
`https://registry.npmjs.org/@medusajs%2fjs-sdk` also returned 429, while
unscoped packages resolved normally). The **tarball** endpoint on the same
official registry returned 200, so both packages are installed from pinned
tarball URLs:

```json
"@medusajs/js-sdk": "https://registry.npmjs.org/@medusajs/js-sdk/-/js-sdk-2.18.0.tgz",
"@medusajs/types":  "https://registry.npmjs.org/@medusajs/types/-/types-2.18.0.tgz"
```

These are the official registry's own artifacts — no mirror or third-party
registry is involved. Once the scope resolves normally again, restore ordinary
semver ranges with:

```bash
npm install @medusajs/js-sdk@latest @medusajs/types@latest
```

---

## Multi-tenancy

This deployment serves **many tenants from one Next.js instance**, each with
their own Medusa backend, publishable key and (minimal) branding. Tenant is
resolved from the request's `Host` header in `proxy.ts`, before any data
fetch — never from a default/hardcoded store.

- **Local dev, no control plane needed:** with `LOCAL_TENANT_ENABLED=true` in
  `.env.local` (the `.env.example` default), `Host` is ignored entirely and
  every request is served by one tenant built from
  `NEXT_PUBLIC_MEDUSA_BACKEND_URL` / `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` —
  today's single-tenant workflow, unchanged. This is **hard-disabled whenever
  `NODE_ENV=production`**, regardless of the flag (`lib/tenant/local-fallback.ts`).
- **Unknown host → 404, always.** `proxy.ts` never falls back to any tenant it
  didn't positively resolve.
- **The control plane (a separate service, not in this repo) is never on the
  request path.** `lib/tenant/config-cache.ts` resolves a host once, then
  serves that last-known-good config indefinitely — a control-plane outage
  degrades to stale-but-correct config, not an outage of every storefront.
  See the doc comment at the top of that file for the one deliberate
  exception (a host's very first request ever, with nothing cached yet).
- **No cross-tenant leakage.** There is no shared "current tenant" anywhere —
  `lib/medusa.ts` keys its Medusa clients by tenant id, `lib/data.ts` keys its
  per-tenant caches (region id, fallback-warning log) by tenant id, and
  `lib/tenant/context.ts` reads the tenant for the *current* request only,
  off a header `proxy.ts` sets per request. Run `npm test` —
  `lib/medusa.test.ts` drives two tenants' concurrent requests through the
  real SDK's HTTP layer and asserts neither ever sees the other's
  publishable key.
- Full architectural reasoning: `medusa-ecom/docs/multi-tenancy-architecture.md`
  (a sibling repo), particularly §3 (principles) and §6.2(b) (why the control
  plane must never be on the request path).

---

## Indexing switch (`SITE_INDEXABLE`) — read this before go-live

One server-side env var decides whether a deployment may appear in search
engines. It exists because the staging site (`test.jibbit.ch`) is a full copy
of the shop and would otherwise be indexed as a duplicate of `jibbit.ch`.

| `SITE_INDEXABLE` | Result |
| --- | --- |
| `true` (also `1`/`on`/`ja`/`yes`) | Indexable. Exactly the previous behaviour: `index, follow`, `robots.txt` with the sitemap, full `sitemap.xml`, no `X-Robots-Tag`. |
| anything else — **unset, empty, a typo** | **Noindex.** `X-Robots-Tag: noindex, nofollow` on every response that passes `proxy.ts` (pages, `robots.txt`, `sitemap.xml`, 404s, `/media`, `/_next/image`, `/loader`), `<meta name="robots" content="noindex, nofollow">` on every page, a `robots.txt` with `Disallow: /` and no sitemap line, and an empty `sitemap.xml`. |

> **⚠️ GO-LIVE CHECKLIST: the safe default is NOINDEX.** Production must set
> `SITE_INDEXABLE=true`, or it silently drops out of Google. The variable has
> to be listed under `environment:` of the `storefront` service in
> `medusa-ecom/docker-compose.yml` (`SITE_INDEXABLE: ${SITE_INDEXABLE:-}`) —
> Compose passes on nothing that is not listed there — and set in the `.env`
> next to it. Verify after every deploy:
>
> ```bash
> docker compose logs storefront | grep "\[seo\]"   # one line per start
> curl -sI https://jibbit.ch/ | grep -i x-robots    # production: no output
> curl -s  https://jibbit.ch/robots.txt             # production: has "Sitemap:"
> ```

Why the default points this way: a production that is accidentally noindex
is noticed and fixed within a day; a staging site that is accidentally
indexable goes unnoticed for weeks. The server therefore logs a loud
`[seo] ⚠️ NOINDEX AKTIV` warning at every start (`instrumentation.ts`).

- **Runtime, not build time.** Deliberately not `NEXT_PUBLIC_*` and not
  `headers()` in `next.config.ts` — both are frozen by `next build`, so an
  image built with the wrong value would stay wrong whatever Compose says. The
  switch is read from `process.env` on every request (`lib/seo/indexing.ts`);
  all routes render dynamically, so restarting the container is enough.
- **`robots.txt` disallows on staging.** Tradeoff: a blocked crawler no longer
  sees the noindex, so staging URLs that are already indexed stay until removed
  via Search Console.
- **Not covered by the header:** `/_next/static/*`, `/favicon.ico` and
  `/healthz` (excluded from the proxy matcher). For airtight coverage — or to
  keep people out as well as crawlers — add the header or Basic Auth in the
  reverse proxy in front.
- A page that sets its own `robots` metadata **replaces** the layout's. Pages
  that want `index: true` must go through `robotsMetadata()` (see
  `app/impressum/page.tsx`).
- The switch is per deployment, not per tenant.

---

## Swapping the colorway

**All colours, radii, fonts and spacing live in exactly one file:
[`app/tokens.css`](app/tokens.css).** No component hardcodes a colour value.

To switch from the current "Kiosk" colorway to another:

1. Open `app/tokens.css`.
2. Replace the values in the `:root` block. That's it.

The variables that define the look:

| Token | Kiosk value | Role |
| --- | --- | --- |
| `--c-ground` | `#F6F5F3` | page background |
| `--c-surface` | `#FFFFFF` | cards, panels, sticky bars |
| `--c-ink` | `#0E0E0E` | text, borders, logo |
| `--c-muted` | `#75736E` | secondary text |
| `--c-line` | `#DEDCD7` | hairlines and dividers |
| `--c-accent` | `#E11B22` | **price + the one primary CTA per view** |
| `--c-on-accent` | `#FFFFFF` | text on accent |
| `--radius` | `0px` | corner rounding (Kiosk is square) |
| `--font-display` | condensed grotesque stack | headings, prices, labels |
| `--font-body` | neutral sans stack | body copy |

One value lives outside `tokens.css` and must be kept in sync: `THEME_COLOR` in
`lib/config.ts`, which mirrors `--c-ground`. Next emits it into
`<meta name="theme-color">` at build time, so it cannot read a CSS variable.

Two conventions worth preserving when swapping:

- **The accent is scarce.** It is used for prices and for the single primary
  action in a view — nothing else. Widening its use flattens the visual
  hierarchy that makes the price read as the hero.
- **Prices use tabular numerals** via the `.tnum` utility in `globals.css`, so
  digits line up down a product grid.

Fonts are system stacks, not CDN links, so a build never depends on the network.
To self-host a real DIN-like face, add `@font-face` rules and point
`--font-display` at the new family — again, only in `tokens.css`.

---

## Structure

```
proxy.ts                        ★ tenant resolution — runs before every request

app/
  layout.tsx                    root shell: header, footer, cart provider/drawer
  page.tsx                      landing page
  shop/page.tsx                 product listing + category filter (?kategorie=)
  products/[handle]/page.tsx    product detail (dynamic route)
  impressum/                    ─┐
  agb/                           │ legally required pages
  datenschutz/                   │
  widerrufsrecht/               ─┘
  service/
    kontakt/ versand/ zahlungsarten/ rueckgabe/ faq/
  tokens.css                    ★ the whole colorway
  globals.css                   reset + shared utilities

components/                     Logo, Header, Footer, ProductCard, Price,
                                AddToCart, CartProvider, CartDrawer, …

lib/
  medusa.ts                     Medusa client factory, one per tenant (never a singleton)
  data.ts                       ★ the only place components fetch data from
  adapters.ts                   Medusa entity -> internal view type
  mock-catalog.ts               fallback catalog (real jibbit products/prices)
  types.ts                      internal view types
  format.ts                     CHF formatting
  config.ts                     shipping rules, payment methods, brand strings
  tenant/
    context.ts                  ★ getTenantContext() — how components learn "which tenant"
    config-cache.ts             ★ stale-while-revalidate cache, last-known-good on outage
    control-plane-client.ts     the one function that calls the control plane over HTTP
    local-fallback.ts           single-tenant dev fallback (LOCAL_TENANT_ENABLED)
    resolve-host.ts             subdomain vs. custom-domain host parsing (pure, tested)
    header-codec.ts             encodes/decodes the tenant config carried proxy.ts -> app
    types.ts, constants.ts
```

### Data-layer rules

- **Never call the Medusa SDK from a component.** Import from `lib/data.ts`.
  Store routes need the `x-publishable-api-key` header, which only the SDK adds
  — a bare `fetch()` would 401.
- **Never import `mock-catalog.ts` from a component.** The fallback is the data
  layer's business.
- **Never divide or multiply prices by 100.** Medusa v2 stores decimals:
  CHF 27.00 arrives as `27`.
- Components read `ProductView`, never `StoreProduct`. The mapping lives in
  `lib/adapters.ts` and is the only file that changes if the backend schema does.
- **Never add a module-level "current tenant" variable.** Every per-process
  cache in `lib/data.ts`, `lib/medusa.ts` and `lib/tenant/` is keyed by tenant
  id for exactly this reason — see "Multi-tenancy" above.

---

## Cart and checkout

The cart is a Medusa cart. The browser holds only its id, in an httpOnly cookie
(`lib/cart/cookie.ts`), and every mutation is a Server Action — the publishable
key and backend URL come from the per-request TenantConfig and must never reach
the browser bundle.

Two rules that are easy to break and expensive when broken:

**1. Never add to a line that already exists.** `POST /store/carts/:id/line-items`
for a variant already in the cart merges the lines but keeps the price Medusa
calculated for the quantity in THAT request — the delta. Measured on a real
backend with a 1/10/24 quantity break: adding 20 and then 4 more produced
24 x CHF 2.50 = CHF 60.00 for a basket worth CHF 33.60. `lib/cart/plan.ts`
turns every such add into an absolute-quantity `updateLineItem`, and
`lib/cart/plan.test.ts` pins it.

**2. Never compute a cart price in the storefront.** `lib/pricing.ts` serves the
product page, where there is no cart to ask. The moment a cart exists, the
displayed subtotal is Medusa's `item_total` — the gross, tax-inclusive figure —
and line totals are Medusa's `items[].total`. Do not use `item_subtotal`: it is
the NET value (CHF 33.60 gross appears there as CHF 31.08).

The one number the storefront does estimate is shipping BEFORE a delivery method
is on the cart, because Medusa reports 0 until then. It is labelled
"(geschätzt)" and uses the same rule as the backend's `swiss-shipping` module;
`SHIPPING` in `lib/config.ts` must be kept in sync with `fixedPrice` /
`freeShippingThreshold` in the backend's `medusa-config.ts`.

## Status: what is real, what is stubbed

**Real**

- All 18 products with actual jibbit names, prices and "was" prices
- Shipping rules (CHF 9.00 flat, free from CHF 100.00) and the free-shipping
  progress meter in the cart
- The cart is a **real Medusa cart**. The id lives in an httpOnly cookie, every
  mutation goes through a Server Action (`app/actions/cart.ts`), and every price
  shown comes from Medusa — see "Cart and checkout" below.
- The checkout: address, delivery method, summary, order. Guest orders, no
  account needed.
- All page content and copy, in de-CH
- Design tokens, full responsive layout, Product + FAQPage JSON-LD

**Stubbed / pending**

- `<Logo>` (`components/Logo.tsx`) renders a text placeholder. Drop the real
  graffiti-tag SVG in and replace the `<span>` — nothing else changes.
- Product imagery is **partly real**: 9 of the 25 catalogue products have
  photos, uploaded to Medusa by `backend/src/scripts/import-product-images.ts`.
  They are served same-origin through `app/media/[...path]/route.ts` — see
  `lib/media.ts` for why they cannot be loaded from the backend URL directly.
  The remaining products get a generated tile built from brand name and product
  kind (`lib/placeholder.ts`); it is a deliberate design, not an error state,
  so the grid stays coherent whatever the photo coverage is.
- The cart is a **real Medusa cart**. The cart id lives in an httpOnly cookie
  and every mutation goes through a server action (`app/actions/cart.ts`), so
  the publishable key never reaches the browser. Adding to an existing line is
  always an absolute-quantity update — see `lib/cart/plan.ts` for the Medusa
  pricing bug that makes this mandatory.
- **Checkout runs end to end**, guest-only by design.
- **Payment runs via zahls.ch** (official plugin `@zahls/medusa-plugin` in
  the backend, provider `pp_zahls_zahls`, TWINT/cards/PostFinance) —
  hosted redirect, wired through `lib/checkout/payment.ts`, the only file
  that talks to a payment provider. Without zahls.ch credentials (dev/CI),
  Medusa's `pp_system_default` provider takes over; it authorises WITHOUT
  MOVING MONEY and is therefore blocked in production builds
  (`systemDefaultAllowed()` in `lib/checkout/payment.ts`).
- Customer accounts exist: registration, login, password reset and an account
  area under `/konto`. Ordering without an account stays possible.
- Legal pages contain visibly marked `[[PLATZHALTER: …]]` fields — company
  name, address, UID, e-mail, return-policy terms. These were **not** invented.
  Fill them in and have the texts reviewed before going live.
