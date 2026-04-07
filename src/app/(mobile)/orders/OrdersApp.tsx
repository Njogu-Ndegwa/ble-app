'use client';

import React, { useState, useCallback } from 'react';
import { LogOut } from 'lucide-react';
import OrdersList from './components/OrdersList';
import OrderDetail from './components/OrderDetail';
import CreateOrder from './components/CreateOrder';
import type { OrderEntity } from '@/lib/portal/types';

type Screen = 'list' | 'detail' | 'create';

interface OrdersAppProps {
  onLogout: () => void;
}

export default function OrdersApp({ onLogout }: OrdersAppProps) {
  const [screen, setScreen] = useState<Screen>('list');
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

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
    <div className="flex flex-col h-full min-h-0" style={{ background: 'var(--bg-primary)' }}>
      {/* Minimal header with logout only - list/detail components handle their own headers */}
      {screen === 'list' && (
        <div
          className="flex items-center justify-end px-4 py-2 border-b border-border"
          style={{ background: 'var(--bg-secondary, var(--bg-primary))' }}
        >
          <button
            onClick={onLogout}
            className="p-2 rounded-lg hover:bg-bg-elevated transition-colors text-text-muted"
            title="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
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
    </div>
  );
}
