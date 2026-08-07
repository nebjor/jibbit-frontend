import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { parseStaticTenants } from "./static-tenants";

const ENTRY = {
  id: "jibbit",
  host: "jibbit.ch",
  aliases: ["www.jibbit.ch"],
  backendUrl: "http://medusa:9000",
  publishableKey: "pk_test",
  theme: { storeName: "jibbit", domain: "jibbit.ch", themeColor: "#F6F5F3" },
};

describe("parseStaticTenants", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is empty when unset", () => {
    expect(parseStaticTenants(undefined).size).toBe(0);
    expect(parseStaticTenants("  ").size).toBe(0);
  });

  it("indexes the primary host and every alias", () => {
    const index = parseStaticTenants(JSON.stringify([ENTRY]));
    expect([...index.keys()].sort()).toEqual(["jibbit.ch", "www.jibbit.ch"]);
  });

  it("keeps the requested host on the alias entry", () => {
    const index = parseStaticTenants(JSON.stringify([ENTRY]));
    expect(index.get("www.jibbit.ch")?.host).toBe("www.jibbit.ch");
    expect(index.get("jibbit.ch")?.host).toBe("jibbit.ch");
    // Same tenant either way — canonical URLs come from theme.domain.
    expect(index.get("www.jibbit.ch")?.theme.domain).toBe("jibbit.ch");
  });

  it("normalizes case and strips a port", () => {
    const index = parseStaticTenants(
      JSON.stringify([{ ...ENTRY, host: "JIBBIT.CH:3000", aliases: [] }]),
    );
    expect(index.has("jibbit.ch")).toBe(true);
  });

  it("ignores malformed JSON rather than crashing the process", () => {
    expect(parseStaticTenants("{not json").size).toBe(0);
  });

  it("ignores a non-array payload", () => {
    expect(parseStaticTenants(JSON.stringify(ENTRY)).size).toBe(0);
  });

  it("skips incomplete entries but keeps the good ones", () => {
    const index = parseStaticTenants(
      JSON.stringify([{ id: "broken", host: "x.ch" }, ENTRY]),
    );
    expect(index.has("x.ch")).toBe(false);
    expect(index.has("jibbit.ch")).toBe(true);
  });

  it("never produces a wildcard or default entry", () => {
    const index = parseStaticTenants(JSON.stringify([ENTRY]));
    // The whole security property: an unlisted host resolves to nothing.
    expect(index.get("someone-elses-shop.ch")).toBeUndefined();
    expect(index.get("")).toBeUndefined();
    expect(index.get("*")).toBeUndefined();
  });
});
