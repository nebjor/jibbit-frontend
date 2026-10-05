/**
 * Mock Medusa Store API for the end-to-end suite.
 *
 * WHY THIS EXISTS INSTEAD OF A REAL BACKEND
 * The storefront's cart, checkout and account flows are Server Actions that
 * talk to Medusa; the mock catalogue in `lib/mock-catalog.ts` cannot serve any
 * of them. A real Medusa needs Postgres, Redis, migrations, a seed and a
 * generated publishable key — several minutes per CI run and a new source of
 * flakiness. This server implements exactly the routes the storefront calls,
 * with Medusa's response shapes, and nothing else. State lives in memory and
 * dies with the process, so every run starts identical.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * No authentication of the publishable key, no signature on the JWTs it mints
 * (the storefront only decodes them — see `lib/auth/jwt.ts`), no payment. It
 * is a test double, never something to point a browser at outside the suite.
 */

import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import {
  CATEGORIES,
  IMAGE_FILES,
  REGION,
  SHIPPING_OPTIONS,
  SHIPPING_RATES,
  TIERS,
  buildProducts,
  unitPriceAt,
} from "./catalog.mjs";

const PORT = Number(process.env.E2E_BACKEND_PORT ?? 9100);
const HOST = "127.0.0.1";
const BACKEND_URL = `http://${HOST}:${PORT}`;

const PRODUCTS = buildProducts(BACKEND_URL);
const VARIANTS = new Map(
  PRODUCTS.flatMap((p) => p.variants.map((v) => [v.id, { product: p, variant: v }])),
);

const carts = new Map();
const identities = new Map();
const customers = new Map();
const orders = new Map();

const round2 = (n) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// Query strings — the SDK serialises with `qs`, so arrays arrive as `k[0]=…`
// ---------------------------------------------------------------------------

function parseQuery(url) {
  const out = {};
  for (const [rawKey, value] of url.searchParams) {
    const indexed = /^(.+)\[\d*\]$/.exec(rawKey);
    const key = indexed ? indexed[1] : rawKey;
    if (indexed || key in out) {
      out[key] = [...(Array.isArray(out[key]) ? out[key] : out[key] ? [out[key]] : []), value];
    } else {
      out[key] = value;
    }
  }
  return out;
}

const asArray = (value) => (value === undefined ? [] : Array.isArray(value) ? value : [value]);

// ---------------------------------------------------------------------------
// Tokens — structurally valid JWTs, never verified by the storefront
// ---------------------------------------------------------------------------

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");

function mintToken(claims) {
  const payload = {
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    actor_type: "customer",
    ...claims,
  };
  return `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url(payload)}.e2e-signature`;
}

function claimsOf(request) {
  const header = request.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    return JSON.parse(Buffer.from(part, "base64url").toString("utf-8"));
  } catch {
    return null;
  }
}

/** The customer behind the bearer token, or null. */
function customerOf(request) {
  const claims = claimsOf(request);
  const id = claims?.actor_id;
  return id ? (customers.get(id) ?? null) : null;
}

// ---------------------------------------------------------------------------
// Carts
// ---------------------------------------------------------------------------

function createCart() {
  const cart = {
    id: `cart_${randomUUID()}`,
    region_id: REGION.id,
    currency_code: "chf",
    email: null,
    customer_id: null,
    completed_at: null,
    items: [],
    shipping_methods: [],
    shipping_address: null,
    billing_address: null,
    payment_collection: null,
  };
  carts.set(cart.id, cart);
  return cart;
}

function priceCart(cart) {
  for (const item of cart.items) {
    const known = VARIANTS.get(item.variant_id);
    const base = known?.variant.calculated_price.calculated_amount ?? item.unit_price;
    item.unit_price = unitPriceAt(item.variant_id, base, item.quantity);
    item.total = round2(item.unit_price * item.quantity);
    const original = known?.variant.calculated_price.original_amount ?? item.unit_price;
    item.compare_at_unit_price = original > item.unit_price ? original : null;
    item.original_total = round2(original * item.quantity);
  }

  const itemTotal = round2(cart.items.reduce((sum, i) => sum + i.total, 0));
  const method = cart.shipping_methods[0];
  const shippingTotal = method ? shippingAmount(method.shipping_option_id, itemTotal) : 0;
  if (method) method.amount = shippingTotal;

  cart.item_total = itemTotal;
  cart.item_subtotal = itemTotal;
  cart.shipping_total = shippingTotal;
  cart.total = round2(itemTotal + shippingTotal);
  return cart;
}

function shippingAmount(optionId, itemTotal) {
  const rate = SHIPPING_RATES[optionId];
  if (!rate) return 0;
  return rate.freeFrom !== null && itemTotal >= rate.freeFrom ? 0 : rate.rate;
}

