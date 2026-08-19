import { describe, expect, it } from "vitest";
import {
  estimateShipping,
  freeShippingProgress,
  remainingForFreeShipping,
} from "./shipping";
import { SHIPPING } from "@/lib/config";

/**
 * These expectations are not invented — they were measured against a live
 * Medusa with the `swiss-shipping` provider:
 *
 *   item_total  99.60 -> cart.shipping_total 9
 *   item_total 100.00 -> cart.shipping_total 0
 *   item_total 104.60 -> cart.shipping_total 0
 *
 * The provider compares the GROSS goods total against its threshold, which is
 * the same quantity this estimate uses. If someone changes `SHIPPING` without
 * changing the backend module's options (or the other way round), the free
 * shipping meter starts promising something the checkout does not deliver.
 */
describe("estimateShipping", () => {
  it("charges the flat rate below the threshold", () => {
    expect(estimateShipping(99.6)).toBe(SHIPPING.flatRate);
    expect(estimateShipping(0.05)).toBe(SHIPPING.flatRate);
  });

  it("is free at the threshold exactly, matching the backend", () => {
    expect(estimateShipping(100)).toBe(0);
    expect(estimateShipping(104.6)).toBe(0);
  });

  it("charges nothing for an empty cart", () => {
    expect(estimateShipping(0)).toBe(0);
  });

  it("uses the same numbers the backend module is configured with", () => {
    // medusa-config.ts: fixedPrice 9, freeShippingThreshold 100.
    expect(SHIPPING.flatRate).toBe(9);
    expect(SHIPPING.freeThreshold).toBe(100);
  });
});

describe("remainingForFreeShipping", () => {
  it("counts down to the threshold", () => {
    expect(remainingForFreeShipping(99.6)).toBe(0.4);
    expect(remainingForFreeShipping(33.6)).toBe(66.4);
  });

  it("flips to zero at exactly the point where shipping becomes free", () => {
    expect(remainingForFreeShipping(100)).toBe(0);
    expect(estimateShipping(100)).toBe(0);
  });

  it("never goes negative", () => {
    expect(remainingForFreeShipping(250)).toBe(0);
  });
});

describe("freeShippingProgress", () => {
  it("is a 0..1 fraction, clamped at the top", () => {
    expect(freeShippingProgress(0)).toBe(0);
    expect(freeShippingProgress(50)).toBeCloseTo(0.5, 10);
    expect(freeShippingProgress(100)).toBe(1);
    expect(freeShippingProgress(500)).toBe(1);
  });
});
