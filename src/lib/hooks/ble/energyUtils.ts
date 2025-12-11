/**
 * Energy Calculation Utilities
 * 
 * Functions for extracting and calculating energy data from BLE DTA service responses.
 * These are pure functions that can be used anywhere energy calculation is needed.
 */

import type { EnergyData, DtaServiceData, AttServiceData, BatteryData } from './types';

// ============================================
// DTA ENERGY EXTRACTION
// ============================================

/**
 * Extract energy data from DTA service response
 * 
 * DTA (Data Transfer & Access) service provides battery metrics:
 * - rcap: Remaining Capacity in mAh (milliamp-hours)
 * - fccp: Full Charge Capacity in mAh
 * - pckv: Pack Voltage in mV (millivolts)
 * - rsoc: Relative State of Charge (percentage)
 * 
 * Energy (Wh) = Capacity (mAh) × Voltage (mV) / 1,000,000
 * 
 * @param serviceData - The DTA service data from BLE
 * @returns Energy data or null if extraction fails
 * 
 * @example
 * const energyData = extractEnergyFromDta(dtaServiceData);
 * if (energyData) {
 *   console.log(`Battery: ${energyData.energy}Wh (${energyData.chargePercent}%)`);
 * }
 */
export function extractEnergyFromDta(serviceData: DtaServiceData | unknown): EnergyData | null {
  const data = serviceData as DtaServiceData;
  
  if (!data || !Array.isArray(data.characteristicList)) {
    return null;
  }

  // Helper to get characteristic value by name
  const getCharValue = (name: string): string | number | null => {
    const char = data.characteristicList.find(
      (c) => c.name?.toLowerCase() === name.toLowerCase()
    );
    return char?.realVal ?? null;
  };

  // Extract raw values
  const rcapRaw = getCharValue('rcap');  // Remaining Capacity in mAh
  const fccpRaw = getCharValue('fccp');  // Full Charge Capacity in mAh
  const pckvRaw = getCharValue('pckv');  // Pack Voltage in mV
  const rsocRaw = getCharValue('rsoc');  // Relative State of Charge (%)

  // Parse to numbers
  const rcap = rcapRaw !== null ? parseFloat(String(rcapRaw)) : NaN;
  const fccp = fccpRaw !== null ? parseFloat(String(fccpRaw)) : NaN;
  const pckv = pckvRaw !== null ? parseFloat(String(pckvRaw)) : NaN;
  const rsoc = rsocRaw !== null ? parseFloat(String(rsocRaw)) : NaN;

  // Validate required values
  if (!Number.isFinite(rcap) || !Number.isFinite(pckv)) {
    return null;
  }

  // Calculate energy: (mAh × mV) / 1,000,000 = Wh
  // Example: 15290 mAh × 75470 mV / 1,000,000 = 1,154 Wh = 1.15 kWh
  const energy = (rcap * pckv) / 1_000_000;
  const fullCapacity = Number.isFinite(fccp) ? (fccp * pckv) / 1_000_000 : 0;

  if (!Number.isFinite(energy)) {
    return null;
  }

  // Calculate charge percentage
  let chargePercent: number;
  if (Number.isFinite(fccp) && fccp > 0) {
    // Prefer calculated percentage from rcap/fccp
    chargePercent = Math.round((rcap / fccp) * 100);
  } else if (Number.isFinite(rsoc)) {
    // Fallback to rsoc from device
    chargePercent = Math.round(rsoc);
  } else {
    chargePercent = 0;
  }

  // Clamp to 0-100
  chargePercent = Math.max(0, Math.min(100, chargePercent));

  return {
    energy: Math.round(energy * 100) / 100, // Round to 2 decimal places
    fullCapacity: Math.round(fullCapacity * 100) / 100,
    chargePercent,
  };
}

// ============================================
// ATT BATTERY ID EXTRACTION
// ============================================

/**
 * Extract actual battery ID from ATT service response
 * 
 * ATT (Attribute Service) contains the actual battery identifier:
 * - opid: Operator ID (preferred - unique identifier)
 * - ppid: Product/Part ID (fallback)
 * 
 * This is the authoritative battery ID used for:
 * - record_service_and_payment endpoint
 * - Verifying battery ownership
 * - Display where battery ID is shown
 * 
 * @param serviceData - The ATT service data from BLE
 * @returns The actual battery ID (opid or ppid) or null if not found
 * 
 * @example
 * const actualBatteryId = extractActualBatteryIdFromAtt(attServiceData);
 * if (actualBatteryId) {
 *   console.log(`Actual Battery ID: ${actualBatteryId}`);
 * }
 */
export function extractActualBatteryIdFromAtt(serviceData: AttServiceData | unknown): string | null {
  const data = serviceData as AttServiceData;
  
  if (!data || !Array.isArray(data.characteristicList)) {
    return null;
  }

  // Helper to get characteristic value by name
  const getCharValue = (name: string): string | number | null => {
    const char = data.characteristicList.find(
      (c) => c.name?.toLowerCase() === name.toLowerCase()
    );
    return char?.realVal ?? null;
  };

  // Try opid first (preferred), then ppid as fallback
  const opid = getCharValue('opid');
  if (opid !== null && opid !== undefined && String(opid).trim() !== '') {
    return String(opid);
  }

  const ppid = getCharValue('ppid');
  if (ppid !== null && ppid !== undefined && String(ppid).trim() !== '') {
    return String(ppid);
  }

  return null;
}

