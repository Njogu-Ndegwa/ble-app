import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  decodeCharacteristicValue,
  extractProductType,
  learnGattMap,
  loadGattMap,
  forgetGattMap,
  fastReadByNames,
} from '../bleFastRead';
import { extractEnergyFromDta } from '../energyUtils';

// ---------------------------------------------------------------------------
// localStorage + WebViewJavascriptBridge stand-ins (vitest runs in node env)
// ---------------------------------------------------------------------------

function installLocalStorage() {
  const store = new Map<string, string>();
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  };
}

/** Real payloads recorded from an OVES S-6 over the bridge on 2026-08-06. */
const DTA_SERVICE_UUID = '9b074000-d1ec-4451-be62-f86a05dd9b47';
const ATT_SERVICE_UUID = '9b071000-d1ec-4451-be62-f86a05dd9b47';

const DTA_SERVICE_READ = {
  uuid: DTA_SERVICE_UUID,
  serviceNameEnum: 'DTA_SERVICE',
  characteristicList: [
    { name: 'rcap', uuid: '9b074008-d1ec-4451-be62-f86a05dd9b47', valType: 0, serviceUuid: DTA_SERVICE_UUID, realVal: 0 },
    { name: 'fccp', uuid: '9b074009-d1ec-4451-be62-f86a05dd9b47', valType: 0, serviceUuid: DTA_SERVICE_UUID, realVal: 0 },
    { name: 'pckv', uuid: '9b074005-d1ec-4451-be62-f86a05dd9b47', valType: 2, serviceUuid: DTA_SERVICE_UUID, realVal: 0 },
    { name: 'rsoc', uuid: '9b074007-d1ec-4451-be62-f86a05dd9b47', valType: 0, serviceUuid: DTA_SERVICE_UUID, realVal: 0 },
    // A characteristic whose name the device never reported - must not be cached
    { uuid: '9b07401f-d1ec-4451-be62-f86a05dd9b47', valType: 5, serviceUuid: DTA_SERVICE_UUID },
  ],
};

const ATT_SERVICE_READ = {
  uuid: ATT_SERVICE_UUID,
  serviceNameEnum: 'ATT_SERVICE',
  characteristicList: [
    { name: 'opid', uuid: '9b071001-d1ec-4451-be62-f86a05dd9b47', valType: 5, serviceUuid: ATT_SERVICE_UUID, realVal: '' },
    { name: 'ppid', uuid: '9b071002-d1ec-4451-be62-f86a05dd9b47', valType: 5, serviceUuid: ATT_SERVICE_UUID, realVal: '' },
  ],
};

/** Wires a bridge whose readBleCharacteristic answers from `values` by UUID. */
function installBridge(valuesByUuid: Record<string, number[] | 'fail'>) {
  const calls: string[] = [];
  (globalThis as unknown as { window: Record<string, unknown> }).window.WebViewJavascriptBridge = {
    callHandler: (
      handler: string,
      data: { characteristicUUID: string },
      cb: (resp: string) => void
    ) => {
      calls.push(handler + ':' + data.characteristicUUID);
      const v = valuesByUuid[data.characteristicUUID];
      if (v === 'fail' || v === undefined) {
        cb(JSON.stringify({ respCode: '8', respData: false, respDesc: 'not connected' }));
        return;
      }
      // A fresh connection returns raw bytes with no realVal and no valType,
      // exactly as observed on device.
      cb(JSON.stringify({ respCode: '200', respData: { values: v }, respDesc: 'Execution successful' }));
    },
  };
  return calls;
}

const le16 = (n: number) => [n & 0xff, (n >> 8) & 0xff];
const le32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];

beforeEach(() => {
  installLocalStorage();
});

// ---------------------------------------------------------------------------

describe('extractProductType', () => {
  it('takes the second word, as the native ProductTypeConfigManager does', () => {
    expect(extractProductType('OVES BATT 45AH 001094')).toBe('BATT');
    expect(extractProductType('OVES S-6  900001')).toBe('S-6');
    expect(extractProductType('OVES HOME 001094')).toBe('HOME');
  });

  it('is null for anything that is not an OVES device', () => {
    expect(extractProductType('Galaxy Buds')).toBeNull();
    expect(extractProductType('OVES')).toBeNull();
    expect(extractProductType('')).toBeNull();
    expect(extractProductType(null)).toBeNull();
  });
});

