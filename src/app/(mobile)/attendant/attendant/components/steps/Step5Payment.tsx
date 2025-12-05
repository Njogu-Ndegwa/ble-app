'use client';

import React from 'react';
import { PaymentCollection } from '@/components/shared';
import type { InputMode } from '@/components/shared';
import { SwapData, CustomerData } from '../types';

interface Step5Props {
  swapData: SwapData;
  customerData?: CustomerData | null;
  isProcessing: boolean;
  inputMode: InputMode;
  setInputMode: (mode: InputMode) => void;
  paymentId: string;
  setPaymentId: (id: string) => void;
  onScanPayment?: () => void;
  isScannerOpening?: boolean;
  amountRemaining?: number;
  amountPaid?: number;
}

/**
 * Step5Payment - Collect payment from customer
 * 
 * Uses the shared PaymentCollection component
 */
export default function Step5Payment({ 
  swapData, 
  customerData, 
  isProcessing, 
  inputMode, 
  setInputMode, 
  paymentId, 
  setPaymentId,
  onScanPayment,
  isScannerOpening = false,
  amountRemaining = 0,
  amountPaid = 0,
}: Step5Props) {
  const hasPartialPayment = amountRemaining > 0 && amountPaid > 0;

  return (
    <div className="screen active">
      <PaymentCollection
        amount={swapData.cost}
        currencySymbol={swapData.currencySymbol}
        customer={customerData ? { name: customerData.name } : null}
        inputMode={inputMode}
        onInputModeChange={setInputMode}
        paymentId={paymentId}
        onPaymentIdChange={setPaymentId}
        onScan={onScanPayment}
        isScannerOpening={isScannerOpening}
        isProcessing={isProcessing}
        partialPayment={hasPartialPayment ? { amountPaid, amountRemaining } : null}
      />
    </div>
  );
}
