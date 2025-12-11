/**
 * Swap Payment Calculation Utilities
 * 
 * This module contains the core payment calculation logic for battery swaps.
 * It calculates energy differences, quota deductions, and final costs using
 * a consistent rounding strategy.
 * 
 * CALCULATION STEPS (Single Source of Truth):
 * 1. Power Differential: floor(energyDiff) to 2dp - ONLY rounding point for energy
 * 2. Quota to Apply: min(availableQuota, powerDifferential) - as-is from backend
 * 3. Chargeable Energy: powerDifferential - quotaToApply - NO rounding
 * 4. Cost to Report: chargeableEnergy × rate - round UP if >2dp
 * 
 * Customer pays: floor(cost) - done at display/payment time
 */

// ============================================
// TYPES
// ============================================

export interface SwapPaymentInput {
  /** New battery energy in Wh */
  newBatteryEnergyWh: number;
  /** Old battery energy in Wh */
  oldBatteryEnergyWh: number;
  /** Rate per kWh from electricity service */
  ratePerKwh: number;
  /** Total energy quota available (kWh) */
  quotaTotal?: number;
  /** Energy quota already used (kWh) */
  quotaUsed?: number;
}

export interface SwapPaymentResult {
  // === ENERGY VALUES (kWh) ===
  /** Step 1: Power differential = floor(newEnergy - oldEnergy) to 2dp (ONLY rounding point) */
  energyDiff: number;
  /** Step 2: Quota to apply = min(availableQuota, energyDiff) - use as-is */
  quotaDeduction: number;
  /** Step 3: Actual energy to pay = (energyDiff - quotaDeduction) - NO rounding */
  chargeableEnergy: number;
  
  // === MONETARY VALUES ===
  /** energyDiff × rate (round UP if >2dp) - for display */
  grossEnergyCost: number;
  /** quotaDeduction × rate (as-is, inputs already 2dp) - for display */
  quotaCreditValue: number;
  /** Step 4: Cost to report = chargeableEnergy × rate (round UP if >2dp) */
  cost: number;
}

// ============================================
// ROUNDING HELPERS
// ============================================

/**
 * Round down (floor) to 2 decimal places
 * Used for: Power differential (Step 1)
 */
function floorTo2dp(value: number): number {
  return Math.floor(value * 100) / 100;
}

/**
 * Round to 2 decimal places (standard rounding)
 */
function roundTo2dp(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Round UP to 2 decimal places if value has more than 2dp, otherwise use standard rounding
 * Used for: Cost calculations (Step 4)
 */
function ceilIfMoreThan2dp(value: number): number {
  const rounded = roundTo2dp(value);
  const hasMoreThan2dp = Math.abs(value - rounded) > 0.0000001;
  return hasMoreThan2dp ? Math.ceil(value * 100) / 100 : rounded;
}

// ============================================
// MAIN CALCULATION FUNCTION
// ============================================

/**
 * Calculate swap payment details
 * 
 * This is the single source of truth for all swap payment calculations.
 * All energy and monetary values should come from this function.
 * 
 * @param input - The input parameters for the calculation
 * @returns Complete payment calculation result
 * 
 * @example
 * ```typescript
 * const result = calculateSwapPayment({
 *   newBatteryEnergyWh: 1500,
 *   oldBatteryEnergyWh: 500,
 *   ratePerKwh: 25,
 *   quotaTotal: 10,
 *   quotaUsed: 8,
 * });
 * 
 * console.log(`Energy diff: ${result.energyDiff} kWh`);
 * console.log(`Cost: ${result.cost}`);
 * ```
 */
export function calculateSwapPayment(input: SwapPaymentInput): SwapPaymentResult {
  const {
    newBatteryEnergyWh,
    oldBatteryEnergyWh,
    ratePerKwh,
    quotaTotal = 0,
    quotaUsed = 0,
  } = input;

  // === STEP 1: Power Differential (ONLY rounding point for energy) ===
  // Round DOWN to 2dp - this is the single source of truth for energy
  const energyDiffWh = newBatteryEnergyWh - oldBatteryEnergyWh;
  const powerDifferential = floorTo2dp(energyDiffWh / 1000);

  // === STEP 2: Available Quota (use as-is from backend - already 2dp) ===
  const availableQuota = Math.max(0, quotaTotal - quotaUsed);

  // Quota to apply: min of available quota and power differential
  // Use as-is, no rounding (backend values are already 2dp)
  const quotaToApply = powerDifferential > 0
    ? Math.min(availableQuota, powerDifferential)
    : 0;

  // === STEP 3: Actual Energy to Pay For (DON'T round) ===
  const actualEnergyToPay = Math.max(0, powerDifferential - quotaToApply);

  // === STEP 4: Cost to Report ===
  // If more than 2dp, round UP to nearest 2dp, otherwise use standard rounding
  const costRaw = actualEnergyToPay * ratePerKwh;
  const costToReport = ceilIfMoreThan2dp(costRaw);

  // === MONETARY VALUES FOR DISPLAY (Single Source of Truth) ===
  // Gross energy cost: powerDifferential × rate (round UP if >2dp)
  const grossCostRaw = powerDifferential * ratePerKwh;
  const grossEnergyCost = ceilIfMoreThan2dp(grossCostRaw);

  // Quota credit value: quotaToApply × rate (use standard rounding, both inputs are 2dp max)
  const quotaCreditValue = roundTo2dp(quotaToApply * ratePerKwh);

  return {
    // Energy values
    energyDiff: powerDifferential,         // Step 1: floored to 2dp
    quotaDeduction: quotaToApply,          // Step 2: as-is (already 2dp)
    chargeableEnergy: actualEnergyToPay,   // Step 3: no rounding
    // Monetary values (single source of truth)
    grossEnergyCost,                       // For display
    quotaCreditValue,                      // For display
    cost: costToReport > 0 ? costToReport : 0,  // Step 4: round UP if >2dp
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get the display cost (floored for customer payment)
 * Customers can't pay decimals, so we floor the cost.
 * 
 * @param cost - The calculated cost
 * @returns Floored cost for display/payment
 * 
 * @example
 * ```typescript
 * const displayCost = getDisplayCost(20.54); // Returns 20
 * ```
 */
export function getDisplayCost(cost: number): number {
  return Math.floor(cost);
}

/**
 * Check if payment should be skipped
 * Payment is skipped when display cost is zero or negative
 * 
 * @param cost - The calculated cost
 * @returns true if payment should be skipped
 */
export function shouldSkipPayment(cost: number): boolean {
  return getDisplayCost(cost) <= 0;
}

/**
 * Check if customer has sufficient quota for free swap
 * 
 * @param quotaDeduction - Quota being applied
 * @param energyDiff - Total energy difference
 * @returns true if quota covers all energy
 */
export function hasSufficientQuota(quotaDeduction: number, energyDiff: number): boolean {
  return quotaDeduction >= energyDiff && energyDiff > 0;
}
