'use client';

import React, { useState, useCallback, useEffect } from 'react';
import RollupBrowser from './components/RollupBrowser';
import RollupFileDetail from './components/RollupFileDetail';
import AppHeader from '@/components/AppHeader';
import { getSelectedSA } from '@/lib/sa-auth';
import type { ServiceAccount } from '@/lib/sa-types';
import type { RollupFileType } from '@/lib/rollup/types';

type Screen = 'browse' | 'fileDetail';

interface SelectedFile {
  type: RollupFileType;
  id: number;
  displayName: string;
}

interface RollupAppProps {
  onLogout?: () => void;
  onSwitchSA?: () => void;
}

export default function RollupApp(_: RollupAppProps) {
  const [screen, setScreen] = useState<Screen>('browse');
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [currentSA, setCurrentSA] = useState<ServiceAccount | null>(null);

  useEffect(() => {
    document.body.classList.add('overflow-locked');
    return () => {
      document.body.classList.remove('overflow-locked');
    };
  }, []);

  useEffect(() => {
    setCurrentSA(getSelectedSA('sales'));
  }, []);

  const handleFileClick = useCallback((type: RollupFileType, id: number, displayName: string) => {
    setSelectedFile({ type, id, displayName });
    setScreen('fileDetail');
  }, []);

  const handleBackFromDetail = useCallback(() => {
    setScreen('browse');
    setSelectedFile(null);
  }, []);

  const initialSaId = currentSA?.id ?? null;

  return (
    <div className="sales-container">
      <div className="sales-bg-gradient" />
      <AppHeader showBack />

      <main className="sales-main sales-main-screen">
        <div className="sales-screen-container">
          {screen === 'browse' && initialSaId && (
            <RollupBrowser
              initialSaId={initialSaId}
              initialSaName={currentSA?.name ?? ''}
              onFileClick={handleFileClick}
            />
          )}
          {screen === 'fileDetail' && selectedFile && (
            <RollupFileDetail
              type={selectedFile.type}
              id={selectedFile.id}
              displayName={selectedFile.displayName}
              onBack={handleBackFromDetail}
            />
          )}
        </div>
      </main>
    </div>
  );
}
