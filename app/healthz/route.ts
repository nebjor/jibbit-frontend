/**
 * Liveness probe for Docker / Caddy / uptime monitoring.
 *
 * Deliberately tenant-free, and excluded from the proxy matcher: every other
 * route resolves a tenant from the Host header, and a container health check
 * connects to 127.0.0.1 — a host that is in no tenant table and would
 * correctly 404 forever, marking a perfectly healthy container as unhealthy.
 *
 * It answers "this process serves HTTP", nothing more. It must not touch the
 * backend or the control plane: a readiness probe that fails when a
 * *dependency* is down would have Docker restart a storefront that is fine,
 * turning someone else's outage into a restart loop.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return new Response("ok", {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