// ============================================
// BATTERY DATA CREATION
// ============================================

/**
 * Create BatteryData from energy data and battery ID
 * 
 * @param batteryId - The battery identifier from QR code
 * @param energyData - The extracted energy data
 * @param macAddress - Optional MAC address of connected device
 * @param actualBatteryId - Optional actual battery ID from STS service (opid/ppid)
 * @returns Complete battery data object
 * 
 * @example
 * const battery = createBatteryData('BAT-12345', energyData, macAddress, 'OPID-12345');
 */
export function createBatteryData(
  batteryId: string,
  energyData: EnergyData,
  macAddress?: string,
  actualBatteryId?: string
): BatteryData {
  return {
    id: batteryId,
    shortId: String(batteryId),
    chargeLevel: energyData.chargePercent,
    energy: energyData.energy,
    macAddress,
    actualBatteryId,
  };
}

// ============================================
// QR CODE PARSING
// ============================================

/**
 * Parse battery ID from QR code data
 * 
 * Handles both JSON and plain string QR codes:
 * - JSON: { battery_id, sno, serial_number, id }
 * - Plain string: treated as the battery ID itself
 * 
 * @param qrData - Raw QR code data
 * @returns Extracted battery ID
 * 
 * @example
 * const id = parseBatteryIdFromQr('{"battery_id": "BAT-12345"}');
 * // Returns: "BAT-12345"
 * 
 * const id2 = parseBatteryIdFromQr('BAT-12345');
 * // Returns: "BAT-12345"
 */
export function parseBatteryIdFromQr(qrData: string): string {
  try {
    const parsed = JSON.parse(qrData);
    return (
      parsed.battery_id ||
      parsed.sno ||
      parsed.serial_number ||
      parsed.id ||
      qrData
    );
  } catch {
    // Not JSON, return as-is
    return qrData;
  }
}

/**
 * Parse MAC address from QR code data (if present)
 * 
 * @param qrData - Raw QR code data
 * @returns MAC address or null
 */
export function parseMacAddressFromQr(qrData: string): string | null {
  try {
    const parsed = JSON.parse(qrData);
    return parsed.mac_address || parsed.mac || parsed.macAddress || null;
  } catch {
    return null;
  }
}

// ============================================
// ENERGY CALCULATIONS
// ============================================

/**
 * Calculate energy difference between two batteries
 * 
 * @param newEnergy - New battery energy in Wh
 * @param oldEnergy - Old battery energy in Wh
 * @returns Energy difference in kWh (positive if new > old)
 */
export function calculateEnergyDiff(newEnergy: number, oldEnergy: number): number {
  const diffWh = newEnergy - oldEnergy;
  const diffKwh = diffWh / 1000;
  return Math.round(diffKwh * 1000) / 1000; // 3 decimal places
}

/**
 * Calculate swap cost based on energy difference and rate
 * 
 * @param energyDiffKwh - Energy difference in kWh
 * @param ratePerKwh - Rate per kWh
 * @param quotaKwh - Available quota in kWh (will be deducted first)
 * @returns Cost calculation result
 */
export function calculateSwapCost(
  energyDiffKwh: number,
  ratePerKwh: number,
  quotaKwh: number = 0
): {
  quotaDeduction: number;
  chargeableEnergy: number;
  cost: number;
} {
  // Only apply quota if energy diff is positive
  const quotaDeduction = energyDiffKwh > 0
    ? Math.min(quotaKwh, energyDiffKwh)
    : 0;
  
  // Chargeable energy after quota
  const chargeableEnergy = Math.max(0, energyDiffKwh - quotaDeduction);
  
  // Calculate cost
  const cost = Math.round(chargeableEnergy * ratePerKwh * 100) / 100;
  
  return {
    quotaDeduction: Math.round(quotaDeduction * 1000) / 1000,
    chargeableEnergy: Math.round(chargeableEnergy * 1000) / 1000,
    cost: cost > 0 ? cost : 0,
  };
}

// ============================================
// FORMATTING UTILITIES
// ============================================

/**
 * Format energy in kWh for display
 * 
 * @param energyWh - Energy in Watt-hours
 * @param decimals - Decimal places (default: 3)
 * @returns Formatted string like "1.234 kWh"
 */
export function formatEnergyKwh(energyWh: number, decimals: number = 3): string {
  const kwh = energyWh / 1000;
  return `${kwh.toFixed(decimals)} kWh`;
}

/**
 * Format energy in Wh for display
 * 
 * @param energyWh - Energy in Watt-hours
 * @param decimals - Decimal places (default: 2)
 * @returns Formatted string like "1234.56 Wh"
 */
export function formatEnergyWh(energyWh: number, decimals: number = 2): string {
  return `${energyWh.toFixed(decimals)} Wh`;
}

/**
 * Format charge percentage for display
 * 
 * @param percent - Charge percentage 0-100
 * @returns Formatted string like "85%"
 */
export function formatChargePercent(percent: number): string {
  return `${Math.round(percent)}%`;
}
