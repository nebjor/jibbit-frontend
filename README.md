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

## Status: what is real, what is stubbed

**Real**

- All 18 products with actual jibbit names, prices and "was" prices
- Shipping rules (CHF 9.00 flat, free from CHF 100.00) and the free-shipping
  progress meter in the cart
- All page content and copy, in de-CH
- Design tokens, full responsive layout, Product + FAQPage JSON-LD

**Stubbed / pending**

- `<Logo>` (`components/Logo.tsx`) renders a text placeholder. Drop the real
  graffiti-tag SVG in and replace the `<span>` — nothing else changes.
- Product imagery: no photos exist, so `ProductImage` renders a placeholder
  tile. Real URLs flow through automatically once Medusa serves them.
- The cart is **local only** (React Context + `localStorage`). Mutations are
  isolated in `components/CartProvider.tsx` for swapping to
  `sdk.store.cart.*` later.
- **Checkout does not exist.** The "Zur Kasse" button is deliberately disabled
  pending the Payrexx / TWINT / Powerpay integration.
- Legal pages contain visibly marked `[[PLATZHALTER: …]]` fields — company
  name, address, UID, e-mail, return-policy terms. These were **not** invented.
  Fill them in and have the texts reviewed before going live.
