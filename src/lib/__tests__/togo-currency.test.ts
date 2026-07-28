import { describe, it, expect } from 'vitest';

// Mirrors isTogoCurrency in EnergyTopUpModal. The Mixx by Yas / Flooz USSD
// codes are Togo merchant rails; they used to render for every rider, so a
// Kenyan rider was told to pay a Togo merchant.
//
// The gate keys on the plan's own currency because that is the one field that
// stayed correct for the rider who surfaced this: plan 631499 had currency KES
// while its *terms* (terms-togo-7day-standard-001) and *template* ("Togo Lome
// 1 Year Template MobBat30AH") were both Togo. Gating on terms or template
// would have kept showing Togo rails to that Kenyan rider.
const isTogoCurrency = (cur?: string): boolean =>
  /^(XOF|CFA)$/i.test((cur || '').trim());

describe('isTogoCurrency — decides whether Togo payment rails are shown', () => {
  it('shows the rails for Togo riders', () => {
    // The backend stores the CFA franc under both codes: 26 service plans as
    // XOF and 166 as CFA, so both must count as Togo.
    expect(isTogoCurrency('XOF')).toBe(true);
    expect(isTogoCurrency('CFA')).toBe(true);
    expect(isTogoCurrency('xof')).toBe(true);
    expect(isTogoCurrency(' CFA ')).toBe(true);
  });

  it('hides the rails for Kenya — the case that surfaced this bug', () => {
    expect(isTogoCurrency('KES')).toBe(false);
    expect(isTogoCurrency('KSh')).toBe(false);
    expect(isTogoCurrency('KSH')).toBe(false);
  });

  it('hides the rails for every other market', () => {
    expect(isTogoCurrency('USD')).toBe(false);
    expect(isTogoCurrency('CNY')).toBe(false);
    expect(isTogoCurrency('TZS')).toBe(false);
    expect(isTogoCurrency('UGX')).toBe(false);
  });

  it('hides the rails when the currency is unknown, rather than guessing', () => {
    expect(isTogoCurrency('')).toBe(false);
    expect(isTogoCurrency(undefined)).toBe(false);
    expect(isTogoCurrency('   ')).toBe(false);
  });

  it('does not match on a substring', () => {
    // Guard against a loose .includes() implementation.
    expect(isTogoCurrency('XOFX')).toBe(false);
    expect(isTogoCurrency('CFAB')).toBe(false);
  });
});
