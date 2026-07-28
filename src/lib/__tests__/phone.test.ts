import { describe, it, expect } from 'vitest';
import { toBackendPhone, isValidPhone } from '../phone';

// Regression: creating a customer with an email but no phone failed with
// "A contact with this phone number already exists" (409 PHONE_EXISTS). The
// phone input was seeded with the selected country's dial code, so an untouched
// field still produced digits ("+254 " -> "254") and every such customer
// collided with whichever contact already held "254".
//
// The fix is in PhoneInputWithCountry: the dial code lives in the country
// selector, so an untouched field reports ''. These helpers then only have to
// distinguish "nothing entered" from "entered but wrong", with no length
// thresholds — valid lengths and prefixes differ per country.

describe('toBackendPhone', () => {
  it('omits the phone entirely when nothing was entered', () => {
    expect(toBackendPhone('')).toBeUndefined();
    expect(toBackendPhone(undefined)).toBeUndefined();
    expect(toBackendPhone('   ')).toBeUndefined();
  });

  it('keeps a real number, dial code included, stripped to digits', () => {
    expect(toBackendPhone('+254 712 345 678')).toBe('254712345678');
    expect(toBackendPhone('254712345678')).toBe('254712345678');
    expect(toBackendPhone('+228 90 12 34 56')).toBe('22890123456');
  });
});

describe('isValidPhone — core countries', () => {
  // Kenya (+254): 9-digit national number, incl. the newer 01xx ranges.
  it.each([
    ['Safaricom 07xx', '254712345678'],
    ['Safaricom 072x', '254722000000'],
    ['Airtel 073x', '254733123456'],
    ['Telkom 077x', '254770123456'],
    ['newer 011x', '254110000000'],
    ['newer 010x', '254100000000'],
  ])('accepts Kenya %s', (_label, phone) => {
    expect(isValidPhone(phone)).toBe(true);
  });

  // Togo (+228): 8-digit national number.
  it.each([
    ['9x', '22890123456'],
    ['7x', '22870123456'],
    ['96x', '22896123456'],
  ])('accepts Togo %s', (_label, phone) => {
    expect(isValidPhone(phone)).toBe(true);
  });

  // China (+86): 11-digit mobile.
  it.each([
    ['138', '8613800138000'],
    ['150', '8615012345678'],
    ['199', '8619912345678'],
  ])('accepts China %s', (_label, phone) => {
    expect(isValidPhone(phone)).toBe(true);
  });

  // Mali (+223): 8-digit national number.
  it.each([
    ['6x', '22365012345'],
    ['7x', '22376123456'],
    ['8x', '22383123456'],
    ['9x', '22391234567'],
  ])('accepts Mali %s', (_label, phone) => {
    expect(isValidPhone(phone)).toBe(true);
  });
});

describe('isValidPhone — rejects', () => {
  it('rejects a bare dial code for every core country', () => {
    expect(isValidPhone('254')).toBe(false); // Kenya
    expect(isValidPhone('228')).toBe(false); // Togo
    expect(isValidPhone('86')).toBe(false); // China
    expect(isValidPhone('223')).toBe(false); // Mali
  });

  it('rejects too-short numbers', () => {
    expect(isValidPhone('2547123')).toBe(false);
    expect(isValidPhone('228901')).toBe(false);
    expect(isValidPhone('2236501')).toBe(false);
  });

  it('rejects too-long numbers', () => {
    expect(isValidPhone('2547123456789999')).toBe(false);
  });

  it('rejects a number whose length fits but whose prefix is nonsense', () => {
    // The reason for isValidPhoneNumber over isPossiblePhoneNumber: the latter
    // only checks length and would accept this.
    expect(isValidPhone('254000000000')).toBe(false);
  });

  it('treats empty as invalid, so "no phone" is handled separately', () => {
    expect(isValidPhone('')).toBe(false);
    expect(isValidPhone(undefined)).toBe(false);
  });

  it('does not throw on junk input', () => {
    expect(() => isValidPhone('abc')).not.toThrow();
    expect(isValidPhone('abc')).toBe(false);
  });
});
