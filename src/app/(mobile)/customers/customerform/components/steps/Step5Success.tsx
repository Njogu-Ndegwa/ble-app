'use client';

import React from 'react';
import { useI18n } from '@/i18n';
import { SuccessReceipt, buildRegistrationReceiptRows } from '@/components/shared';
import type { BatteryData } from '@/components/shared';
import { CustomerFormData, PlanData, PackageData } from '../types';

interface Step5Props {
  formData: CustomerFormData;
  selectedPlanId: string;
  battery: BatteryData | null;
  registrationId: string;
  paymentReference?: string;
  plans: PlanData[];
  selectedPackage?: PackageData | null;
  subscriptionCode?: string;
  amountPaid?: number;
  customerPassword?: string | null;
}

/**
 * Step5Success - Display registration completion receipt
 * 
 * Uses the shared SuccessReceipt component with registration-specific data
 */
export default function Step5Success({ 
  formData, 
  selectedPlanId, 
  battery, 
  registrationId,
  paymentReference,
  plans,
  selectedPackage,
  subscriptionCode,
  amountPaid,
  customerPassword,
}: Step5Props) {
  const { t } = useI18n();
  const selectedPlan = plans.find((p: PlanData) => p.id === selectedPlanId);
  const customerName = `${formData.firstName} ${formData.lastName}`;

  // Calculate total amount paid
  const packagePrice = selectedPackage?.price || 0;
  const planPrice = selectedPlan?.price || 0;
  const totalPurchaseAmount = amountPaid || (packagePrice + planPrice);
  const currencySymbol = selectedPackage?.currencySymbol || selectedPlan?.currencySymbol || 'KES';

  const receiptRows = buildRegistrationReceiptRows({
    registrationId,
    customerName,
    phone: formData.phone,
    packageName: selectedPackage?.name,
    subscriptionName: selectedPlan?.name,
    subscriptionCode,
    // Use actualBatteryId from ATT service (OPID/PPID), fallback to shortId (BLE device name)
    batteryId: battery?.actualBatteryId || battery?.shortId,
    batteryLevel: battery?.chargeLevel,
    paymentReference,
    amountPaid: totalPurchaseAmount,
    currencySymbol,
    password: customerPassword || undefined,
  }, t);

  return (
    <div className="screen active">
      <SuccessReceipt
        title={t('sales.registrationComplete')}
        message={t('sales.customerRegistered')}
        receiptId={registrationId}
        receiptTitle={t('sales.registrationId')}
        rows={receiptRows}
        icon="check"
      />
    </div>
  );
}
