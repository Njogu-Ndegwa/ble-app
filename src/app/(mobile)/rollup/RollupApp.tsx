'use client';

import React, { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import RollupDashboard from './components/RollupDashboard';
import RollupFileDetail from './components/RollupFileDetail';
import { AppShell } from '@/components/layout';
import { getSelectedSA, setSAScopeOverride } from '@/lib/sa-auth';
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
const EmbeddedTickets = dynamic(
  () => import('./components/EmbeddedTickets'),
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

  // Embedded views (customer management, orders, etc.) reach the network
  // layer through helpers that resolve the SA-ID from localStorage — that is
  // the *root* SA chosen at login and does not change as the user drills.
  // Mirror the drilled-in SA into the scope override so every X-SA-ID header
  // sent from this applet targets the SA the user is actually viewing.
  useEffect(() => {
    setSAScopeOverride(currentSaId);
    return () => setSAScopeOverride(null);
  }, [currentSaId]);

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
    // At the root SA — return to the roles page.
    router.push('/');
  }, [view.kind, saStack.length, router]);

  if (!rootSaId || currentSaId == null) return null;

  const renderContent = () => {
    switch (view.kind) {
      case 'applet':
        switch (view.type) {
          case 'sale_order':
            return <EmbeddedOrders onBack={handleBack} />;
          case 'customer':
            return <EmbeddedCustomers onBack={handleBack} />;
          case 'ticket':
            return <EmbeddedTickets onBack={handleBack} />;
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
    <AppShell header={{ showBack: true, onBack: handleBack }} width="wide">
      <div className="sales-screen-container">
        {renderContent()}
      </div>
    </AppShell>
  );
}
