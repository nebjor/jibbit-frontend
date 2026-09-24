/**
 * Starts the storefront the way the container does.
 *
 * `next.config.ts` sets `output: "standalone"`, and `next start` refuses to
 * serve that build ("next start does not work with output: standalone"). The
 * runnable artifact is `.next/standalone/server.js`, which expects the static
 * assets and `public/` beside it — exactly the two COPY lines the Dockerfile
 * performs. Doing the same here means the suite exercises the artifact that
 * actually ships, not a second, differently assembled one.
 */

import { spawn } from "node:child_process";
import { cpSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const standalone = path.join(root, ".next", "standalone");

if (!existsSync(path.join(standalone, "server.js"))) {
  console.error("Kein Produktions-Build gefunden. Zuerst `npm run build` ausführen.");
  process.exit(1);
}

cpSync(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"), {
  recursive: true,
});
cpSync(path.join(root, "public"), path.join(standalone, "public"), { recursive: true });

const server = spawn(process.execPath, ["server.js"], {
  cwd: standalone,
  stdio: "inherit",
  env: process.env,
});

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => server.kill(signal));
}
server.on("exit", (code) => process.exit(code ?? 0));