describe('decodeCharacteristicValue', () => {
  it('decodes int16 little-endian (valType 0/1)', () => {
    expect(decodeCharacteristicValue(le16(15290), 0)).toBe(15290);
    expect(decodeCharacteristicValue(le16(15290), 1)).toBe(15290);
  });

  it('keeps int16 signed so the existing wrap correction still applies', () => {
    // 40000 mAh wraps to -25536 in the native layer; extractEnergyFromDta adds
    // 65536 back. Decoding as unsigned here would double-correct it.
    expect(decodeCharacteristicValue(le16(40000), 0)).toBe(-25536);
    const energy = extractEnergyFromDta({
      characteristicList: [
        { name: 'rcap', realVal: decodeCharacteristicValue(le16(40000), 0) as number },
        { name: 'pckv', realVal: 75470 },
      ],
    });
    expect(energy?.energy).toBeCloseTo((40000 * 75470) / 1e6, 2);
  });

  it('decodes int32 little-endian (valType 2/3)', () => {
    expect(decodeCharacteristicValue(le32(75470), 2)).toBe(75470);
    expect(decodeCharacteristicValue(le32(3_000_000_000), 2)).toBe(3_000_000_000 - 0x100000000);
  });

  it('decodes ASCII strings and drops padding NULs (valType 5)', () => {
    const bytes = [...'BO723025100050'].map((c) => c.charCodeAt(0)).concat([0, 0, 0, 0]);
    expect(decodeCharacteristicValue(bytes, 5)).toBe('BO723025100050');
  });

  it('returns null rather than a wrong number for unusable input', () => {
    expect(decodeCharacteristicValue([1], 0)).toBeNull();       // too short for int16
    expect(decodeCharacteristicValue([1, 2], 2)).toBeNull();    // too short for int32
    expect(decodeCharacteristicValue([1, 2], 4)).toBeNull();    // native returns null for type 4
    expect(decodeCharacteristicValue([], 0)).toBeNull();
    expect(decodeCharacteristicValue(le16(5), null)).toBeNull();
    expect(decodeCharacteristicValue(le16(5), 99)).toBeNull();  // unknown type
  });
});

describe('learnGattMap', () => {
  it('records name -> uuid/valType per product type and merges across services', () => {
    learnGattMap('S-6', DTA_SERVICE_READ);
    learnGattMap('S-6', ATT_SERVICE_READ);

    const map = loadGattMap('S-6')!;
    expect(Object.keys(map).sort()).toEqual(['fccp', 'opid', 'pckv', 'ppid', 'rcap', 'rsoc']);
    expect(map.rcap).toEqual({
      serviceUuid: DTA_SERVICE_UUID,
      uuid: '9b074008-d1ec-4451-be62-f86a05dd9b47',
      valType: 0,
    });
    expect(map.opid.serviceUuid).toBe(ATT_SERVICE_UUID);
  });

  it('ignores characteristics with no name, and other product types stay separate', () => {
    learnGattMap('S-6', DTA_SERVICE_READ);
    expect(Object.keys(loadGattMap('S-6')!)).not.toContain(undefined);
    expect(loadGattMap('BATT')).toBeNull();
  });

  it('is a no-op for unusable input', () => {
    learnGattMap(null, DTA_SERVICE_READ);
    learnGattMap('S-6', null);
    learnGattMap('S-6', { characteristicList: 'nope' });
    expect(loadGattMap('S-6')).toBeNull();
  });

  it('forgetGattMap drops only the named product type', () => {
    learnGattMap('S-6', DTA_SERVICE_READ);
    learnGattMap('BATT', ATT_SERVICE_READ);
    forgetGattMap('S-6');
    expect(loadGattMap('S-6')).toBeNull();
    expect(loadGattMap('BATT')).not.toBeNull();
  });
});

