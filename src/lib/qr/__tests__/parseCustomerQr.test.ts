import { describe, it, expect } from 'vitest';
import { parseCustomerQr } from '../parseCustomerQr';

describe('parseCustomerQr', () => {
  it('treats a bare string as the subscription code', () => {
    expect(parseCustomerQr('SUB-8847-KE')).toEqual({ subscriptionCode: 'SUB-8847-KE' });
  });

  it('trims surrounding whitespace', () => {
    expect(parseCustomerQr('  SUB-1  ')).toEqual({ subscriptionCode: 'SUB-1' });
  });

  it('treats a purely numeric code as a string (not a parsed number)', () => {
    // JSON.parse('12345') yields the number 12345 — must still be used as the code.
    expect(parseCustomerQr('12345')).toEqual({ subscriptionCode: '12345' });
  });

  it('returns null for empty / whitespace-only input', () => {
    expect(parseCustomerQr('')).toBeNull();
    expect(parseCustomerQr('   ')).toBeNull();
  });

  it('returns null for non-string input', () => {
    // @ts-expect-error exercising the runtime guard
    expect(parseCustomerQr(null)).toBeNull();
    // @ts-expect-error exercising the runtime guard
    expect(parseCustomerQr(undefined)).toBeNull();
  });

  it('reads snake_case subscription_code from a JSON object', () => {
    expect(parseCustomerQr('{"subscription_code":"SUB-9"}')).toEqual({
      subscriptionCode: 'SUB-9',
    });
  });

  it('reads camelCase subscriptionCode from a JSON object', () => {
    expect(parseCustomerQr('{"subscriptionCode":"SUB-9"}')).toEqual({
      subscriptionCode: 'SUB-9',
    });
  });

  it('reads a nested subscription.code', () => {
    expect(parseCustomerQr('{"subscription":{"code":"SUB-9"}}')).toEqual({
      subscriptionCode: 'SUB-9',
    });
  });

  it('extracts optional name, phone and customer id', () => {
    const json = JSON.stringify({
      subscription_code: 'SUB-9',
      name: 'Jane Doe',
      phone: '+254700000000',
      customer_id: 42,
    });
    expect(parseCustomerQr(json)).toEqual({
      subscriptionCode: 'SUB-9',
      name: 'Jane Doe',
      phone: '+254700000000',
      customerId: '42',
    });
  });

  it('honors customer_name / customer_phone / customer.id aliases', () => {
    const json = JSON.stringify({
      subscriptionCode: 'SUB-9',
      customer_name: 'Jane',
      customer_phone: '0700',
      customer: { id: 'cust-7' },
    });
    expect(parseCustomerQr(json)).toEqual({
      subscriptionCode: 'SUB-9',
      name: 'Jane',
      phone: '0700',
      customerId: 'cust-7',
    });
  });

  it('returns null for a JSON object with no recognizable subscription field', () => {
    expect(parseCustomerQr('{"foo":"bar"}')).toBeNull();
  });

  it('falls through an empty subscription_code to a populated alias (|| parity with swap)', () => {
    expect(parseCustomerQr('{"subscription_code":"","subscriptionCode":"SUB-9"}')).toEqual({
      subscriptionCode: 'SUB-9',
    });
  });

  it('falls back to the raw text when JSON is malformed', () => {
    // Looks like JSON but is broken → treat the whole string as the code.
    expect(parseCustomerQr('{not json')).toEqual({ subscriptionCode: '{not json' });
  });

  it('omits blank optional fields rather than returning empty strings', () => {
    const json = JSON.stringify({ subscription_code: 'SUB-9', name: '', phone: '' });
    expect(parseCustomerQr(json)).toEqual({ subscriptionCode: 'SUB-9' });
  });
});
