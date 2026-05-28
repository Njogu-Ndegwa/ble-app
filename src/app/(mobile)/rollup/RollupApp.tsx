'use client';

import React, { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
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

export default function RollupApp({ onSwitchSA }: RollupAppProps) {
  const router = useRouter();
  const [view, setView] = useState<View>({ kind: 'dashboard' });
  const [currentSA, setCurrentSA] = useState<ServiceAccount | null>(null);
  // Stack of SA IDs the user has drilled through. The last entry is the
  // currently-displayed SA; earlier entries are ancestors we can pop back to.
  const [saStack, setSaStack] = useState<number[]>([]);
  const [saNameById, setSaNameById] = useState<Record<number, string>>({});

  useEffect(() => {
    document.body.classList.add('overflow-locked');
    return () => { document.body.classList.remove('overflow-locked'); };
  }, []);

  useEffect(() => {
    const sa = getSelectedSA('sales');
    setCurrentSA(sa);
    if (sa) {
      setSaStack([sa.id]);
      setSaNameById({ [sa.id]: sa.name });
    }
  }, []);

  const rootSaId = currentSA?.id ?? null;
  const currentSaId = saStack.length > 0 ? saStack[saStack.length - 1] : rootSaId;
  const currentSaName = currentSaId != null ? saNameById[currentSaId] ?? currentSA?.name ?? '' : '';

  const handleOpenApplet = useCallback((type: string, label: string) => {
    setView({ kind: 'applet', type, label });
  }, []);

  const handleFileClick = useCallback((type: RollupFileType, id: number, displayName: string) => {
    setView({ kind: 'detail', type, id, displayName });
  }, []);

  const handleDrillToSA = useCallback((saId: number, saName?: string) => {
    setSaStack((stack) => {
      const top = stack[stack.length - 1];
      if (top === saId) return stack;
      return [...stack, saId];
    });
    if (saName) {
      setSaNameById((m) => (m[saId] === saName ? m : { ...m, [saId]: saName }));
    }
  }, []);

  // Breadcrumb jumps may land on any ancestor — collapse the stack so the
  // segment becomes the new top while preserving deeper-popped ancestors.
  const handleBreadcrumbNavigate = useCallback((saId: number) => {
    setSaStack((stack) => {
      const idx = stack.indexOf(saId);
      if (idx === -1) return [saId];
      return stack.slice(0, idx + 1);
    });
  }, []);

  // Keep the breadcrumb names in sync as the API returns them.
  const handleSaResolved = useCallback((saId: number, saName: string) => {
    setSaNameById((m) => (m[saId] === saName ? m : { ...m, [saId]: saName }));
  }, []);

  const handleBack = useCallback(() => {
    // Inside an applet/detail screen: return to the dashboard at the same SA.
    if (view.kind !== 'dashboard') {
      setView({ kind: 'dashboard' });
      return;
    }
    // On the dashboard: pop one level of the drill stack if possible.
    if (saStack.length > 1) {
      setSaStack((stack) => stack.slice(0, -1));
      return;
    }
    // At the root SA — return to the SA selection screen (the listing the
    // user came from), not the roles page.
    if (onSwitchSA) {
      onSwitchSA();
      return;
    }
    router.push('/');
  }, [view.kind, saStack.length, onSwitchSA, router]);

  if (!rootSaId || currentSaId == null) return null;

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
            saId={currentSaId}
            saName={currentSaName}
            onDrillToSA={handleDrillToSA}
            onBreadcrumbNavigate={handleBreadcrumbNavigate}
            onSaResolved={handleSaResolved}
            onFileClick={handleFileClick}
            onOpenApplet={handleOpenApplet}
          />
        );
    }
  };

  return (
    <div className="sales-container">
      <div className="sales-bg-gradient" />
      <AppHeader showBack onBack={handleBack} />

      <main className="sales-main sales-main-screen">
        <div className="sales-screen-container">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
