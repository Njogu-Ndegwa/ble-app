# BLE Hooks Migration Guide

This document explains how to migrate from inline BLE logic in AttendantFlow/SalesFlow to the new modular BLE hooks.

## New Hook Architecture

```
src/lib/hooks/ble/
├── types.ts                   # Shared types
├── useBleDeviceScanner.ts     # Device discovery only
├── useBleDeviceConnection.ts  # Connection management only
├── useBleServiceReader.ts     # Service reading only
├── energyUtils.ts             # Energy calculation utilities
├── useBatteryScanAndBind.ts   # Generic scan-to-bind workflow
├── useFlowBatteryScan.ts      # Flow-specific hook (for AttendantFlow/SalesFlow)
└── index.ts                   # Exports
```

## Quick Start: Using useFlowBatteryScan

The `useFlowBatteryScan` hook is designed specifically for AttendantFlow and SalesFlow. It provides the same interface as the existing inline BLE logic but in a reusable hook.

### Step 1: Import the hook

```typescript
import { useFlowBatteryScan } from '@/lib/hooks/ble';
```

### Step 2: Initialize the hook with callbacks

```typescript
// In your flow component:
const {
  bleScanState,
  isReady,
  startScanning,
  stopScanning,
  handleQrScanned,
  cancelOperation,
  resetState,
  retryConnection,
} = useFlowBatteryScan({
  onOldBatteryRead: (battery) => {
    // Update swap data with old battery
    setSwapData(prev => ({ ...prev, oldBattery: battery }));
    advanceToStep(3);
    toast.success(`Old battery: ${(battery.energy / 1000).toFixed(3)} kWh`);
  },
  onNewBatteryRead: (battery) => {
    // Calculate energy diff and update swap data
    setSwapData(prev => {
      const oldEnergy = prev.oldBattery?.energy || 0;
      const energyDiffWh = battery.energy - oldEnergy;
      const energyDiffKwh = energyDiffWh / 1000;
      // ... calculate cost, quota, etc.
      return {
        ...prev,
        newBattery: battery,
        energyDiff: energyDiffKwh,
        cost: energyDiffKwh * rate,
      };
    });
    advanceToStep(4);
    toast.success(`New battery: ${(battery.energy / 1000).toFixed(3)} kWh`);
  },
  onError: (error, requiresReset) => {
    if (requiresReset) {
      toast.error('Please toggle Bluetooth OFF/ON and try again');
    } else {
      toast.error(error);
    }
  },
  debug: true, // Enable logging during development
});
```

### Step 3: Start scanning when entering battery steps

```typescript
// Start BLE scanning when user reaches Step 2 or Step 3
useEffect(() => {
  if ((currentStep === 2 || currentStep === 3) && isReady) {
    startScanning();
  }
  return () => {
    stopScanning();
  };
}, [currentStep, isReady, startScanning, stopScanning]);
```

### Step 4: Handle QR code scans

```typescript
// In your QR code callback:
const processOldBatteryQRData = useCallback((qrData: string) => {
  // Validate QR data if needed...
  handleQrScanned(qrData, 'old_battery');
}, [handleQrScanned]);

const processNewBatteryQRData = useCallback((qrData: string) => {
  // Validate QR data if needed...
  handleQrScanned(qrData, 'new_battery');
}, [handleQrScanned]);
```

### Step 5: Use bleScanState for UI

```typescript
// Pass to BatteryScanBind component:
<BatteryScanBind
  mode="return"
  onScan={handleScanOldBattery}
  bleScanState={bleScanState}
  onCancelBleOperation={cancelOperation}
  onRetryConnection={retryConnection}
/>
```

## Gradual Migration Strategy

### Phase 1: Keep Existing Code, Add Hook (Current State)

The hook is imported but not used. The existing inline BLE logic continues to work.

```typescript
// Hook is available but not active
import { useFlowBatteryScan } from '@/lib/hooks/ble';

// Existing inline BLE state and handlers remain
const [bleScanState, setBleScanState] = useState({...});
```

### Phase 2: Parallel Testing

Use a feature flag to test the new hook alongside existing code:

