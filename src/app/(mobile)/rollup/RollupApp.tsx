'use client';

import React, { useState, useCallback, useEffect } from 'react';
import RollupDashboard from './components/RollupDashboard';
import RollupBrowser from './components/RollupBrowser';
import RollupRecords from './components/RollupRecords';
import RollupFileDetail from './components/RollupFileDetail';
import RollupNav, { type RollupScreen } from './components/RollupNav';
import AppHeader from '@/components/AppHeader';
import { getSelectedSA } from '@/lib/sa-auth';
import type { ServiceAccount } from '@/lib/sa-types';
import type { RollupFileType } from '@/lib/rollup/types';

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
  const [currentTab, setCurrentTab] = useState<RollupScreen>('dashboard');
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [currentSA, setCurrentSA] = useState<ServiceAccount | null>(null);
  const [drillSaId, setDrillSaId] = useState<number | null>(null);

  useEffect(() => {
    document.body.classList.add('overflow-locked');
    return () => { document.body.classList.remove('overflow-locked'); };
  }, []);

  useEffect(() => {
    setCurrentSA(getSelectedSA('sales'));
  }, []);

  const saId = currentSA?.id ?? null;
  const saName = currentSA?.name ?? '';
  const showDetail = selectedFile !== null;

  const handleFileClick = useCallback((type: RollupFileType, id: number, displayName: string) => {
    setSelectedFile({ type, id, displayName });
  }, []);

  const handleBackFromDetail = useCallback(() => {
    setSelectedFile(null);
  }, []);

  const handleDrillIntoAccount = useCallback((targetSaId: number) => {
    setDrillSaId(targetSaId);
    setCurrentTab('accounts');
  }, []);

  const handleViewAllAccounts = useCallback(() => {
    setDrillSaId(null);
    setCurrentTab('accounts');
  }, []);

  const handleViewRecords = useCallback(() => {
    setCurrentTab('records');
  }, []);

  const handleNavigate = useCallback((screen: RollupScreen) => {
    setSelectedFile(null);
    setCurrentTab(screen);
  }, []);

  if (!saId) return null;

  return (
    <div className="sales-container">
      <div className="sales-bg-gradient" />
      <AppHeader showBack />

      <main className="sales-main sales-main-screen">
        <div className="sales-screen-container">
          {showDetail ? (
            <RollupFileDetail
              type={selectedFile.type}
              id={selectedFile.id}
              displayName={selectedFile.displayName}
              onBack={handleBackFromDetail}
            />
          ) : (
            <>
              {currentTab === 'dashboard' && (
                <RollupDashboard
                  saId={saId}
                  saName={saName}
                  managerName={undefined}
                  onDrillIntoAccount={handleDrillIntoAccount}
                  onViewAllAccounts={handleViewAllAccounts}
                  onViewRecords={handleViewRecords}
                />
              )}
              {currentTab === 'accounts' && (
                <RollupBrowser
                  initialSaId={drillSaId ?? saId}
                  initialSaName={saName}
                  onFileClick={handleFileClick}
                />
              )}
              {currentTab === 'records' && (
                <RollupRecords
                  saId={saId}
                  onFileClick={handleFileClick}
                />
              )}
            </>
          )}
        </div>
      </main>

      {!showDetail && (
        <RollupNav currentScreen={currentTab} onNavigate={handleNavigate} />
      )}
    </div>
  );
}
