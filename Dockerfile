# ─── jibbit Storefront (Next.js 16) ───────────────────────────
# Dreistufig. Die Runtime bekommt nur das Standalone-Bundle aus
# `next build` — kein Quellcode, keine Dev-Abhängigkeiten, kein npm install.

FROM node:20-alpine AS deps

WORKDIR /app

# Nur die Manifeste, damit dieser Layer im Cache bleibt, solange sich die
# Abhängigkeiten nicht ändern. `npm ci` statt `install`: reproduzierbar und
# bricht ab, wenn die Lockfile nicht zur package.json passt.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund


FROM node:20-alpine AS builder

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# ACHTUNG — NEXT_PUBLIC_* wird zur BUILD-Zeit ins Browser-Bundle eingebacken,
# nicht zur Laufzeit gelesen. Ein Wert, der erst in docker-compose.yml unter
# `environment:` steht, kommt im Client-JS nie an.
#
# Für den Mehrmandantenbetrieb ist das genau richtig so: ein gemeinsam
# genutztes Image DARF keine tenant-spezifische Konfiguration enthalten. Die
# Storefront liest Backend-URL und Publishable Key deshalb zur Laufzeit aus
# der aufgelösten TenantConfig (proxy.ts -> lib/tenant/*), nicht aus
# NEXT_PUBLIC_*. Hier wird bewusst nichts durchgereicht.
ENV NEXT_TELEMETRY_DISABLED=1
# ACHTUNG — kleine VPS.
# V8 leitet sein Old-Space-Limit aus dem PHYSISCHEN RAM ab, nicht aus dem
# verfuegbaren Speicher inklusive Swap. Auf einer 2-GB-Kiste landet der
# Default bei rund 1 GB, und der Build stirbt mit "JavaScript heap out of
# memory" — auch dann, wenn reichlich Swap da ist, weil V8 ihn nie anfasst.
#
# Der Wert DARF das physische RAM ueberschreiten, solange Swap existiert.
# Ueber docker-compose.yml (build.args) oder --build-arg anpassbar.
ARG NODE_BUILD_MEMORY=3072
ENV NODE_OPTIONS="--max-old-space-size=${NODE_BUILD_MEMORY}"
RUN npm run build


FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Nicht als root laufen. Die Storefront schreibt nichts ins Dateisystem —
# ausser Next' eigenem Cache, der unter /app/.next/cache landet.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# `public` ist im Standalone-Output NICHT enthalten und muss separat mit.
COPY --from=builder /app/public ./public
# Ebenso die statischen Assets — standalone erwartet sie unter .next/static.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

RUN mkdir -p .next/cache && chown -R nextjs:nodejs .next

USER nextjs

EXPOSE 3000

# /healthz statt / — jede andere Route löst über den Host-Header einen Tenant
# auf, und 127.0.0.1 steht in keiner Tenant-Tabelle. Der Check würde dauerhaft
# 404 bekommen und einen gesunden Container als ungesund markieren.
# wget statt curl: in node:alpine ist busybox-wget vorhanden, curl nicht.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/healthz || exit 1

CMD ["node", "server.js"]
