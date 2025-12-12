'use client';

/**
 * BLE Error Handling Utilities
 * 
 * Centralized error handling for all BLE native layer responses.
 * This provides a systematic way to parse, categorize, and handle
 * all error responses from the native BLE layer.
 * 
 * Usage:
 *   const result = parseBleResponse(responseData);
 *   if (!result.success) {
 *     // Handle error using result.error
 *   }
 */

// ============================================
// ERROR CODES
// ============================================

/**
 * Known BLE response codes from native layer
 * Add new codes here as they are discovered
 */
export const BLE_RESP_CODES = {
  SUCCESS: '200',
  // Connection errors
  DEVICE_NOT_CONNECTED: '8',
  MAC_ADDRESS_MISMATCH: '7',
  // Add more codes as discovered
} as const;

// ============================================
// ERROR CATEGORIES
// ============================================

/**
 * Error categories determine how the error should be handled
 */
export type BleErrorCategory = 
  | 'connection_lost'      // Device disconnected during operation
  | 'mac_mismatch'         // Native layer has wrong MAC cached
  | 'bluetooth_off'        // Bluetooth is disabled
  | 'timeout'              // Operation timed out
  | 'parse_error'          // Failed to parse response
  | 'service_error'        // Service-level error
  | 'unknown';             // Unknown error

/**
 * Parsed BLE error with categorization
 */
export interface BleError {
  /** Error category for handling decisions */
  category: BleErrorCategory;
  /** Human-readable error message */
  message: string;
  /** Whether user needs to toggle Bluetooth off/on */
  requiresBluetoothReset: boolean;
  /** Original response code from native layer */
  respCode?: string;
  /** Original description from native layer */
  respDesc?: string;
  /** Raw response data for debugging */
  rawResponse?: unknown;
}

/**
 * Result of parsing a BLE response
 */
export interface BleResponseResult {
  /** Whether the operation was successful */
  success: boolean;
  /** Error details if not successful */
  error?: BleError;
  /** Parsed data if successful */
  data?: unknown;
}

// ============================================
// ERROR PATTERNS
// ============================================

/**
 * Patterns to detect specific error types from respDesc
 * These are checked case-insensitively
 */
const ERROR_PATTERNS: Array<{
  patterns: string[];
  category: BleErrorCategory;
  requiresReset: boolean;
  message: string;
}> = [
  // Device not connected errors
  {
    patterns: [
      'bluetooth device not connected',
      'device not connected',
      'not connected',
      'connection lost',
      'disconnected',
    ],
    category: 'connection_lost',
    requiresReset: true,
    message: 'Bluetooth device not connected. Please turn Bluetooth OFF then ON.',
  },
  // MAC address mismatch errors
  {
    patterns: [
      'macaddress is not match',
      'mac address is not match',
      'macaddress not match',
      'mac address mismatch',
      'wrong mac',
    ],
    category: 'mac_mismatch',
    requiresReset: true,
    message: 'Bluetooth connection stuck. Please turn Bluetooth OFF then ON.',
  },
  // Bluetooth off errors
  {
    patterns: [
      'bluetooth is off',
      'bluetooth off',
      'bluetooth disabled',
      'enable bluetooth',
      'turn on bluetooth',
    ],
    category: 'bluetooth_off',
    requiresReset: true,
    message: 'Bluetooth is turned off. Please enable Bluetooth.',
  },
  // Timeout errors
  {
    patterns: [
      'timeout',
      'timed out',
      'operation timeout',
    ],
    category: 'timeout',
    requiresReset: false,
    message: 'Operation timed out. Please try again.',
  },
];

/**
 * Map of known response codes to error categories
 */
const RESP_CODE_MAP: Record<string, {
  category: BleErrorCategory;
  requiresReset: boolean;
  defaultMessage: string;
}> = {
  '7': {
    category: 'mac_mismatch',
    requiresReset: true,
    defaultMessage: 'Bluetooth connection stuck. Please turn Bluetooth OFF then ON.',
  },
  '8': {
    category: 'connection_lost',
    requiresReset: true,
    defaultMessage: 'Bluetooth device not connected. Please turn Bluetooth OFF then ON.',
  },
  // Add more codes as discovered
};

// ============================================
// PARSER FUNCTIONS
// ============================================

/**
 * Detect error category from response description
 */
function detectCategoryFromDesc(respDesc: string): {
  category: BleErrorCategory;
  requiresReset: boolean;
  message: string;
} | null {
  const lowerDesc = respDesc.toLowerCase();
  
  for (const pattern of ERROR_PATTERNS) {
    for (const p of pattern.patterns) {
      if (lowerDesc.includes(p)) {
        return {
          category: pattern.category,
          requiresReset: pattern.requiresReset,
          message: pattern.message,
        };
      }
    }
  }
  
  return null;
}

/**
 * Parse a BLE native layer response and extract error information
 * 
 * @param responseData - Raw response from native layer (string or object)
 * @returns Parsed result with success flag and error details
 */
