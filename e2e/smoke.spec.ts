import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { test, expect } from "./fixtures";

const run = promisify(execFile);

/**
 * The environment health check, run against the stack under test.
 *
 * `tools/smoke.mjs` is the tool that gets pointed at a real environment;
 * running it here means CI catches a broken health check before anyone relies
 * on it. `--require-sitemap` turns the "empty sitemap" warning into a failure,
 * which is the right reading for a deployment configured as indexable.
 */
test("Der Smoke-Test läuft gegen den Teststack durch", async ({ baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Einmal pro Lauf genügt.");
  test.setTimeout(90_000);

  const repoRoot = path.dirname(testInfo.config.configFile ?? process.cwd());
  // Bei einem Fehlschlag meldet execFile nur "Command failed"; die Ausgabe des
  // Skripts ist aber genau das, was man zur Diagnose braucht.
  let stdout: string;
  try {
    ({ stdout } = await run(
      process.execPath,
      // Der Katalog hier ist eine Fixture: die Odoo-Weiterleitungen werden
      // geprüft, die Produktseiten dahinter gibt es nur auf einer echten Umgebung.
      ["tools/smoke.mjs", `--base-url=${baseURL}`, "--require-sitemap", "--skip-target-pages"],
      { cwd: repoRoot, encoding: "utf-8" },
    ));
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string };
    throw new Error(
      `Smoke-Skript fehlgeschlagen.
--- stdout ---
${e.stdout ?? ""}
--- stderr ---
${e.stderr ?? ""}`,
    );
  }

  expect(stdout).toContain("0 fehlgeschlagen");
});
