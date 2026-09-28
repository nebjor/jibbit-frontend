import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // `e2e/` holds Playwright specs. They match vitest's default glob, and
    // vitest would import them, choke on `@playwright/test`'s own runner and
    // report a broken unit-test suite.
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      // `server-only`'s default export condition throws unconditionally —
      // it only resolves to a no-op under the `react-server` export
      // condition, which vitest doesn't set. Point it at the package's own
      // no-op build directly rather than adding the `react-server` condition
      // wholesale, which would also change how `react`/`react-dom` resolve.
      "server-only": fileURLToPath(
        new URL("./node_modules/server-only/empty.js", import.meta.url),
      ),
    },
  },
});
