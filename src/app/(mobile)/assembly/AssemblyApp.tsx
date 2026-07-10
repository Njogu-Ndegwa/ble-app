'use client';

import React, { useState, useCallback, useEffect } from 'react';
import AppHeader from '@/components/AppHeader';
import AssemblyQueue from './components/AssemblyQueue';
import AssemblyDetail from './components/AssemblyDetail';
import AssemblyCreate from './components/AssemblyCreate';
import type { AssemblyMoRow } from '@/lib/assembly-types';

type Screen = 'queue' | 'detail' | 'create';

interface AssemblyAppProps {
  onLogout?: () => void;
  onSwitchSA?: () => void;
}

export default function AssemblyApp(_: AssemblyAppProps) {
  const [screen, setScreen] = useState<Screen>('queue');
  const [selectedMo, setSelectedMo] = useState<AssemblyMoRow | null>(null);
  // Bumped whenever the detail screen changes MO state (sign-off) or an MO is
  // created, so the queue refetches on back-navigation.
  const [queueReloadKey, setQueueReloadKey] = useState(0);

  useEffect(() => {
    document.body.classList.add('overflow-locked');
    return () => {
      document.body.classList.remove('overflow-locked');
    };
  }, []);

  const handleSelectMo = useCallback((mo: AssemblyMoRow) => {
    setSelectedMo(mo);
    setScreen('detail');
  }, []);

  const handleCreate = useCallback(() => {
    setScreen('create');
  }, []);

  const handleCreated = useCallback((mo: AssemblyMoRow) => {
    setQueueReloadKey((k) => k + 1);
    setSelectedMo(mo);
    setScreen('detail');
  }, []);

  const handleBack = useCallback((changed?: boolean) => {
    if (changed) setQueueReloadKey((k) => k + 1);
    setScreen('queue');
    setSelectedMo(null);
  }, []);

  return (
    <div className="sales-container">
      <div className="sales-bg-gradient" />
      <AppHeader showBack />

      <main className="sales-main sales-main-screen">
        <div className="sales-screen-container">
          {screen === 'queue' && (
            <AssemblyQueue
              onSelect={handleSelectMo}
              onCreate={handleCreate}
              reloadKey={queueReloadKey}
            />
          )}
          {screen === 'create' && (
            <AssemblyCreate onDone={handleCreated} onCancel={() => setScreen('queue')} />
          )}
          {screen === 'detail' && selectedMo && (
            <AssemblyDetail mo={selectedMo} onBack={handleBack} />
          )}
        </div>
      </main>
    </div>
  );
}
