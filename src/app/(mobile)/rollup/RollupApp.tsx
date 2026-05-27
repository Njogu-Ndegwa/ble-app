'use client';

import React, { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import RollupDashboard from './components/RollupDashboard';
import RollupFileDetail from './components/RollupFileDetail';
import AppHeader from '@/components/AppHeader';
import { getSelectedSA } from '@/lib/sa-auth';
import type { ServiceAccount } from '@/lib/sa-types';
import type { RollupFileType } from '@/lib/rollup/types';

const EmbeddedOrders = dynamic(
  () => import('./components/EmbeddedOrders'),
  { ssr: false },
);
const EmbeddedCustomers = dynamic(
  () => import('./components/EmbeddedCustomers'),
  { ssr: false },
);

type View =
  | { kind: 'dashboard' }
  | { kind: 'applet'; type: string; label: string }
  | { kind: 'detail'; type: RollupFileType; id: number; displayName: string };

interface RollupAppProps {
  onLogout?: () => void;
  onSwitchSA?: () => void;
}

export default function RollupApp(_: RollupAppProps) {
  const [view, setView] = useState<View>({ kind: 'dashboard' });
  const [currentSA, setCurrentSA] = useState<ServiceAccount | null>(null);

  useEffect(() => {
    document.body.classList.add('overflow-locked');
    return () => { document.body.classList.remove('overflow-locked'); };
  }, []);

  useEffect(() => {
    setCurrentSA(getSelectedSA('sales'));
  }, []);

  const saId = currentSA?.id ?? null;
  const saName = currentSA?.name ?? '';

  const handleOpenApplet = useCallback((type: string, label: string) => {
    setView({ kind: 'applet', type, label });
  }, []);

  const handleFileClick = useCallback((type: RollupFileType, id: number, displayName: string) => {
    setView({ kind: 'detail', type, id, displayName });
  }, []);

  const handleBack = useCallback(() => {
    setView({ kind: 'dashboard' });
  }, []);

  if (!saId) return null;

  const renderContent = () => {
    switch (view.kind) {
      case 'applet':
        switch (view.type) {
          case 'sale_order':
            return <EmbeddedOrders onBack={handleBack} />;
          case 'customer':
            return <EmbeddedCustomers onBack={handleBack} />;
          default:
            return (
              <RollupFileDetail
                type={view.type as RollupFileType}
                id={0}
                displayName={view.label}
                onBack={handleBack}
              />
            );
        }
      case 'detail':
        return (
          <RollupFileDetail
            type={view.type}
            id={view.id}
            displayName={view.displayName}
            onBack={handleBack}
          />
        );
      default:
        return (
          <RollupDashboard
            initialSaId={saId}
            initialSaName={saName}
            onFileClick={handleFileClick}
            onOpenApplet={handleOpenApplet}
          />
        );
    }
  };

  return (
    <div className="sales-container">
      <div className="sales-bg-gradient" />
      <AppHeader showBack />

      <main className="sales-main sales-main-screen">
        <div className="sales-screen-container">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
