'use client';

import React from 'react';
import { useI18n } from '@/i18n';
import { PaymentCollection } from '@/components/shared';
import type { InputMode } from '@/components/shared';
import { CustomerFormData, PlanData, PackageData } from '../types';

interface Step3Props {
  formData: CustomerFormData;
  selectedPlanId: string;
  onConfirmPayment: () => void;
  isProcessing: boolean;
  isScannerOpening?: boolean;
  plans: PlanData[];
  selectedPackage?: PackageData | null;
  paymentIncomplete?: boolean;
  amountPaid?: number;
  amountExpected?: number;
  amountRemaining?: number;
  inputMode: InputMode;
  setInputMode: (mode: InputMode) => void;
  paymentId: string;
  setPaymentId: (id: string) => void;
}

/**
 * Step3Payment - Collect payment for subscription/package
 * 
 * Uses the shared PaymentCollection component
 */
export default function Step3Payment({ 
  formData, 
  selectedPlanId, 
  onConfirmPayment, 
  isProcessing,
  isScannerOpening = false,
  plans,
  selectedPackage = null,
  paymentIncomplete = false,
  amountPaid = 0,
  amountRemaining = 0,
  inputMode,
  setInputMode,
  paymentId,
  setPaymentId,
}: Step3Props) {
  const { t } = useI18n();

  const selectedPlan = plans.find(p => p.id === selectedPlanId);
  const customerName = `${formData.firstName} ${formData.lastName}`;
  
  // Calculate total amount: package + subscription
  const packagePrice = selectedPackage?.price || 0;
  const subscriptionPrice = selectedPlan?.price || 0;
  const amount = packagePrice + subscriptionPrice;
  const currencySymbol = selectedPackage?.currencySymbol || selectedPlan?.currencySymbol || 'KES';
  
  const hasPartialPayment = paymentIncomplete && amountPaid > 0;
  
  return (
    <div className="screen active">
      <PaymentCollection
        amount={amount}
        currencySymbol={currencySymbol}
        customer={{ name: customerName }}
        inputMode={inputMode}
        onInputModeChange={setInputMode}
        paymentId={paymentId}
        onPaymentIdChange={setPaymentId}
        onScan={onConfirmPayment}
        isScannerOpening={isScannerOpening}
        isProcessing={isProcessing}
        partialPayment={hasPartialPayment ? { amountPaid, amountRemaining } : null}
        title={t('sales.confirmPayment')}
      />
    </div>
  );
}
