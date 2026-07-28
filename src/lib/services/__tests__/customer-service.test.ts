import { describe, it, expect } from 'vitest';
import { toBackendPhone } from '../customer-service';

// Regression: creating a customer with an email but no phone failed with
// "A contact with this phone number already exists" (409 PHONE_EXISTS). The
// phone input is pre-seeded with the selected country's dial code, so an
// untouched field still produced digits ("+254 " -> "254") and every such
// customer collided with whichever contact already held "254".
describe('toBackendPhone', () => {
  it('drops a bare dial code left by an untouched phone input', () => {
    expect(toBackendPhone('+254 ')).toBeUndefined();
    expect(toBackendPhone('+254')).toBeUndefined();
    expect(toBackendPhone('+1')).toBeUndefined();
    expect(toBackendPhone('+228')).toBeUndefined();
  });

  it('drops empty and missing values', () => {
    expect(toBackendPhone('')).toBeUndefined();
    expect(toBackendPhone(undefined)).toBeUndefined();
    expect(toBackendPhone('   ')).toBeUndefined();
  });

  it('keeps a real number, stripped to digits', () => {
    expect(toBackendPhone('+254 712 345 678')).toBe('254712345678');
    expect(toBackendPhone('254712345678')).toBe('254712345678');
    expect(toBackendPhone('+1 (555) 010-9999')).toBe('15550109999');
  });
});
