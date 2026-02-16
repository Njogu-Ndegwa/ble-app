'use client';

import React from 'react';
import Image from 'next/image';
import { useI18n } from '@/i18n';
import { 
  CustomerFormData, 
  PackageData, 
  PlanData,
  getInitials 
} from '../types';
import {
  Screen,
  Card,
  Avatar,
  PreviewRow,
  CheckCircleIcon,
  PackageIcon,
  CalendarIcon,
} from '@/components/ui';

interface Step4Props {
  formData: CustomerFormData;
  selectedPackage: PackageData | null;
  selectedPlan: PlanData | null;
}

export default function Step4Preview({ 
  formData, 
  selectedPackage, 
  selectedPlan,
}: Step4Props) {
  const { t } = useI18n();
  
  const customerName = `${formData.firstName} ${formData.lastName}`;
  const initials = getInitials(formData.firstName, formData.lastName);
  
  // Calculate totals
  const packagePrice = selectedPackage?.price || 0;
  const subscriptionPrice = selectedPlan?.price || 0;
  const totalAmount = packagePrice + subscriptionPrice;
  const currencySymbol = selectedPackage?.currencySymbol || selectedPlan?.currencySymbol || 'KES';
  
  // Get image from package or main product
  const imageUrl = selectedPackage?.imageUrl || selectedPackage?.mainProduct?.image_url;
  const hasImage = imageUrl && imageUrl.length > 0;

  return (
    <Screen>
      {/* Compact Header with Total */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>
          {t('sales.orderSummary') || 'Order Summary'}
        </h2>
        <div style={{ 
          textAlign: 'right',
          backgroundColor: 'rgba(0, 229, 229, 0.1)',
          padding: '8px 12px',
          borderRadius: '8px',
        }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>
            {t('sales.totalAmount') || 'Total'}
          </div>
          <div style={{ 
            fontSize: '16px', 
            fontWeight: 600,
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-brand, #00e5e5)',
          }}>
            {currencySymbol} {totalAmount.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Customer Row */}
      <Card variant="filled" style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Avatar initials={initials} size="md" variant="primary" />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: '15px' }}>{customerName}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              {formData.phone}
            </div>
            {formData.email && (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {formData.email}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Package & Subscription Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Package Card */}
        {selectedPackage && (
          <Card variant="default">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                {hasImage ? (
                  <Image
                    src={imageUrl!}
                    alt={selectedPackage.name}
                    width={32}
                    height={32}
                    style={{ objectFit: 'contain' }}
                    unoptimized
                  />
                ) : (
                  <PackageIcon size={20} color="var(--color-primary, #6366f1)" />
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {t('sales.package') || 'Package'}
                </div>
                <div style={{ fontWeight: 600, fontSize: '14px' }}>
                  {selectedPackage.name}
                </div>
              </div>
              <div style={{ 
                fontWeight: 600, 
                fontSize: '14px',
                fontFamily: 'var(--font-mono)',
              }}>
                {currencySymbol} {packagePrice.toLocaleString()}
              </div>
            </div>
            
            {/* Compact Components List */}
            {selectedPackage.components && selectedPackage.components.length > 0 && (
              <div style={{
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: '8px',
              }}>
                {selectedPackage.components.map((component, index) => (
                  <PreviewRow
                    key={component.id || index}
                    label={component.name}
                    value={`${component.currencySymbol || currencySymbol} ${component.price_unit.toLocaleString()}`}
                    mono
                  />
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Subscription Card */}
        {selectedPlan && (
          <Card variant="default">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                backgroundColor: 'var(--color-success-soft)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <CalendarIcon size={20} color="var(--color-success)" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {t('sales.subscription') || 'Plan'}
                </div>
                <div style={{ fontWeight: 600, fontSize: '14px' }}>
                  {selectedPlan.name}
                </div>
              </div>
              <div style={{ 
                fontWeight: 600, 
                fontSize: '14px',
                fontFamily: 'var(--font-mono)',
              }}>
                {currencySymbol} {subscriptionPrice.toLocaleString()}
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Ready to Proceed */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        marginTop: '20px',
        padding: '12px',
        backgroundColor: 'var(--color-success-soft)',
        borderRadius: '10px',
        color: 'var(--color-success)',
        fontSize: '13px',
        fontWeight: 500,
      }}>
        <CheckCircleIcon size={18} />
        <span>{t('sales.readyToProceed') || 'Ready to collect payment'}</span>
      </div>
    </Screen>
  );
}
