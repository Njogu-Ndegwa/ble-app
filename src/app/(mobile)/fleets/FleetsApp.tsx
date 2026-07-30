'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { AppShell, MasterDetail } from '@/components/layout';
import FleetsList from './components/FleetsList';
import FleetDetail from './components/FleetDetail';
import FleetForm from './components/FleetForm';
import type { FleetRow } from '@/lib/fleets-types';

type Screen = 'list' | 'detail' | 'create' | 'edit';

interface FleetsAppProps {
  onLogout?: () => void;
  onSwitchSA?: () => void;
}

export default function FleetsApp(_: FleetsAppProps) {
  const [screen, setScreen] = useState<Screen>('list');
  const [selectedFleet, setSelectedFleet] = useState<FleetRow | null>(null);
  // Bumped whenever a fleet is created/edited/deactivated so the list refetches.
  const [listReloadKey, setListReloadKey] = useState(0);

  useEffect(() => {
    document.body.classList.add('overflow-locked');
    return () => {
      document.body.classList.remove('overflow-locked');
    };
  }, []);

  const handleSelectFleet = useCallback((fleet: FleetRow) => {
    setSelectedFleet(fleet);
    setScreen('detail');
  }, []);

  const handleBackToList = useCallback((changed?: boolean) => {
    if (changed) setListReloadKey((k) => k + 1);
    setScreen('list');
    setSelectedFleet(null);
  }, []);

  const handleCreate = useCallback(() => {
    setScreen('create');
  }, []);

  const handleEdit = useCallback((fleet: FleetRow) => {
    setSelectedFleet(fleet);
    setScreen('edit');
  }, []);

  const handleFormDone = useCallback((fleet: FleetRow) => {
    setListReloadKey((k) => k + 1);
    setSelectedFleet(fleet);
    setScreen('detail');
  }, []);

  const detailPane =
    screen === 'detail' && selectedFleet ? (
      <FleetDetail
        fleetId={selectedFleet.id}
        onBack={handleBackToList}
        onEdit={handleEdit}
      />
    ) : screen === 'create' ? (
      <FleetForm
        onDone={handleFormDone}
        onCancel={() => setScreen('list')}
      />
    ) : screen === 'edit' && selectedFleet ? (
      <FleetForm
        fleet={selectedFleet}
        onDone={handleFormDone}
        onCancel={() => setScreen('detail')}
      />
    ) : null;

  return (
    <AppShell header={{ showBack: true }} width="wide">
      <div className="sales-screen-container">
        <MasterDetail
          isDetailActive={screen !== 'list'}
          list={
            <FleetsList
              onSelect={handleSelectFleet}
              onCreate={handleCreate}
              reloadKey={listReloadKey}
            />
          }
          detail={detailPane}
          placeholder="Select a fleet to view its details"
        />
      </div>
    </AppShell>
  );
}
