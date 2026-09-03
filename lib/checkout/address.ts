/**
 * Address + e-mail validation for the checkout — pure, German error messages,
 * Swiss spelling (ss, never ß).
 *
 * Validated HERE and again by Medusa. This layer exists so a customer sees a
 * field-level message instead of a backend error string, not as the only guard:
 * the backend's own `validateAddress` middleware still runs on the address
 * routes it protects.
 *
 * KONTO: an e-mail address is all Medusa needs to complete a cart. Whether the
 * checkout PAGE requires a login is `lib/checkout/account-requirement.ts`'s
 * decision — this validation layer works the same with or without a session
 * and must not assume one exists.
 */

import type { CheckoutAddress } from "@/lib/cart/types";

/** Field name -> message. Empty object means valid. */
export type AddressErrors = Partial<
  Record<keyof CheckoutAddress | "email", string>
>;

export const SUPPORTED_COUNTRIES = [
  { code: "ch", label: "Schweiz" },
  { code: "li", label: "Liechtenstein" },
] as const;

/**
 * Deliberately permissive: the real check is that Medusa (and later the payment
 * provider) can send mail to it. A stricter regex rejects valid addresses —
 * apostrophes, plus tags, new TLDs — and every rejection here is a lost order.
 */
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

/** Swiss and Liechtenstein postal codes are four digits. */
function looksLikePostalCode(value: string, countryCode: string): boolean {
  if (countryCode === "ch" || countryCode === "li") {
    return /^\d{4}$/.test(value);
  }
  return value.trim().length >= 3;
}

export function validateEmail(email: string): string | undefined {
  const trimmed = email.trim();
  if (!trimmed) return "E-Mail-Adresse fehlt.";
  if (!looksLikeEmail(trimmed)) return "Diese E-Mail-Adresse sieht nicht gültig aus.";
  return undefined;
}

export function validateAddress(
  address: CheckoutAddress,
  email: string,
): AddressErrors {
  const errors: AddressErrors = {};

  const emailError = validateEmail(email);
  if (emailError) errors.email = emailError;

  if (!address.firstName.trim()) errors.firstName = "Vorname fehlt.";
  if (!address.lastName.trim()) errors.lastName = "Nachname fehlt.";
  if (!address.address1.trim()) errors.address1 = "Strasse und Nummer fehlen.";
  if (!address.city.trim()) errors.city = "Ort fehlt.";

  const country = address.countryCode.trim().toLowerCase();
  if (!SUPPORTED_COUNTRIES.some((c) => c.code === country)) {
    errors.countryCode = "Wir liefern derzeit nur in die Schweiz und nach Liechtenstein.";
  }

  const postalCode = address.postalCode.trim();
  if (!postalCode) {
    errors.postalCode = "PLZ fehlt.";
  } else if (!looksLikePostalCode(postalCode, country)) {
    errors.postalCode = "Die PLZ besteht aus vier Ziffern.";
  }

  return errors;
}

export function hasErrors(errors: AddressErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** Trim everything and drop empty optionals, so Medusa stores no blank strings. */
export function normalizeAddress(address: CheckoutAddress): CheckoutAddress {
  const optional = (value: string | undefined) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  };
  return {
    firstName: address.firstName.trim(),
    lastName: address.lastName.trim(),
    company: optional(address.company),
    address1: address.address1.trim(),
    address2: optional(address.address2),
    postalCode: address.postalCode.trim(),
    city: address.city.trim(),
    countryCode: address.countryCode.trim().toLowerCase(),
    phone: optional(address.phone),
  };
}

export const EMPTY_ADDRESS: CheckoutAddress = {
  firstName: "",
  lastName: "",
  company: "",
  address1: "",
  address2: "",
  postalCode: "",
  city: "",
  countryCode: "ch",
  phone: "",
};