export function parseBleResponse(responseData: unknown): BleResponseResult {
  // Handle null/undefined
  if (responseData === null || responseData === undefined) {
    return { success: true };
  }
  
  // Try to parse if string
  let parsed: Record<string, unknown>;
  try {
    parsed = typeof responseData === 'string' 
      ? JSON.parse(responseData) 
      : responseData as Record<string, unknown>;
  } catch {
    // Not JSON - could be a simple acknowledgment
    return { success: true, data: responseData };
  }
  
  // Extract response code and description
  // Support both flat and nested response structures
  const respCode = String(
    parsed?.respCode ?? 
    (parsed?.responseData as Record<string, unknown>)?.respCode ?? 
    ''
  );
  const respDesc = String(
    parsed?.respDesc ?? 
    (parsed?.responseData as Record<string, unknown>)?.respDesc ?? 
    ''
  );
  const respData = parsed?.respData ?? (parsed?.responseData as Record<string, unknown>)?.respData;
  
  // Check for success
  // Success = respCode is 200 OR respCode is empty (no error)
  // OR respData is truthy (some responses use respData for success indication)
  const isSuccess = 
    respCode === '200' || 
    respCode === 200 as unknown as string ||
    (!respCode && respData !== false);
  
  if (isSuccess) {
    return { success: true, data: parsed };
  }
  
  // It's an error - categorize it
  let category: BleErrorCategory = 'unknown';
  let requiresReset = false;
  let message = 'An error occurred. Please try again.';
  
  // First, check by response code
  if (respCode && RESP_CODE_MAP[respCode]) {
    const mapped = RESP_CODE_MAP[respCode];
    category = mapped.category;
    requiresReset = mapped.requiresReset;
    message = mapped.defaultMessage;
  }
  
  // Then, check by description (may override or supplement code-based detection)
  if (respDesc) {
    const detected = detectCategoryFromDesc(respDesc);
    if (detected) {
      category = detected.category;
      requiresReset = detected.requiresReset;
      message = detected.message;
    }
  }
  
  return {
    success: false,
    error: {
      category,
      message,
      requiresBluetoothReset: requiresReset,
      respCode: respCode || undefined,
      respDesc: respDesc || undefined,
      rawResponse: parsed,
    },
  };
}

/**
 * Check if a BLE error requires Bluetooth reset
 * Can be used with error messages from various sources
 */
export function requiresBluetoothReset(errorMessage: string): boolean {
  const lower = errorMessage.toLowerCase();
  
  // Check all patterns that require reset
  const resetPatterns = ERROR_PATTERNS
    .filter(p => p.requiresReset)
    .flatMap(p => p.patterns);
  
  // Also check for explicit reset instructions
  const additionalPatterns = [
    'toggle bluetooth',
    'turn bluetooth off',
    'bluetooth off then on',
    'connection stuck',
  ];
  
  const allPatterns = [...resetPatterns, ...additionalPatterns];
  
  return allPatterns.some(pattern => lower.includes(pattern));
}

/**
 * Create a standardized error message for display
 */
export function getDisplayMessage(error: BleError): string {
  return error.message;
}

/**
 * Create a detailed error message for logging
 */
export function getDebugMessage(error: BleError): string {
  return `[BLE Error] Category: ${error.category}, ` +
    `Code: ${error.respCode || 'N/A'}, ` +
    `Desc: ${error.respDesc || 'N/A'}, ` +
    `RequiresReset: ${error.requiresBluetoothReset}`;
}

// ============================================
// CLEANUP HELPERS
// ============================================

/**
 * Force disconnect from all known BLE connections
 * Call this when an error requires resetting BLE state
 */
export function forceDisconnectAll(log?: (...args: unknown[]) => void): void {
  const logger = log || console.info;
  
  if (!window.WebViewJavascriptBridge) {
    logger('[BLE Cleanup] Bridge not available');
    return;
  }
  
  // Get all stored MAC addresses
  const connectedMac = sessionStorage.getItem('connectedDeviceMac');
  const pendingMac = sessionStorage.getItem('pendingBleMac');
  
  // Disconnect from each
  if (connectedMac) {
    logger('[BLE Cleanup] Disconnecting from connectedMac:', connectedMac);
    window.WebViewJavascriptBridge.callHandler('disconnectBle', connectedMac, () => {});
  }
  
  if (pendingMac && pendingMac !== connectedMac) {
    logger('[BLE Cleanup] Disconnecting from pendingMac:', pendingMac);
    window.WebViewJavascriptBridge.callHandler('disconnectBle', pendingMac, () => {});
  }
  
  // Clear storage
  sessionStorage.removeItem('connectedDeviceMac');
  sessionStorage.removeItem('pendingBleMac');
  sessionStorage.removeItem('bleConnectionSession');
  
  logger('[BLE Cleanup] Session storage cleared');
}

// ============================================
// EXPORTS
// ============================================

export default {
  parseBleResponse,
  requiresBluetoothReset,
  getDisplayMessage,
  getDebugMessage,
  forceDisconnectAll,
  BLE_RESP_CODES,
};
