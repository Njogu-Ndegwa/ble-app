'use client';

import React, { useState, useCallback, useEffect } from 'react';
import ProductsList from './components/ProductsList';
import ProductDetail from './components/ProductDetail';
import type { OdooProduct } from '@/lib/portal/types';
import { AppShell, MasterDetail } from '@/components/layout';

type Screen = 'list' | 'detail';

interface ProductsAppProps {
  onLogout?: () => void;
  onSwitchSA?: () => void;
}

export default function ProductsApp(_: ProductsAppProps) {
  const [screen, setScreen] = useState<Screen>('list');
  const [selectedProduct, setSelectedProduct] = useState<OdooProduct | null>(null);

  useEffect(() => {
    document.body.classList.add('overflow-locked');
    return () => {
      document.body.classList.remove('overflow-locked');
    };
  }, []);

  const handleSelectProduct = useCallback((product: OdooProduct) => {
    setSelectedProduct(product);
    setScreen('detail');
  }, []);

  const handleBack = useCallback(() => {
    setScreen('list');
    setSelectedProduct(null);
  }, []);

  return (
    <AppShell header={{ showBack: true }} width="wide">
      <div className="sales-screen-container">
        <MasterDetail
          isDetailActive={screen !== 'list'}
          list={<ProductsList onSelect={handleSelectProduct} />}
          detail={
            screen === 'detail' && selectedProduct ? (
              <ProductDetail
                product={selectedProduct}
                onBack={handleBack}
              />
            ) : null
          }
          placeholder="Select a product to view its details"
        />
      </div>
    </AppShell>
  );
}
