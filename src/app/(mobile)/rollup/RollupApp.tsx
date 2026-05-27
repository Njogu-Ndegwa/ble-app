'use client';

import React, { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import RollupDashboard from './components/RollupDashboard';
import RollupFileDetail from './components/RollupFileDetail';
import AppHeader from '@/components/AppHeader';
import { getSelectedSA } from '@/lib/sa-auth';
import type { ServiceAccount } from '@/lib/sa-types';
import type { RollupFileType } from '@/lib/rollup/types';

const OrderDetail = dynamic(
  () => import('../orders/components/OrderDetail'),
  { ssr: false },
);

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
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
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

  const handleFileClick = useCallback((type: RollupFileType, id: number, displayName: string) => {
    setSelectedFile({ type, id, displayName });
  }, []);

  const handleBackFromDetail = useCallback(() => {
    setSelectedFile(null);
  }, []);

  if (!saId) return null;

  const renderDetail = () => {
    if (!selectedFile) return null;

    switch (selectedFile.type) {
      case 'sale_order':
        return (
          <OrderDetail
            orderId={selectedFile.id}
            onBack={handleBackFromDetail}
          />
        );
      default:
        return (
          <RollupFileDetail
            type={selectedFile.type}
            id={selectedFile.id}
            displayName={selectedFile.displayName}
            onBack={handleBackFromDetail}
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
          {selectedFile ? (
            renderDetail()
          ) : (
            <RollupDashboard
              initialSaId={saId}
              initialSaName={saName}
              onFileClick={handleFileClick}
            />
          )}
        </div>
      </main>
    </div>
  );
}
