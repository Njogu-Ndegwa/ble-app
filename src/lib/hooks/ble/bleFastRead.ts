'use client';

/**
 * bleFastRead - Targeted BLE characteristic reads
 *
 * WHY THIS EXISTS
 * ---------------
 * The normal path (`initServiceBleData`) makes the native layer read *every*
 * characteristic in a service, plus every descriptor on each one, serially.
 * Measured on a real device: the DTA service is 32 characteristics at ~136 ms
 * each (~4.6 s), and ATT adds another ~3.5 s — to obtain the five values the
 * swap/activator flows actually use (opid, rcap, fccp, pckv, rsoc).
 *
 * `readBleCharacteristic` reads one characteristic by UUID in ~75 ms and works
 * on a fresh connection with no service read first. Reading the five we need
 * costs ~0.4 s instead of ~8 s.
 *
 * The catch is that a targeted read needs the characteristic's UUID and its
 * valType, and those are only learned from a full service read (valType comes
 * from the 0x2901 descriptor). So we learn the GATT layout once per product
 * type, cache it in localStorage, and use the fast path from then on. Anything
 * missing or failing falls back to the old whole-service read, which also
 * re-learns the map — so a firmware change that moves a characteristic heals
 * itself on the next scan.
 */

import type { DtaCharacteristic } from './types';

// ============================================
// TYPES
// ============================================

export interface GattCharRef {
  serviceUuid: string;
  uuid: string;
  /** Native DataConvert type tag; null when the device never reported one */
  valType: number | null;
}

/** name (lowercased) -> where to find it and how to decode it */
export type GattMap = Record<string, GattCharRef>;

export interface FastReadResult {
  /** Same shape the service-read path produces, so the existing extractors work unchanged */
  characteristicList: DtaCharacteristic[];
  /** Names that could not be read */
  missing: string[];
}

// ============================================
// CONSTANTS
// ============================================

const STORAGE_KEY = 'oves.bleGattMap.v1';
const READ_TIMEOUT = 4000;

/** Characteristics the swap / activator flows need: ATT identity + DTA energy */
export const BATTERY_READ_NAMES = ['opid', 'ppid', 'rcap', 'fccp', 'pckv', 'rsoc'];

/** Without these there is no point returning a result — the caller must fall back */
export const REQUIRED_ENERGY_NAMES = ['rcap', 'pckv'];

// ============================================
// PRODUCT TYPE
// ============================================

/**
 * Mirror of the native ProductTypeConfigManager.extractProductType:
 * "OVES BATT 45AH 001094" -> "BATT", "OVES S-6 900001" -> "S-6".
 * The GATT layout is a property of the product type, not the individual unit.
 */
export function extractProductType(deviceName: string | null | undefined): string | null {
  if (!deviceName) return null;
  const trimmed = deviceName.trim();
  if (!trimmed.startsWith('OVES ')) return null;
  const parts = trimmed.split(/\s+/);
  return parts.length >= 2 ? parts[1].toUpperCase() : null;
}

// ============================================
// PERSISTENCE
// ============================================

type Store = Record<string, GattMap>;

function readStore(): Store {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}') as Store;
  } catch {
    return {};
  }
}

function writeStore(store: Store): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Quota or private mode - the fast path is an optimisation, not a requirement
  }
}

export function loadGattMap(productType: string | null): GattMap | null {
  if (!productType) return null;
  return readStore()[productType] || null;
}

/**
 * Merge a completed service read into the cached map for this product type.
 * Safe to call on every service read; only entries carrying a usable name are kept.
 */
export function learnGattMap(productType: string | null, serviceData: unknown): void {
  if (!productType) return;

  const data = serviceData as {
    uuid?: string;
    characteristicList?: Array<{ name?: string; uuid?: string; valType?: number; serviceUuid?: string }>;
  };
  if (!data || !Array.isArray(data.characteristicList)) return;

  const store = readStore();
  const map: GattMap = { ...(store[productType] || {}) };
  let learned = 0;

  for (const char of data.characteristicList) {
    const name = char?.name?.toLowerCase();
    const uuid = char?.uuid;
    if (!name || !uuid) continue;
    const serviceUuid = char.serviceUuid || data.uuid;
    if (!serviceUuid) continue;
    map[name] = {
      serviceUuid,
      uuid,
      valType: typeof char.valType === 'number' ? char.valType : null,
    };
    learned++;
  }

  if (learned > 0) {
    store[productType] = map;
    writeStore(store);
  }
}