describe('fastReadByNames', () => {
  it('returns null when nothing has been learned yet, so the caller falls back', async () => {
    installBridge({});
    expect(await fastReadByNames('AA:BB', 'S-6')).toBeNull();
  });

  it('reads only the requested characteristics and decodes them', async () => {
    learnGattMap('S-6', DTA_SERVICE_READ);
    learnGattMap('S-6', ATT_SERVICE_READ);
    const calls = installBridge({
      '9b074008-d1ec-4451-be62-f86a05dd9b47': le16(15290),   // rcap
      '9b074009-d1ec-4451-be62-f86a05dd9b47': le16(20000),   // fccp
      '9b074005-d1ec-4451-be62-f86a05dd9b47': le32(75470),   // pckv
      '9b074007-d1ec-4451-be62-f86a05dd9b47': le16(76),      // rsoc
      '9b071001-d1ec-4451-be62-f86a05dd9b47': [...'BO7230251'].map((c) => c.charCodeAt(0)),
      '9b071002-d1ec-4451-be62-f86a05dd9b47': [0, 0],
    });

    const result = await fastReadByNames('AA:BB', 'S-6');
    expect(result).not.toBeNull();

    // Six reads, not the 37 the whole-service path would issue
    expect(calls).toHaveLength(6);

    const energy = extractEnergyFromDta({ characteristicList: result!.characteristicList });
    expect(energy?.energy).toBeCloseTo((15290 * 75470) / 1e6, 2);
    expect(energy?.chargePercent).toBe(76); // 15290/20000
  });

  it('tolerates a missing optional value but still returns energy', async () => {
    learnGattMap('S-6', DTA_SERVICE_READ);
    learnGattMap('S-6', ATT_SERVICE_READ);
    installBridge({
      '9b074008-d1ec-4451-be62-f86a05dd9b47': le16(15290),
      '9b074009-d1ec-4451-be62-f86a05dd9b47': le16(20000),
      '9b074005-d1ec-4451-be62-f86a05dd9b47': le32(75470),
      '9b074007-d1ec-4451-be62-f86a05dd9b47': le16(76),
      '9b071001-d1ec-4451-be62-f86a05dd9b47': 'fail',   // opid unreadable
      '9b071002-d1ec-4451-be62-f86a05dd9b47': 'fail',   // ppid unreadable
    });

    const result = await fastReadByNames('AA:BB', 'S-6');
    expect(result).not.toBeNull();
    expect(result!.missing.sort()).toEqual(['opid', 'ppid']);
    expect(extractEnergyFromDta({ characteristicList: result!.characteristicList })).not.toBeNull();
  });

  it('returns null when a required energy value cannot be read', async () => {
    learnGattMap('S-6', DTA_SERVICE_READ);
    installBridge({
      '9b074008-d1ec-4451-be62-f86a05dd9b47': 'fail',   // rcap is required
      '9b074009-d1ec-4451-be62-f86a05dd9b47': le16(20000),
      '9b074005-d1ec-4451-be62-f86a05dd9b47': le32(75470),
      '9b074007-d1ec-4451-be62-f86a05dd9b47': le16(76),
    });
    expect(await fastReadByNames('AA:BB', 'S-6')).toBeNull();
  });

  it('returns null when a required name was never learned', async () => {
    // Learn ATT only - no rcap/pckv anywhere in the map
    learnGattMap('S-6', ATT_SERVICE_READ);
    installBridge({});
    expect(await fastReadByNames('AA:BB', 'S-6')).toBeNull();
  });

  it('prefers a realVal the native layer already decoded', async () => {
    learnGattMap('S-6', DTA_SERVICE_READ);
    (globalThis as unknown as { window: Record<string, unknown> }).window.WebViewJavascriptBridge = {
      callHandler: (_h: string, _d: unknown, cb: (r: string) => void) =>
        cb(JSON.stringify({ respCode: '200', respData: { realVal: 4242, values: le16(1) } })),
    };
    const result = await fastReadByNames('AA:BB', 'S-6', ['rcap', 'pckv']);
    expect(result!.characteristicList.map((c) => c.realVal)).toEqual([4242, 4242]);
  });

  it('does not hang when the bridge never calls back', async () => {
    vi.useFakeTimers();
    try {
      learnGattMap('S-6', DTA_SERVICE_READ);
      (globalThis as unknown as { window: Record<string, unknown> }).window.WebViewJavascriptBridge = {
        callHandler: () => { /* silence, as a wedged native layer would give */ },
      };
      const pending = fastReadByNames('AA:BB', 'S-6', ['rcap']);
      await vi.advanceTimersByTimeAsync(5000);
      expect(await pending).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
