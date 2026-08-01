import { describe, expect, it } from "vitest";
import { classifyHost, normalizeHost } from "./resolve-host";

describe("normalizeHost", () => {
  it("lowercases and strips a port", () => {
    expect(normalizeHost("Jibbit.JIBBIT.app:8000")).toBe("jibbit.jibbit.app");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeHost("  shop.example.ch  ")).toBe("shop.example.ch");
  });
});

describe("classifyHost", () => {
  const BASE = "jibbit.app";

  it("recognizes a <slug>.<baseDomain> subdomain", () => {
    expect(classifyHost("jibbit.jibbit.app", BASE)).toEqual({
      kind: "subdomain",
      key: "jibbit.jibbit.app",
      slug: "jibbit",
    });
  });

  it("recognizes a fully custom domain", () => {
    expect(classifyHost("shop.example.ch", BASE)).toEqual({
      kind: "custom-domain",
      key: "shop.example.ch",
    });
  });

  it("recognizes a custom domain that happens to share a TLD with the base domain", () => {
    expect(classifyHost("otherapp.app", BASE)).toEqual({
      kind: "custom-domain",
      key: "otherapp.app",
    });
  });

  it("treats the bare base domain as neither a subdomain nor a custom domain", () => {
    expect(classifyHost("jibbit.app", BASE)).toEqual({
      kind: "bare-base-domain",
      key: "jibbit.app",
    });
  });

  it("normalizes case and port before classifying", () => {
    expect(classifyHost("Shop.JIBBIT.app:443", BASE)).toEqual({
      kind: "subdomain",
      key: "shop.jibbit.app",
      slug: "shop",
    });
  });
});
