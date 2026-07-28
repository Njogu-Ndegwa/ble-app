import { describe, it, expect } from 'vitest';
import { toBackendPhone } from '../customer-service';

// Regression: creating a customer with an email but no phone failed with
// "A contact with this phone number already exists" (409 PHONE_EXISTS), because
// the phone input held the selected country's dial code even when untouched, so
// "254" was sent as if it were a real number.
//
// The fix is in PhoneInputWithCountry (the dial code now lives in the country
// selector, and an untouched field reports ''). This layer only has to make sure
// a blank field is omitted from the request rather than sent as an empty value —
// deliberately with no length threshold, since number lengths differ by country.
describe('toBackendPhone', () => {
  it('omits the phone entirely when nothing was entered', () => {
    expect(toBackendPhone('')).toBeUndefined();
    expect(toBackendPhone(undefined)).toBeUndefined();
    expect(toBackendPhone('   ')).toBeUndefined();
  });

  it('keeps a real number, dial code included, stripped to digits', () => {
    expect(toBackendPhone('+254 712 345 678')).toBe('254712345678');
    expect(toBackendPhone('254712345678')).toBe('254712345678');
    expect(toBackendPhone('+1 (555) 010-9999')).toBe('15550109999');
    expect(toBackendPhone('+228 90 12 34 56')).toBe('22890123456');
  });

  it('does not impose a minimum length, which varies by country', () => {
    expect(toBackendPhone('+298 123456')).toBe('298123456');
  });
});