function addLineItem(cart, variantId, quantity) {
  const known = VARIANTS.get(variantId);
  if (!known) return false;
  const existing = cart.items.find((i) => i.variant_id === variantId);
  if (existing) {
    existing.quantity += quantity;
    return true;
  }
  cart.items.push({
    id: `li_${randomUUID()}`,
    variant_id: variantId,
    product_id: known.product.id,
    product_handle: known.product.handle,
    product_title: known.product.title,
    title: known.variant.title,
    variant_title: known.variant.title,
    thumbnail: known.product.images[0]?.url ?? null,
    quantity,
    unit_price: known.variant.calculated_price.calculated_amount,
  });
  return true;
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

const routes = [
  ["GET", /^\/health$/, () => ({ status: "ok" })],

  /**
   * Google Places API (New), Place Details — nachgespielt für die
   * Vertrauenszeile im Shop-Kopf (lib/google-profil.ts). Der Storefront
   * zeigt hierhin über GOOGLE_PLACES_ENDPOINT (playwright.config.ts).
   * Verlangt den Schlüssel-Header wie Google (sonst 403), antwortet mit den
   * zwei Feldern der Feldmaske. Fixture-Werte, keine Live-Daten.
   */
  [
    "GET",
    /^\/places\/v1\/places\/([^/]+)$/,
    ([placeId], { request }) => {
      if (!request.headers["x-goog-api-key"]) {
        return { __status: 403, body: { error: { message: "API key missing" } } };
      }
      if (placeId !== "e2e-place") {
        return { __status: 404, body: { error: { message: "Place not found" } } };
      }
      return { rating: 4.8, userRatingCount: 27 };
    },
  ],

  ["GET", /^\/store\/regions$/, () => ({ regions: [REGION], count: 1 })],

  [
    "GET",
    /^\/store\/product-categories$/,
    () => ({ product_categories: CATEGORIES, count: CATEGORIES.length }),
  ],

  [
    "GET",
    /^\/store\/products$/,
    (_m, { query }) => {
      const categoryIds = asArray(query.category_id);
      let products = PRODUCTS;
      if (query.handle) products = products.filter((p) => p.handle === query.handle);
      if (categoryIds.length) {
        products = products.filter((p) =>
          p.categories.some((c) => categoryIds.includes(c.id)),
        );
      }
      const limit = Number(query.limit ?? 100);
      return { products: products.slice(0, limit), count: products.length };
    },
  ],

  [
    "GET",
    /^\/store\/price-tiers$/,
    (_m, { query }) => {
      const ids = asArray(query.variant_id);
      const tiers = {};
      for (const id of ids) if (TIERS[id]) tiers[id] = TIERS[id];
      return { tiers };
    },
  ],

  ["POST", /^\/store\/carts$/, () => ({ cart: priceCart(createCart()) })],

  [
    "GET",
    /^\/store\/carts\/([^/]+)$/,
    ([id]) => {
      const cart = carts.get(id);
      return cart ? { cart: priceCart(cart) } : notFound("Cart");
    },
  ],

  [
    "POST",
    /^\/store\/carts\/([^/]+)$/,
    ([id], { body }) => {
      const cart = carts.get(id);
      if (!cart) return notFound("Cart");
      if (body.email !== undefined) cart.email = body.email;
      if (body.shipping_address) cart.shipping_address = body.shipping_address;
      if (body.billing_address) cart.billing_address = body.billing_address;
      return { cart: priceCart(cart) };
    },
  ],

  [
    "POST",
    /^\/store\/carts\/([^/]+)\/customer$/,
    ([id], { request }) => {
      const cart = carts.get(id);
      if (!cart) return notFound("Cart");
      cart.customer_id = customerOf(request)?.id ?? null;
      return { cart: priceCart(cart) };
    },
  ],

  [
    "POST",
    /^\/store\/carts\/([^/]+)\/line-items$/,
    ([id], { body }) => {
      const cart = carts.get(id);
      if (!cart) return notFound("Cart");
      if (!addLineItem(cart, body.variant_id, Number(body.quantity ?? 1))) {
        return error(400, `Variant ${body.variant_id} is not available`);
      }
      return { cart: priceCart(cart) };
    },
  ],

  [
    "POST",
    /^\/store\/carts\/([^/]+)\/line-items\/([^/]+)$/,
    ([id, lineId], { body }) => {
      const cart = carts.get(id);
      if (!cart) return notFound("Cart");
      const item = cart.items.find((i) => i.id === lineId);
      if (!item) return notFound("Line item");
      item.quantity = Number(body.quantity);
      return { cart: priceCart(cart) };
    },
  ],

  [
    "DELETE",
    /^\/store\/carts\/([^/]+)\/line-items\/([^/]+)$/,
    ([id, lineId]) => {
      const cart = carts.get(id);
      if (!cart) return notFound("Cart");
      cart.items = cart.items.filter((i) => i.id !== lineId);
      return { id: lineId, object: "line-item", deleted: true, parent: priceCart(cart) };
    },
  ],

  [
    "GET",
    /^\/store\/shipping-options$/,
    (_m, { query }) =>
      carts.has(query.cart_id)
        ? { shipping_options: SHIPPING_OPTIONS }
        : { shipping_options: [] },
  ],

  [
    "POST",
    /^\/store\/shipping-options\/([^/]+)\/calculate$/,
    ([optionId], { body }) => {
      const cart = carts.get(body.cart_id);
      if (!cart) return notFound("Cart");
      return {
        shipping_option: {
          id: optionId,
          amount: shippingAmount(optionId, priceCart(cart).item_total),
        },
      };
    },
  ],

  [
    "POST",
    /^\/store\/carts\/([^/]+)\/shipping-methods$/,
    ([id], { body }) => {
      const cart = carts.get(id);
      if (!cart) return notFound("Cart");
      const option = SHIPPING_OPTIONS.find((o) => o.id === body.option_id);
      if (!option) return error(400, "Unknown shipping option");
      cart.shipping_methods = [
        { id: `sm_${randomUUID()}`, shipping_option_id: option.id, name: option.name, amount: 0 },
      ];
      return { cart: priceCart(cart) };
    },
  ],

  [
    "GET",
    /^\/store\/payment-providers$/,
    () => ({ payment_providers: [{ id: "pp_system_default" }], count: 1 }),
  ],

  [
    "POST",
    /^\/store\/payment-collections$/,
    (_m, { body }) => {
      const cart = carts.get(body.cart_id);
      if (!cart) return notFound("Cart");
      cart.payment_collection = { id: `paycol_${randomUUID()}`, payment_sessions: [] };
      return { payment_collection: cart.payment_collection };
    },
  ],

  [
    "POST",
    /^\/store\/payment-collections\/([^/]+)\/payment-sessions$/,
    ([collectionId], { body }) => {
      const cart = [...carts.values()].find((c) => c.payment_collection?.id === collectionId);
      if (!cart) return notFound("Payment collection");
      cart.payment_collection.payment_sessions = [
        { id: `payses_${randomUUID()}`, provider_id: body.provider_id, data: {} },
      ];
      return { payment_collection: cart.payment_collection };
    },
  ],

  [
    "POST",
    /^\/store\/carts\/([^/]+)\/complete$/,
    ([id]) => {
      const cart = carts.get(id);
      if (!cart) return notFound("Cart");
      priceCart(cart);
      cart.completed_at = new Date().toISOString();
      const order = {
        id: `order_${randomUUID()}`,
        display_id: orders.size + 1,
        email: cart.email,
        currency_code: cart.currency_code,
        customer_id: cart.customer_id,
        // Wie Medusa: die Bestellposition trägt eine Momentaufnahme der
        // Variante (`variant_barcode`) und — mit `*items.variant` angefragt —
        // die Variante selbst. Die Bestätigungsseite liest daraus die GTIN
        // (lib/cart/adapter.ts).
        items: cart.items.map((item) => {
          const variant = VARIANTS.get(item.variant_id)?.variant ?? null;
          return {
            ...item,
            variant_barcode: variant?.barcode ?? null,
            variant: variant
              ? { id: variant.id, ean: variant.ean, upc: variant.upc, barcode: variant.barcode }
              : null,
          };
        }),
        shipping_address: cart.shipping_address,
        item_total: cart.item_total,
        shipping_total: cart.shipping_total,
        total: cart.total,
        created_at: cart.completed_at,
      };
      orders.set(order.id, order);
      return { type: "order", order };
    },
  ],

  [
    "GET",
    /^\/store\/orders$/,
    (_m, { request }) => {
      const customer = customerOf(request);
      if (!customer) return error(401, "Unauthorized");
      const mine = [...orders.values()].filter((o) => o.customer_id === customer.id);
      return { orders: mine, count: mine.length };
    },
  ],

  [
    "GET",
    /^\/store\/orders\/([^/]+)$/,
    ([id]) => (orders.has(id) ? { order: orders.get(id) } : notFound("Order")),
  ],

  // --- Auth ---------------------------------------------------------------

  [
    "POST",
    /^\/auth\/customer\/emailpass\/register$/,
    (_m, { body }) => {
      const email = String(body.email ?? "").toLowerCase();
      if (identities.has(email)) {
        return error(401, "Identity with email already exists");
      }
      const identity = { id: `authid_${randomUUID()}`, email, password: body.password };
      identities.set(email, identity);
      return { token: mintToken({ auth_identity_id: identity.id, email }) };
    },
  ],

  [
    "POST",
    /^\/auth\/customer\/emailpass$/,
    (_m, { body }) => {
      const email = String(body.email ?? "").toLowerCase();
      const identity = identities.get(email);
      if (!identity || identity.password !== body.password) {
        return error(401, "Invalid email or password");
      }
      return {
        token: mintToken({
          auth_identity_id: identity.id,
          actor_id: identity.customer_id,
          email,
        }),
      };
    },
  ],

  [
    "POST",
    /^\/auth\/token\/refresh$/,
    (_m, { request }) => {
      const claims = claimsOf(request);
      const identity = [...identities.values()].find(
        (i) => i.id === claims?.auth_identity_id,
      );
      if (!identity?.customer_id) return error(401, "Unauthorized");
      return {
        token: mintToken({
          auth_identity_id: identity.id,
          actor_id: identity.customer_id,
          email: identity.email,
        }),
      };
    },
  ],

  [
    "POST",
    /^\/auth\/customer\/emailpass\/reset-password$/,
    () => ({ success: true }),
  ],

  [
    "POST",
    /^\/store\/customers$/,
    (_m, { request, body }) => {
      const claims = claimsOf(request);
      const identity = [...identities.values()].find(
        (i) => i.id === claims?.auth_identity_id,
      );
      if (!identity) return error(401, "Unauthorized");
      const customer = {
        id: `cus_${randomUUID()}`,
        email: identity.email,
        first_name: body.first_name ?? null,
        last_name: body.last_name ?? null,
        phone: null,
        addresses: [],
      };
      customers.set(customer.id, customer);
      identity.customer_id = customer.id;
      return { customer };
    },
  ],

  [
    "GET",
    /^\/store\/customers\/me$/,
    (_m, { request }) => {
      const customer = customerOf(request);
      return customer ? { customer } : error(401, "Unauthorized");
    },
  ],

  [
    "POST",
    /^\/store\/customers\/me$/,
    (_m, { request, body }) => {
      const customer = customerOf(request);
      if (!customer) return error(401, "Unauthorized");
      Object.assign(customer, body);
      return { customer };
    },
  ],

  [
    "GET",
    /^\/store\/customers\/me\/addresses$/,
    (_m, { request }) => {
      const customer = customerOf(request);
      if (!customer) return error(401, "Unauthorized");
      return { addresses: customer.addresses, count: customer.addresses.length };
    },
  ],

  [
    "POST",
    /^\/store\/customers\/me\/addresses$/,
    (_m, { request, body }) => {
      const customer = customerOf(request);
      if (!customer) return error(401, "Unauthorized");
      customer.addresses.push({ id: `addr_${randomUUID()}`, ...body });
      return { customer };
    },
  ],
];

function notFound(what) {
  return error(404, `${what} was not found`);
}

function error(status, message) {
  return { __status: status, body: { type: "not_allowed", message } };
}

// ---------------------------------------------------------------------------

function readBody(request) {
  return new Promise((resolve) => {
    const chunks = [];
    request.on("data", (c) => chunks.push(c));
    request.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf-8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
  });
}

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "access-control-allow-origin": "*",
  });
  response.end(body);
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, BACKEND_URL);

  if (url.pathname.startsWith("/static/")) {
    // Decoded exactly once, like express.static does for the real backend.
    let name = null;
    try {
      name = decodeURIComponent(url.pathname.slice("/static/".length));
    } catch {
      // Malformed encoding: no such file.
    }
    const file = name === null ? undefined : IMAGE_FILES[name];
    if (!file) return sendJson(response, 404, { message: "Not Found" });
    const bytes = Buffer.from(file, "base64");
    response.writeHead(200, {
      "content-type": "image/png",
      "content-length": bytes.length,
    });
    return response.end(bytes);
  }

  const handler = routes.find(
    ([method, pattern]) => method === request.method && pattern.test(url.pathname),
  );
  if (!handler) {
    return sendJson(response, 404, { message: `No mock route for ${request.method} ${url.pathname}` });
  }

  const [, pattern, run] = handler;
  const params = pattern.exec(url.pathname).slice(1);
  const body = request.method === "GET" ? {} : await readBody(request);

  try {
    const result = await run(params, { query: parseQuery(url), body, request });
    if (result && result.__status) return sendJson(response, result.__status, result.body);
    return sendJson(response, 200, result);
  } catch (err) {
    return sendJson(response, 500, { message: String(err) });
  }
});

/**
 * Node closes an idle keep-alive socket after 5 s by default. The storefront
 * reuses pooled sockets between steps of a test, so a step that lands just
 * after that window can hit a connection the server is closing — an
 * intermittent reset that surfaces as a cart mutation which never completes.
 * Well above any gap this suite produces.
 */
server.keepAliveTimeout = 120_000;
server.headersTimeout = 125_000;

server.listen(PORT, HOST, () => {
  console.log(`[mock-medusa] listening on ${BACKEND_URL}`);
});
