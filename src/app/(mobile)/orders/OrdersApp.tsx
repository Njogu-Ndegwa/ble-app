'use client';

import React, { useState, useCallback, useEffect } from 'react';
import OrdersList from './components/OrdersList';
import OrderDetail from './components/OrderDetail';
import CreateOrder from './components/CreateOrder';
import type { OrderEntity } from '@/lib/portal/types';
import AppHeader from '@/components/AppHeader';

type Screen = 'list' | 'detail' | 'create';

interface OrdersAppProps {
  onLogout?: () => void;
  onSwitchSA?: () => void;
}

export default function OrdersApp(_: OrdersAppProps) {
  const [screen, setScreen] = useState<Screen>('list');
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    document.body.classList.add('overflow-locked');
    return () => {
      document.body.classList.remove('overflow-locked');
    };
  }, []);

  const handleSelectOrder = useCallback((order: OrderEntity) => {
    setSelectedOrderId(Number(order.id));
    setScreen('detail');
  }, []);

  const handleBack = useCallback(() => {
    setScreen('list');
    setSelectedOrderId(null);
  }, []);

  const handleCreate = useCallback(() => {
    setScreen('create');
  }, []);

  const handleCreated = useCallback((order: OrderEntity) => {
    setSelectedOrderId(Number(order.id));
    setScreen('detail');
    setRefreshKey((k) => k + 1);
  }, []);

  const handleBackFromCreate = useCallback(() => {
    setScreen('list');
  }, []);

  return (
    <div className="sales-container">
      <div className="sales-bg-gradient" />
      <AppHeader />

      <main className="sales-main sales-main-screen">
        <div className="sales-screen-container">
          {screen === 'list' && (
            <OrdersList
              key={refreshKey}
              onSelect={handleSelectOrder}
              onCreateNew={handleCreate}
            />
          )}
          {screen === 'detail' && selectedOrderId && (
            <OrderDetail orderId={selectedOrderId} onBack={handleBack} />
          )}
          {screen === 'create' && (
            <CreateOrder onCreated={handleCreated} onCancel={handleBackFromCreate} />
          )}
        </div>
      </main>
    </div>
  );
}