```typescript
const USE_NEW_BLE_HOOK = false; // Toggle for testing

const flowBatteryScan = useFlowBatteryScan({
  onOldBatteryRead: handleOldBatteryFromHook,
  onNewBatteryRead: handleNewBatteryFromHook,
});

// Use hook state if enabled, otherwise use existing state
const activeBleState = USE_NEW_BLE_HOOK 
  ? flowBatteryScan.bleScanState 
  : bleScanState;

// In QR handler:
if (USE_NEW_BLE_HOOK) {
  flowBatteryScan.handleQrScanned(qrData, 'old_battery');
} else {
  processOldBatteryQRDataLegacy(qrData);
}
```

### Phase 3: Full Migration

Once tested, remove the inline BLE logic:

1. Remove inline BLE state (`bleScanState`, refs, timeouts)
2. Remove BLE bridge handler registrations for:
   - `findBleDeviceCallBack`
   - `bleConnectSuccessCallBack`
   - `bleConnectFailCallBack`
   - `bleInitServiceDataOnProgressCallBack`
   - `bleInitServiceDataOnCompleteCallBack`
   - `bleInitServiceDataFailureCallBack`
3. Remove helper functions (device matching, energy extraction, etc.)
4. Use hook exclusively

## Code Removal Checklist

When fully migrating, remove these from AttendantFlow/SalesFlow:

### State to Remove
- [ ] `bleScanState` useState
- [ ] `bleOperationTimeoutRef`
- [ ] `bleGlobalTimeoutRef`
- [ ] `bleRetryCountRef`
- [ ] `isConnectionSuccessfulRef`
- [ ] `detectedBleDevicesRef`
- [ ] `pendingBatteryQrCodeRef`
- [ ] `pendingBatteryScanTypeRef`
- [ ] `pendingConnectionMacRef`
- [ ] `dtaRefreshRetryCountRef`
- [ ] BLE constants (MAX_BLE_RETRIES, BLE_CONNECTION_TIMEOUT, etc.)

### Functions to Remove
- [ ] `clearBleOperationTimeout`
- [ ] `clearBleGlobalTimeout`
- [ ] `cancelBleOperation`
- [ ] `connectToBleDevice`
- [ ] `handleBleDeviceMatch`
- [ ] `matchBleDeviceByQrCode`
- [ ] `startBleScan`
- [ ] `stopBleScan`
- [ ] `populateEnergyFromDta`

### Bridge Handlers to Remove
- [ ] `findBleDeviceCallBack` registration
- [ ] `bleConnectSuccessCallBack` registration
- [ ] `bleConnectFailCallBack` registration
- [ ] `bleInitServiceDataOnProgressCallBack` registration
- [ ] `bleInitServiceDataOnCompleteCallBack` registration
- [ ] `bleInitServiceDataFailureCallBack` registration

## Using Lower-Level Hooks

For non-battery use cases, use the individual hooks:

### Device Discovery Only (BLE Device Manager)
```typescript
import { useBleDeviceScanner } from '@/lib/hooks/ble';

const { devices, startScan, stopScan } = useBleDeviceScanner({
  nameFilter: 'OVES',
  autoStart: true,
});
```

### Connection Only (Keypad, OTA)
```typescript
import { useBleDeviceConnection } from '@/lib/hooks/ble';

const { connect, disconnect, connectionState } = useBleDeviceConnection({
  onConnected: (mac) => {
    // Device connected, now read services
  },
});
```

### Service Reading Only
```typescript
import { useBleServiceReader } from '@/lib/hooks/ble';

const { readService, serviceState } = useBleServiceReader({
  onServiceData: (name, data) => {
    console.log(`Service ${name} data:`, data);
  },
});
```

### Energy Calculation Utilities
```typescript
import { 
  extractEnergyFromDta, 
  calculateEnergyDiff,
  calculateSwapCost,
  parseBatteryIdFromQr,
} from '@/lib/hooks/ble';

// Parse QR code
const batteryId = parseBatteryIdFromQr(qrData);

// Extract energy from DTA service response
const energy = extractEnergyFromDta(dtaServiceData);

// Calculate swap cost
const { cost, quotaDeduction, chargeableEnergy } = calculateSwapCost(
  energyDiffKwh,
  ratePerKwh,
  remainingQuotaKwh
);
```

## Benefits of Migration

1. **Reusability**: Use the same BLE logic across multiple components
2. **Testability**: Hook logic can be unit tested independently
3. **Maintainability**: BLE logic is centralized, not scattered
4. **Debugging**: Single place to debug BLE issues
5. **Smaller Components**: Flow files become significantly smaller
6. **Type Safety**: Full TypeScript support with proper types
