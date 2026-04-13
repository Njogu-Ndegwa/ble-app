'use client';

import React, { useMemo } from 'react';
import { Package, Tag, Building2 } from 'lucide-react';
import DetailScreen, { type DetailSection } from '@/components/ui/DetailScreen';
import type { OdooProduct } from '@/lib/portal/types';

function parseLastSegment(completeName: string): string {
  const parts = completeName.split('/');
  return parts[parts.length - 1].trim();
}

interface ProductDetailProps {
  product: OdooProduct;
  onBack: () => void;
}

export default function ProductDetail({ product, onBack }: ProductDetailProps) {
  const sections: DetailSection[] = useMemo(() => {
    return [
      {
        title: 'Product Details',
        fields: [
          { icon: <Tag size={15} />, label: 'SKU', value: product.default_code || '--', mono: true },
          {
            icon: <Package size={15} />,
            label: 'Price',
            value: product.list_price?.toLocaleString() ?? '—',
          },
          { label: 'Type', value: product.type || '--' },
          {
            label: 'Category',
            value: product.category?.complete_name
              ? parseLastSegment(product.category.complete_name)
              : product.category_name || '--',
          },
          { label: 'Recurring Invoice', value: product.recurring_invoice ? 'Yes' : 'No' },
          { label: 'Available for Sale', value: product.sale_ok ? 'Yes' : 'No' },
        ],
      },
      ...(product.company_name
        ? [
            {
              title: 'Company',
              fields: [
                { icon: <Building2 size={15} />, label: 'Company', value: product.company_name },
              ],
            },
          ]
        : []),
      ...(product.description_sale
        ? [
            {
              title: 'Sales Description',
              fields: [{ label: 'Description', value: product.description_sale }],
            },
          ]
        : []),
    ];
  }, [product]);

  const initials = product.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <DetailScreen
      onBack={onBack}
      avatar={initials}
      title={product.name}
      subtitle={
        product.category?.complete_name
          ? parseLastSegment(product.category.complete_name)
          : product.category_name || undefined
      }
      badge={
        product.active ? (
          <span className="list-card-badge list-card-badge--completed">Active</span>
        ) : (
          <span className="list-card-badge list-card-badge--default">Inactive</span>
        )
      }
      sections={sections}
    />
  );
}
