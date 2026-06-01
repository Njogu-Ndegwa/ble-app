'use client';

import React, { useState, useCallback } from 'react';
import OrdersList from '../../orders/components/OrdersList';
import OrderDetail from '../../orders/components/OrderDetail';
import CreateOrder from '../../orders/components/CreateOrder';
import type { OrderEntity } from '@/lib/portal/types';

type Screen = 'list' | 'detail' | 'create';

interface EmbeddedOrdersProps {
  onBack: () => void;
}

export default function EmbeddedOrders({ onBack }: EmbeddedOrdersProps) {
  const [screen, setScreen] = useState<Screen>('list');
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSelectOrder = useCallback((order: OrderEntity) => {
    setSelectedOrderId(Number(order.id));
    setScreen('detail');
  }, []);

  const handleBack = useCallback(() => {
    if (screen === 'detail' || screen === 'create') {
      setScreen('list');
      setSelectedOrderId(null);
    } else {
      onBack();
    }
  }, [screen, onBack]);

  const handleCreate = useCallback(() => {
    setScreen('create');
  }, []);

  const handleCreated = useCallback((order: OrderEntity) => {
    setSelectedOrderId(Number(order.id));
    setScreen('detail');
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <>
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
        <CreateOrder onCreated={handleCreated} onCancel={handleBack} />
      )}
    </>
  );
}
