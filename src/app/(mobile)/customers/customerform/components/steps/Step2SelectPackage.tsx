'use client';

import React from 'react';
import Image from 'next/image';
import { useI18n } from '@/i18n';
import { PackageData } from '../types';
import {
  Screen,
  PageHeader,
  Grid,
  SelectableCard,
  EmptyState,
  ErrorState,
  SkeletonCard,
  PackageIcon,
} from '@/components/ui';

interface Step2Props {
  selectedPackage: string;
  onPackageSelect: (packageId: string) => void;
  packages: PackageData[];  // Packages from Odoo API (product + privilege bundled)
  isLoadingPackages?: boolean;
  loadError?: string | null;
  onRetryLoad?: () => void;
}

export default function Step2SelectPackage({ 
  selectedPackage, 
  onPackageSelect, 
  packages,
  isLoadingPackages = false,
  loadError = null,
  onRetryLoad,
}: Step2Props) {
  const { t } = useI18n();
  
  // DEBUG: Log what we received
  console.log('[STEP 2] Rendering with:', {
    packagesCount: packages.length,
    isLoadingPackages,
    loadError,
    selectedPackage,
    hasRetryCallback: !!onRetryLoad,
  });
  
  return (
    <Screen>
      <PageHeader 
        title={t('sales.selectPackage') || 'Select Package'} 
        subtitle={t('sales.choosePackage') || 'Choose the best deal for this customer'}
        align="center"
      />

      {isLoadingPackages ? (
        <Grid columns={2} gap={12}>
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} showImage lines={2} />
          ))}
        </Grid>
      ) : loadError ? (
        <ErrorState
          title={t('sales.connectionError') || 'Connection Error'}
          message={loadError}
          onRetry={onRetryLoad}
          retryLabel={t('common.tryAgain') || 'Try Again'}
          hint={t('sales.checkConnection') || 'Please check your internet connection'}
        />
      ) : packages.length === 0 ? (
        <EmptyState
          title={t('sales.noPackagesTitle') || 'No Packages Available'}
          description={t('sales.noPackagesDescription') || "Packages couldn't be loaded from the server. This might be a temporary issue."}
          icon={<PackageIcon size={40} />}
          action={onRetryLoad ? {
            label: t('common.tryAgain') || 'Try Again',
            onClick: onRetryLoad,
          } : undefined}
          hint={t('sales.noPackagesHint') || 'If this persists, please contact support'}
        />
      ) : (
        <Grid columns={2} gap={12}>
          {packages.map((pkg) => {
            const currencySymbol = pkg.currencySymbol || 'KES';
            // Get image from main product component or package itself
            const imageUrl = pkg.imageUrl || pkg.mainProduct?.image_url;
            const hasImage = imageUrl && imageUrl.length > 0;
            
            return (
              <SelectableCard
                key={pkg.id}
                selected={selectedPackage === pkg.id}
                onSelect={() => onPackageSelect(pkg.id)}
                showCheck
                showRadio={false}
              >
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center',
                  gap: '8px',
                  textAlign: 'center',
                }}>
                  {/* Product image */}
                  <div style={{
                    width: '80px',
                    height: '60px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'var(--bg-surface)',
                    borderRadius: '8px',
                  }}>
                    {hasImage ? (
                      <Image
                        src={imageUrl!}
                        alt={pkg.name}
                        width={72}
                        height={54}
                        style={{ objectFit: 'contain' }}
                        unoptimized
                      />
                    ) : (
                      <PackageIcon size={28} color="var(--text-muted)" />
                    )}
                  </div>
                  
                  {/* Package info */}
                  <div>
                    <div style={{ 
                      fontWeight: 600, 
                      fontSize: '13px',
                      marginBottom: '2px',
                    }}>
                      {pkg.name}
                    </div>
                    {/* Show main product name if different from package name */}
                    {pkg.mainProduct && pkg.mainProduct.name !== pkg.name && (
                      <div style={{ 
                        fontSize: '11px', 
                        color: 'var(--text-muted)',
                        marginBottom: '4px',
                      }}>
                        {pkg.mainProduct.name}
                      </div>
                    )}
                    {/* Package price */}
                    <div style={{ 
                      fontWeight: 700, 
                      fontSize: '14px',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--color-primary, #6366f1)',
                    }}>
                      {currencySymbol} {pkg.price.toLocaleString()}
                    </div>
                    {/* Show what's included - subtle fineprint */}
                    <div style={{ 
                      fontSize: '10px', 
                      color: 'var(--text-muted)',
                      marginTop: '2px',
                    }}>
                      {pkg.componentCount} {pkg.componentCount === 1 ? 'item' : 'items'} included
                    </div>
                  </div>
                </div>
              </SelectableCard>
            );
          })}
        </Grid>
      )}
    </Screen>
  );
}