export function forgetGattMap(productType: string | null): void {
  if (!productType) return;
  const store = readStore();
  if (store[productType]) {
    delete store[productType];
    writeStore(store);
  }
}

// ============================================
// VALUE DECODING
// ============================================

/**
 * Mirror of the native DataConvert.convert2Obj. On a fresh connection the native
 * layer does not know the valType (it comes from a descriptor read it has not
 * done), so it returns raw `values` with realVal null — we decode here instead.
 *
 * Types 0/1 are signed little-endian int16, 2/3 signed little-endian int32,
 * 5 an ASCII string. Signedness is preserved deliberately: extractEnergyFromDta
 * already compensates for the int16 wrap on rcap/fccp, and changing the sign
 * here would double-correct it.
 */
export function decodeCharacteristicValue(
  values: number[] | null | undefined,
  valType: number | null | undefined
): string | number | null {
  if (!Array.isArray(values) || values.length === 0 || valType == null) return null;

  const bytes = values.map((v) => v & 0xff);

  switch (valType) {
    case 0:
    case 1: {
      if (bytes.length < 2) return null;
      const raw = bytes[0] | (bytes[1] << 8);
      return raw > 0x7fff ? raw - 0x10000 : raw;
    }
    case 2:
    case 3: {
      if (bytes.length < 4) return null;
      // >>> 0 then sign-correct, to avoid JS bitwise-OR sign surprises
      const raw = ((bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24)) >>> 0);
      return raw > 0x7fffffff ? raw - 0x100000000 : raw;
    }
    case 4:
      return null;
    case 5:
      return String.fromCharCode(...bytes.filter((b) => b !== 0)).trim();
    default:
      return null;
  }
}

// ============================================
// BRIDGE READ
// ============================================

interface RawCharResponse {
  respCode?: string;
  respData?: { name?: string; realVal?: unknown; valType?: number; values?: number[] } | false;
  respDesc?: string;
}

function readOneByUuid(
  macAddress: string,
  ref: GattCharRef
): Promise<RawCharResponse | null> {
  return new Promise((resolve) => {
    const bridge = window.WebViewJavascriptBridge;
    if (!bridge) return resolve(null);

    let settled = false;
    const done = (v: RawCharResponse | null) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    const timer = setTimeout(() => done(null), READ_TIMEOUT);

    bridge.callHandler(
      'readBleCharacteristic',
      { serviceUUID: ref.serviceUuid, characteristicUUID: ref.uuid, macAddress },
      (responseData: unknown) => {
        clearTimeout(timer);
        try {
          done(typeof responseData === 'string' ? JSON.parse(responseData) : (responseData as RawCharResponse));
        } catch {
          done(null);
        }
      }
    );
  });
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Read the named characteristics directly by UUID.
 *
 * Returns null when the fast path is not usable (no cached map, or a required
 * value could not be read) — the caller must then fall back to the whole-service
 * read. Reads are issued one at a time: Android permits only one outstanding
 * GATT operation, and overlapping them fails silently.
 */
export async function fastReadByNames(
  macAddress: string,
  productType: string | null,
  names: string[] = BATTERY_READ_NAMES,
  requiredNames: string[] = REQUIRED_ENERGY_NAMES
): Promise<FastReadResult | null> {
  const map = loadGattMap(productType);
  if (!map) return null;

  // Every required name must be locatable before we commit to this path
  if (requiredNames.some((n) => !map[n.toLowerCase()])) return null;

  const characteristicList: DtaCharacteristic[] = [];
  const missing: string[] = [];

  for (const name of names) {
    const key = name.toLowerCase();
    const ref = map[key];
    if (!ref) {
      missing.push(name);
      continue;
    }

    const resp = await readOneByUuid(macAddress, ref);
    const data = resp && resp.respData ? resp.respData : null;

    if (!data || resp?.respCode !== '200') {
      missing.push(name);
      continue;
    }

    // The native layer fills realVal only when it already knows the valType;
    // on a fresh connection it does not, so decode the raw bytes ourselves.
    const realVal =
      data.realVal !== null && data.realVal !== undefined && data.realVal !== ''
        ? (data.realVal as string | number)
        : decodeCharacteristicValue(data.values, ref.valType ?? data.valType ?? null);

    if (realVal === null) {
      missing.push(name);
      continue;
    }

    characteristicList.push({ name: key, realVal } as DtaCharacteristic);
  }

  if (requiredNames.some((n) => missing.includes(n))) return null;

  return { characteristicList, missing };
}
