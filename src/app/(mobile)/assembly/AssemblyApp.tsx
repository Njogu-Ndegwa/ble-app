'use client';

import React, { useState, useCallback, useEffect } from 'react';
import AppHeader from '@/components/AppHeader';
import AssemblyQueue from './components/AssemblyQueue';
import AssemblyDetail from './components/AssemblyDetail';
import type { AssemblyMoRow } from '@/lib/assembly-types';

type Screen = 'queue' | 'detail';

interface AssemblyAppProps {
  onLogout?: () => void;
  onSwitchSA?: () => void;
}

export default function AssemblyApp(_: AssemblyAppProps) {
  const [screen, setScreen] = useState<Screen>('queue');
  const [selectedMo, setSelectedMo] = useState<AssemblyMoRow | null>(null);
  // Optional CKD lot the MO was found by — shown on the detail screen.
  const [ckdLot, setCkdLot] = useState<string | null>(null);
  // Bumped whenever the detail screen changes MO state (sign-off / claim) so
  // the queue refetches on back-navigation.
  const [queueReloadKey, setQueueReloadKey] = useState(0);

  useEffect(() => {
    document.body.classList.add('overflow-locked');
    return () => {
      document.body.classList.remove('overflow-locked');
    };
  }, []);

  const handleSelectMo = useCallback((mo: AssemblyMoRow, foundByCkd?: string | null) => {
    setSelectedMo(mo);
    setCkdLot(foundByCkd ?? null);
    setScreen('detail');
  }, []);

  const handleBack = useCallback((changed?: boolean) => {
    if (changed) setQueueReloadKey((k) => k + 1);
    setScreen('queue');
    setSelectedMo(null);
    setCkdLot(null);
  }, []);

  return (
    <div className="sales-container">
      <div className="sales-bg-gradient" />
      <AppHeader showBack />

      <main className="sales-main sales-main-screen">
        <div className="sales-screen-container">
          {screen === 'queue' && (
            <AssemblyQueue onSelect={handleSelectMo} reloadKey={queueReloadKey} />
          )}
          {screen === 'detail' && selectedMo && (
            <AssemblyDetail mo={selectedMo} ckdLot={ckdLot} onBack={handleBack} />
          )}
        </div>
      </main>
    </div>
  );
}
