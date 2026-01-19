'use client';

import React from 'react';
import { useI18n } from '@/i18n';
import { SuccessReceipt, buildSwapReceiptRows } from '@/components/shared';
import { SwapData, CustomerData } from '../types';

interface Step6Props {
  swapData: SwapData;
  customerData: CustomerData | null;
  transactionId: string;
  amountDue: number;
  amountPaid: number;
  currencySymbol?: string;
}

/**
 * Step6Success - Display swap completion receipt
 * 
 * Uses the shared SuccessReceipt component with swap-specific data
 */
export default function Step6Success({ 
  swapData, 
  customerData, 
  transactionId,
  amountDue,
  amountPaid,
  currencySymbol = 'KES'
}: Step6Props) {
  const { t } = useI18n();
  
  // Convert energy from Wh to kWh for display
  const oldBatteryEnergyKwh = (swapData.oldBattery?.energy ?? 0) / 1000;
  const newBatteryEnergyKwh = (swapData.newBattery?.energy ?? 0) / 1000;
  
  const receiptRows = buildSwapReceiptRows({
    transactionId,
    subscriptionId: customerData?.subscriptionId || '---',
    // Use actualBatteryId from ATT service (OPID/PPID), fallback to shortId (BLE device name)
    oldBatteryId: swapData.oldBattery?.actualBatteryId || swapData.oldBattery?.shortId || '---',
    oldBatteryLevel: swapData.oldBattery?.chargeLevel ?? 0,
    oldBatteryEnergy: oldBatteryEnergyKwh,
    // Use actualBatteryId from ATT service (OPID/PPID), fallback to shortId (BLE device name)
    newBatteryId: swapData.newBattery?.actualBatteryId || swapData.newBattery?.shortId || '---',
    newBatteryLevel: swapData.newBattery?.chargeLevel ?? 0,
    newBatteryEnergy: newBatteryEnergyKwh,
    energyDiff: swapData.energyDiff,
    amountDue,
    amountPaid,
    currencySymbol,
  }, t);
  
  return (
    <div className="screen active">
      <SuccessReceipt
        title={t('attendant.swapComplete')}
        message={t('attendant.handOverBattery') || `Hand over ${swapData.newBattery?.actualBatteryId || swapData.newBattery?.shortId || 'battery'} to customer`}
        receiptId={transactionId}
        receiptTitle={t('attendant.transactionReceipt') || 'Transaction Receipt'}
        rows={receiptRows}
        icon="check"
      />
    </div>
  );
}
