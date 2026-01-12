'use client';

import React, { useState } from 'react';
import { useI18n } from '@/i18n';
import { toast } from 'react-hot-toast';

export interface ReceiptRow {
  /** Label for the row */
  label: string;
  /** Value to display */
  value: string;
  /** Whether to use monospace font */
  mono?: boolean;
  /** Custom color for the value */
  color?: string;
  /** Whether to show a copy button for this row */
  copyable?: boolean;
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
  const { t } = useI18n();
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = async (value: string, index: number) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedIndex(index);
      toast.success(t('common.copied') || 'Copied to clipboard');
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error(t('common.copyFailed') || 'Failed to copy');
    }
  };

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
          <div key={index} className="receipt-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
              <span className="receipt-label">{row.label}</span>
              <span 
                className={`receipt-value ${row.mono ? 'font-mono-oves' : ''}`}
                style={row.color ? { color: row.color } : undefined}
              >
                {row.value}
              </span>
            </div>
            {row.copyable && (
              <button
                onClick={() => handleCopy(row.value, index)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  color: copiedIndex === index ? 'var(--success)' : 'var(--text-secondary)',
                  transition: 'color 0.2s',
                }}
                aria-label={t('common.copy') || 'Copy'}
                title={t('common.copy') || 'Copy'}
              >
                {copiedIndex === index ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                )}
              </button>
            )}
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
  subscriptionId: string;
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
  
  // Subscription ID is the primary identifier - no customer name/ID shown
  const rows: ReceiptRow[] = [
    {
      label: t('attendant.subscriptionId') || 'Subscription ID',
      value: data.subscriptionId,
      mono: true
    },
  ];

  rows.push(
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
      // data.energyDiff is already floored to 2 decimals
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
    }
  );

  return rows;
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
  password?: string;
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

  // Show customer password prominently for new registrations
  // This is important so the customer can see their password on the printed receipt
  if (data.customerPassword) {
    rows.push({ 
      label: t('sales.customerPassword') || 'Password', 
      value: data.customerPassword,
      mono: true,
      color: 'var(--brand-primary)'
    });
  }

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

  // Add password row if provided
  if (data.password) {
    rows.push({
      label: t('sales.password') || 'Password',
      value: data.password,
      mono: true,
      copyable: true,
    });
  }

  return rows;
}
