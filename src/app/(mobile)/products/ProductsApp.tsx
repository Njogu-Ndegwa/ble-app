'use client';

import React, { useState, useCallback, useEffect } from 'react';
import ProductsList from './components/ProductsList';
import ProductDetail from './components/ProductDetail';
import type { OdooProduct } from '@/lib/portal/types';
import AppHeader from '@/components/AppHeader';

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
    <div className="sales-container">
      <div className="sales-bg-gradient" />
      <AppHeader />

      <main className="sales-main sales-main-screen">
        <div className="sales-screen-container">
          {screen === 'list' && (
            <ProductsList onSelect={handleSelectProduct} />
          )}
          {screen === 'detail' && selectedProduct && (
            <ProductDetail
              product={selectedProduct}
              onBack={handleBack}
            />
          )}
        </div>
      </main>
    </div>
  );
}
