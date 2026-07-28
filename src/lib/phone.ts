/**
 * Shared phone-number rules.
 *
 * Two separate questions get asked about the phone field, and they must not be
 * confused:
 *
 *  1. Did the user enter a number at all?  `PhoneInputWithCountry` answers this
 *     by reporting '' for an untouched field — the country dial code lives in
 *     the country selector, never in the text input.
 *  2. Is what they entered a real number?  That is `isValidPhone`, which defers
 *     to libphonenumber-js rather than any hand-rolled digit count. Valid
 *     lengths and prefixes differ per country, so a fixed threshold is always
 *     wrong somewhere.
 *
 * Values here are E.164 digits without the leading '+' (e.g. "254712345678"),
 * which is the shape `PhoneInputWithCountry` emits and the backend stores.
 */

import { isValidPhoneNumber } from 'libphonenumber-js';

/**
 * Reduce a phone field to the digits the backend wants, or `undefined` when the
 * field is blank. `undefined` keys are dropped by `JSON.stringify`, so a phone
 * the user never entered is not sent at all — the backend answers PHONE_EXISTS
 * if it receives a value that any other contact already happens to hold.
 */
export function toBackendPhone(phone: string | undefined): string | undefined {
  const digits = (phone || '').replace(/\D/g, '');
  return digits || undefined;
}

/**
 * Whether the value is a real, dialable number for its country code.
 *
 * Uses `isValidPhoneNumber` (checks length *and* operator prefix) rather than
 * `isPossiblePhoneNumber` (length only) — the latter accepts nonsense such as
 * +254 000 000 000.
 *
 * Returns false for an empty value; call this only when a number was entered,
 * so that "no phone given" stays distinct from "phone given but wrong".
 */
export function isValidPhone(phone: string | undefined): boolean {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return false;
  try {
    return isValidPhoneNumber(`+${digits}`);
  } catch {
    return false;
  }
}
