import { describe, it, expect } from 'vitest';
import { processIdentificationResponse } from '../useCustomerIdentification';
import type { IdentifyCustomerResponse, IdentifyCustomerInputParams } from '@/lib';
import { PAYMENT } from '@/lib/constants';

/**
 * Pins for the identification transform — the single place a scanned customer
 * becomes billing state (currency, rate, quotas, type).
 *
 * The currency pins exist because this exact logic regressed three times in a
 * row without a test (a72a60c → bd9fdd2 → 402db79): the resolution chain
 * consulted common_terms, a shared contract-terms document that can belong to
 * a different region than the plan, so a Kenyan customer attached to Togo
 * terms read back "XOF" and two currencies appeared on one screen.
 */

const input: IdentifyCustomerInputParams = {
  subscriptionCode: 'SUB-001',
} as IdentifyCustomerInputParams;

/** A successful response whose metadata we vary per test. */
function respond(metadata: Record<string, unknown>): IdentifyCustomerResponse {
  return {
    customer_identified: true,
    signals: ['CUSTOMER_IDENTIFIED_SUCCESS'],
    metadata: JSON.stringify(metadata),
  } as IdentifyCustomerResponse;
}

function baseMetadata(overrides: Record<string, unknown> = {}) {
  return {
    customer_id: 'cust-123',
    service_plan_data: {
      servicePlanId: 'plan-1',
      customerId: 'cust-123',
      currency: 'XOF',
      serviceStates: [
        {
          service_id: 'service-energy-togo-001',
          quota: 100,
          used: 25,
        },
        {
          service_id: 'service-swap-count-togo-001',
          quota: 21,
          used: 3,
        },
      ],
      ...(overrides.service_plan_data as Record<string, unknown> | undefined),
    },
    service_bundle: {
      services: [
        { serviceId: 'service-energy-togo-001', name: 'Energy', usageUnitPrice: 150 },
      ],
    },
    ...overrides,
  };
}

describe('billing currency resolution', () => {
  it('uses the plan currency even when common_terms carries a different one', () => {
    // The three-fixes regression: terms say KES, plan says XOF. The plan is
    // the single source; terms must not leak onto the screen.
    const result = processIdentificationResponse(
      respond(baseMetadata({ common_terms: { currency: 'KES', name: 'Kenya terms' } })),
      input,
    );
    expect(result?.currencySymbol).toBe('XOF');
  });

  it('falls back to the default currency when the plan has none — never to the terms', () => {
    const meta = baseMetadata({ common_terms: { currency: 'KES' } });
    delete (meta.service_plan_data as Record<string, unknown>).currency;
    const result = processIdentificationResponse(respond(meta), input);
    expect(result?.currencySymbol).toBe(PAYMENT.defaultCurrency);
    expect(result?.currencySymbol).not.toBe('KES');
  });
});

describe('energy rate', () => {
  it('reads usageUnitPrice from the matched energy service', () => {
    const result = processIdentificationResponse(respond(baseMetadata()), input);
    expect(result?.rate).toBe(150);
  });

  it('is 0 when no energy service exists — Sales flow must retry, not guess', () => {
    const meta = baseMetadata();
    (meta.service_plan_data as { serviceStates: unknown[] }).serviceStates = [
      { service_id: 'service-swap-count-togo-001', quota: 21, used: 3 },
    ];
    const result = processIdentificationResponse(respond(meta), input);
    expect(result?.rate).toBe(0);
  });

  it('finds the energy service under both deployment naming families', () => {
    // Older Togo plans say "service-electricity", newer templates
    // "service-energy" — the split that has already broken grouping once.
    const meta = baseMetadata();
    (meta.service_plan_data as { serviceStates: { service_id: string }[] }).serviceStates[0]!
      .service_id = 'service-electricity-togo-4';
    (meta.service_bundle as { services: { serviceId: string }[] }).services[0]!
      .serviceId = 'service-electricity-togo-4';
    const result = processIdentificationResponse(respond(meta), input);
    expect(result?.rate).toBe(150);
  });
});

describe('customer type', () => {
  it('is returning when the battery fleet holds a current asset', () => {
    const meta = baseMetadata();
    (meta.service_plan_data as { serviceStates: unknown[] }).serviceStates.push({
      service_id: 'service-battery-fleet-togo-001',
      current_asset: 'BAT-42',
    });
    expect(processIdentificationResponse(respond(meta), input)?.customerType).toBe('returning');
  });

  it('is first-time otherwise', () => {
    expect(processIdentificationResponse(respond(baseMetadata()), input)?.customerType).toBe('first-time');
  });
});

describe('failure signals', () => {
  it.each([
    ['SERVICE_PLAN_NOT_FOUND', 'Customer not found. Please check the subscription ID.'],
    ['CUSTOMER_NOT_FOUND', 'Customer not found. Please check the subscription ID.'],
    ['INVALID_QR_CODE', 'Invalid QR code. Please scan a valid customer QR code.'],
    ['INVALID_SUBSCRIPTION_ID', 'Invalid subscription ID format.'],
  ])('maps %s to its user-facing message', (signal, message) => {
    const response = {
      customer_identified: false,
      signals: [signal],
      metadata: '{}',
    } as IdentifyCustomerResponse;
    expect(() => processIdentificationResponse(response, input)).toThrow(message);
  });

  it('throws on unparseable metadata even when signals claim success', () => {
    const response = {
      customer_identified: true,
      signals: ['CUSTOMER_IDENTIFIED_SUCCESS'],
      metadata: '{}',
    } as IdentifyCustomerResponse;
    expect(() => processIdentificationResponse(response, input)).toThrow('Invalid customer data received');
  });
});

describe('idempotent (cached) responses', () => {
  it('treats IDEMPOTENT_OPERATION_DETECTED as success and flags it', () => {
    const response = {
      customer_identified: true,
      signals: ['IDEMPOTENT_OPERATION_DETECTED'],
      metadata: JSON.stringify(baseMetadata()),
    } as IdentifyCustomerResponse;
    const result = processIdentificationResponse(response, input);
    expect(result?.isIdempotent).toBe(true);
    expect(result?.customer.id).toBe('cust-123');
  });
});
