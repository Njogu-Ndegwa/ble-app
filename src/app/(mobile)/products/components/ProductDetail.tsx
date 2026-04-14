'use client';

import React, { useMemo } from 'react';
import DetailScreen, { type DetailSection } from '@/components/ui/DetailScreen';
import type { OdooProduct } from '@/lib/portal/types';

function parseLastSegment(completeName: string): string {
  const parts = completeName.split('/');
  return parts[parts.length - 1].trim();
}

const TYPE_LABELS: Record<string, string> = {
  consu: 'Consumable',
  service: 'Service',
  product: 'Storable',
};

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
          { label: 'SKU / Code', value: product.default_code || '--' },
          { label: 'Template ID', value: String(product.template_id) },
          { label: 'Type', value: TYPE_LABELS[product.type] || product.type || '--' },
          { label: 'Price', value: product.list_price?.toLocaleString() ?? '--' },
          {
            label: 'Category',
            value: product.category?.complete_name
              ? parseLastSegment(product.category.complete_name)
              : product.category_name || '--',
          },
          { label: 'Full Category Path', value: product.category?.complete_name || product.category_name || '--' },
          { label: 'Active', value: product.active ? 'Yes' : 'No' },
          { label: 'Available for Sale', value: product.sale_ok ? 'Yes' : 'No' },
          { label: 'Recurring Invoice', value: product.recurring_invoice ? 'Yes' : 'No' },
        ],
      },
      {
        title: 'Classification',
        fields: [
          { label: 'PU Category', value: product.pu_category || '--' },
          { label: 'PU Metric', value: product.pu_metric || '--' },
          { label: 'Service Type', value: product.service_type || '--' },
          { label: 'Contract Type', value: product.contract_type || '--' },
        ],
      },
      ...(product.company_name
        ? [{
            title: 'Company',
            fields: [
              { label: 'Company', value: product.company_name },
              ...(product.company_id ? [{ label: 'Company ID', value: String(product.company_id) }] : []),
            ],
          }]
        : []),
      ...((product.description_sale || product.description)
        ? [{
            title: 'Description',
            fields: [
              ...(product.description_sale
                ? [{
                    label: 'Sales Description',
                    value: product.description_sale,
                    renderValue: (
                      <p className="text-sm text-text-primary whitespace-pre-wrap break-words">
                        {product.description_sale}
                      </p>
                    ),
                  }]
                : []),
              ...(product.description
                ? [{
                    label: 'Internal Description',
                    value: product.description,
                    renderValue: (
                      <p className="text-sm text-text-primary whitespace-pre-wrap break-words">
                        {product.description}
                      </p>
                    ),
                  }]
                : []),
            ],
          }]
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
