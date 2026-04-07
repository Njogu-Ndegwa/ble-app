'use client';

import React, { useState, useCallback } from 'react';
import { LogOut } from 'lucide-react';
import ProductsList from './components/ProductsList';
import ProductDetail from './components/ProductDetail';
import EditProduct from './components/EditProduct';
import type { ProductUnitEntity } from '@/lib/portal/types';

type Screen = 'list' | 'detail' | 'edit';

interface ProductsAppProps {
  onLogout: () => void;
}

export default function ProductsApp({ onLogout }: ProductsAppProps) {
  const [screen, setScreen] = useState<Screen>('list');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSelectProduct = useCallback((product: ProductUnitEntity) => {
    setSelectedProductId(product.id);
    setScreen('detail');
  }, []);

  const handleBack = useCallback(() => {
    setScreen('list');
    setSelectedProductId(null);
  }, []);

  const handleEdit = useCallback(() => {
    setScreen('edit');
  }, []);

  const handleEditDone = useCallback(() => {
    setScreen('detail');
    setRefreshKey((k) => k + 1);
  }, []);

  const handleDeleted = useCallback(() => {
    setScreen('list');
    setSelectedProductId(null);
    setRefreshKey((k) => k + 1);
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
          <ProductsList key={refreshKey} onSelect={handleSelectProduct} />
        )}
        {screen === 'detail' && selectedProductId && (
          <ProductDetail
            productId={selectedProductId}
            onBack={handleBack}
            onEdit={handleEdit}
            onDeleted={handleDeleted}
          />
        )}
        {screen === 'edit' && selectedProductId && (
          <EditProduct
            productId={selectedProductId}
            onDone={handleEditDone}
            onCancel={() => setScreen('detail')}
          />
        )}
      </div>
    </div>
  );
}
