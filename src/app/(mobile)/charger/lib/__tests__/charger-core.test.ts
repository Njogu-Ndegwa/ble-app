import { describe, it, expect, beforeEach } from 'vitest';
import {
  appendRecentCharge,
  assessWriteResponse,
  deriveWriteValue,
  loadRecentCharges,
  matchCharacteristic,
} from '../charger-core';
import type { GattCharacteristic } from '../types';

/** Minimal in-memory Storage stand-in. */
function memStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => { map.delete(k); },
    setItem: (k: string, v: string) => { map.set(k, v); },
  } as Storage;
}

const chars = (...names: string[]): GattCharacteristic[] =>
  names.map((name, i) => ({ name, uuid: `uuid-${i}-${name}` }));

describe('deriveWriteValue', () => {
  it('writes the plan quota in energy mode, ignoring any typed minutes', () => {
    expect(deriveWriteValue({ mode: 'energy', declaredKwh: 3, minutes: 99 })).toBe(3);
  });

  it('refuses energy mode when the plan declares no quota', () => {
    expect(() => deriveWriteValue({ mode: 'energy', declaredKwh: 0 })).toThrow();
  });

  it('writes the operator-entered minutes in time mode', () => {
    expect(deriveWriteValue({ mode: 'time', declaredKwh: 3, minutes: 10 })).toBe(10);
  });

  it.each([0, -5, NaN, null, undefined])('rejects %s minutes in time mode', (m) => {
    expect(() => deriveWriteValue({ mode: 'time', declaredKwh: 3, minutes: m as number })).toThrow();
  });
});

describe('matchCharacteristic', () => {
  it('auto-selects a single unambiguous time match', () => {
    const r = matchCharacteristic(chars('opid', 'chgtmr', 'chgengy'), 'time');
    expect(r.confident?.name).toBe('chgtmr');
    expect(r.ambiguous).toBe(false);
  });

  it('auto-selects a single unambiguous energy match', () => {
    const r = matchCharacteristic(chars('opid', 'chgtmr', 'chgengy'), 'energy');
    expect(r.confident?.name).toBe('chgengy');
    expect(r.ambiguous).toBe(false);
  });

  // The regression that matters: a limit register whose name also matches the
  // provisional heuristics must NOT be silently written to.
  it('refuses to pick when several characteristics match', () => {
    const r = matchCharacteristic(chars('vminlim', 'chgtmr'), 'time');
    expect(r.ambiguous).toBe(true);
    expect(r.confident).toBeUndefined();
    expect(r.matches.map((m) => m.name)).toEqual(['vminlim', 'chgtmr']);
  });

  it('reports no match rather than guessing', () => {
    const r = matchCharacteristic(chars('opid', 'rst'), 'energy');
    expect(r.confident).toBeUndefined();
    expect(r.ambiguous).toBe(false);
    expect(r.matches).toHaveLength(0);
  });
});

describe('assessWriteResponse', () => {
  it.each([
    ['{"respCode":"200","respData":true}', true],
    ['{"respCode":200}', true],
    ['{"respData":"success"}', true],
    ['{"success":true}', true],
    ['success', true],
    ['OK', true],
  ])('treats %s as success', (input, expected) => {
    expect(assessWriteResponse(input).ok).toBe(expected);
  });

  it.each([
    ['{"respCode":"500","respData":false}'],
    ['{"respCode":"11","respDesc":"device busy"}'],
    ['garbage'],
    [''],
    [null],
    [undefined],
  ])('treats %s as failure', (input) => {
    expect(assessWriteResponse(input as unknown).ok).toBe(false);
  });

  it('surfaces the device-reported reason', () => {
    expect(assessWriteResponse('{"respCode":"11","respDesc":"device busy"}').error).toBe('device busy');
  });
});

describe('recent charges', () => {
  let storage: Storage;
  beforeEach(() => { storage = memStorage(); });

  const entry = (reference: string, dispensed = true) => ({
    subscriptionCode: 'SUB-1',
    planName: 'B30 3kWh',
    mode: 'energy' as const,
    value: 3,
    kwhBilled: 3,
    chargerMac: 'C8:2E:18:11:22:33',
    reference,
    dispensed,
    timestamp: new Date().toISOString(),
  });

  it('stores newest first and de-duplicates by reference', () => {
    appendRecentCharge(entry('a'), storage);
    appendRecentCharge(entry('b'), storage);
    appendRecentCharge(entry('a', false), storage);
    const list = loadRecentCharges(storage);
    expect(list.map((e) => e.reference)).toEqual(['a', 'b']);
    expect(list[0].dispensed).toBe(false);
  });

  it('survives unparseable storage', () => {
    storage.setItem('charger-recent-v1', 'not json');
    expect(loadRecentCharges(storage)).toEqual([]);
  });
});
