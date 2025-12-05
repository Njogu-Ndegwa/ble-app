'use client';

import React from 'react';
import { useI18n } from '@/i18n';

export interface ReceiptRow {
  /** Label for the row */
  label: string;
  /** Value to display */
  value: string;
  /** Whether to use monospace font */
  mono?: boolean;
  /** Custom color for the value */
  color?: string;
}

interface SuccessReceiptProps {
  /** Main title (e.g., "Swap Complete", "Registration Complete") */
  title: string;
  /** Subtitle/message below the title */
  message?: string;
  /** Receipt ID to display in header */
  receiptId?: string;
  /** Receipt title label */
  receiptTitle?: string;
  /** Array of receipt rows to display */
  rows: ReceiptRow[];
  /** Custom icon - defaults to checkmark */
  icon?: 'check' | 'star' | 'battery';
  /** Optional className */
  className?: string;
}

// Success icons
const SuccessIcons = {
  check: (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M20 6L9 17l-5-5"/>
    </svg>
  ),
  star: (
    <svg 
      viewBox="0 0 24 24" 
      fill="currentColor"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  battery: (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <rect x="2" y="7" width="16" height="10" rx="2"/>
      <path d="M22 11v2"/>
      <path d="M7 11h4M9 9v4"/>
    </svg>
  ),
};

/**
 * SuccessReceipt - Reusable success/receipt display component
 * 
 * Displays a success state with a receipt-style summary of the transaction.
 * 
 * Used in:
 * - Attendant Step 6: Swap Complete
 * - Sales Step 7: Registration Complete
 * 
 * @example
 * <SuccessReceipt
 *   title="Swap Complete"
 *   message="Hand over battery to customer"
 *   receiptId="TXN-12345"
 *   rows={[
 *     { label: "Customer", value: "John Doe" },
 *     { label: "Amount", value: "KES 500", mono: true },
 *   ]}
 * />
 */
export default function SuccessReceipt({
  title,
  message,
  receiptId,
  receiptTitle = 'Transaction Receipt',
  rows,
  icon = 'check',
  className = '',
}: SuccessReceiptProps) {
  return (
    <div className={`success-screen ${className}`} style={{ paddingTop: '12px' }}>
      {/* Success Icon */}
      <div className="success-icon">
        {SuccessIcons[icon]}
      </div>
      
      {/* Title and Message */}
      <h2 className="success-title">{title}</h2>
      {message && <p className="success-message">{message}</p>}
      
      {/* Receipt Card */}
      <div className="receipt-card" style={{ width: '100%', textAlign: 'left' }}>
        {/* Receipt Header */}
        {(receiptTitle || receiptId) && (
          <div className="receipt-header">
            <span className="receipt-title">{receiptTitle}</span>
            {receiptId && (
              <span className="receipt-id font-mono-oves">#{receiptId}</span>
            )}
          </div>
        )}
        
        {/* Receipt Rows */}
        {rows.map((row, index) => (
          <div key={index} className="receipt-row">
            <span className="receipt-label">{row.label}</span>
            <span 
              className={`receipt-value ${row.mono ? 'font-mono-oves' : ''}`}
              style={row.color ? { color: row.color } : undefined}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// PRESET BUILDERS
// ============================================

export interface SwapReceiptData {
  transactionId: string;
  customerName: string;
  oldBatteryId: string;
  oldBatteryLevel: number;
  newBatteryId: string;
  newBatteryLevel: number;
  energyDiff: number;
  amountDue: number;
  amountPaid: number;
  currencySymbol?: string;
}

/**
 * Build receipt rows for a battery swap transaction
 */
export function buildSwapReceiptRows(
  data: SwapReceiptData,
  t: (key: string) => string
): ReceiptRow[] {
  const currency = data.currencySymbol || 'KES';
  
  return [
    { 
      label: t('attendant.step.customer'), 
      value: data.customerName 
    },
    { 
      label: t('attendant.returned') || 'Returned', 
      value: `${data.oldBatteryId} (${data.oldBatteryLevel}%)`,
      mono: true 
    },
    { 
      label: t('attendant.issued') || 'Issued', 
      value: `${data.newBatteryId} (${data.newBatteryLevel}%)`,
      mono: true 
    },
    { 
      label: t('attendant.energy') || 'Energy', 
      value: `${data.energyDiff.toFixed(2)} kWh`,
      mono: true 
    },
    { 
      label: t('sales.amountDue'), 
      value: `${currency} ${data.amountDue.toLocaleString()}`,
      mono: true 
    },
    { 
      label: t('sales.amountPaid'), 
      value: `${currency} ${data.amountPaid.toLocaleString()}`,
      mono: true,
      color: 'var(--success)'
    },
    { 
      label: t('attendant.time') || 'Time', 
      value: new Date().toLocaleTimeString(),
      mono: true 
    },
  ];
}

export interface RegistrationReceiptData {
  registrationId: string;
  customerName: string;
  phone: string;
  packageName?: string;
  subscriptionName?: string;
  subscriptionCode?: string;
  batteryId?: string;
  batteryLevel?: number;
  paymentReference?: string;
  amountPaid: number;
  currencySymbol?: string;
}

/**
 * Build receipt rows for a customer registration
 */
export function buildRegistrationReceiptRows(
  data: RegistrationReceiptData,
  t: (key: string) => string
): ReceiptRow[] {
  const currency = data.currencySymbol || 'KES';
  const rows: ReceiptRow[] = [
    { 
      label: t('sales.customerName'), 
      value: data.customerName 
    },
    { 
      label: t('sales.phoneNumber'), 
      value: data.phone,
      mono: true 
    },
  ];

  if (data.packageName) {
    rows.push({ 
      label: t('sales.package') || 'Package', 
      value: data.packageName 
    });
  }

  if (data.subscriptionName) {
    rows.push({ 
      label: t('sales.subscription') || 'Subscription', 
      value: data.subscriptionName 
    });
  }

  if (data.subscriptionCode) {
    rows.push({ 
      label: t('sales.subscriptionId') || 'Subscription ID', 
      value: data.subscriptionCode,
      mono: true 
    });
  }

  rows.push({ 
    label: t('sales.assignedBattery'), 
    value: data.batteryId 
      ? `${data.batteryId} (${data.batteryLevel || 0}%)`
      : 'N/A',
    mono: true 
  });

  if (data.paymentReference) {
    rows.push({ 
      label: t('sales.paymentRef'), 
      value: data.paymentReference,
      mono: true 
    });
  }

  rows.push({ 
    label: t('sales.amountPaid') || 'Amount Paid', 
    value: `${currency} ${data.amountPaid.toLocaleString()}`,
    mono: true,
    color: 'var(--success)'
  });

  return rows;
}
