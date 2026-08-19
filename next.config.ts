import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Container deployment: emit `.next/standalone` — a self-contained server
   * with only the modules it actually imports, instead of the whole
   * node_modules tree. That is what lets the runtime image skip `npm install`
   * entirely (see Dockerfile).
   *
   * Harmless for `next dev`; the standalone bundle is only produced by
   * `next build`.
   */
  output: "standalone",
};

export default nextConfig;
