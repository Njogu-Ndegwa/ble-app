'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Pencil, Trash2, Package, Tag, Calendar, Building2, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import DetailScreen, { type DetailSection } from '@/components/ui/DetailScreen';
import { LoadingState } from '@/components/ui/State';
import { portalApolloClient } from '@/lib/portal/portal-apollo-client';
import { PRODUCT_UNIT_QUERY } from '@/lib/portal/queries';
import { DELETE_PRODUCT_UNIT } from '@/lib/portal/mutations';
import type { ProductUnitEntity, ProductUnitDetailResponse } from '@/lib/portal/types';

interface ProductDetailProps {
  productId: string;
  onBack: () => void;
  onEdit: () => void;
  onDeleted: () => void;
}

export default function ProductDetail({
  productId,
  onBack,
  onEdit,
  onDeleted,
}: ProductDetailProps) {
  const [product, setProduct] = useState<ProductUnitEntity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchProduct = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await portalApolloClient.query<ProductUnitDetailResponse>({
        query: PRODUCT_UNIT_QUERY,
        variables: { id: productId },
        fetchPolicy: 'network-only',
      });
      setProduct(data.productUnit);
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load product.');
      setProduct(null);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await portalApolloClient.mutate({
        mutation: DELETE_PRODUCT_UNIT,
        variables: { id: productId },
      });
      toast.success('Product deleted.');
      onDeleted();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to delete product.');
    } finally {
      setDeleting(false);
      setDeleteConfirm(false);
    }
  };

  const sections: DetailSection[] = useMemo(() => {
    if (!product) return [];
    return [
      {
        title: 'Product Details',
        fields: [
          { icon: <Tag size={15} />, label: 'SKU', value: product.sku || '--', mono: true },
          {
            icon: <DollarSign size={15} />,
            label: 'Price',
            value: `${product.currencyName ?? ''} ${product.listPrice?.toLocaleString() ?? '—'}`,
          },
          { icon: <Package size={15} />, label: 'Type', value: product.type || '--' },
          { label: 'PU Category', value: product.puCategory || '--' },
          { label: 'PU Metric', value: product.puMetric || '--' },
          { label: 'Service Type', value: product.serviceType || '--' },
          { label: 'Contract Type', value: product.contractType || '--' },
        ],
      },
      {
        title: 'Classification',
        fields: [
          { label: 'Product Category', value: product.categoryName || '--' },
          { label: 'Recurring Invoice', value: product.recurringInvoice ? 'Yes' : 'No' },
          { label: 'Available for Sale', value: product.saleOk ? 'Yes' : 'No' },
        ],
      },
      {
        title: 'Company & Dates',
        fields: [
          { icon: <Building2 size={15} />, label: 'Company', value: product.companyName || '--' },
          {
            icon: <Calendar size={15} />,
            label: 'Created',
            value: product.createdAt
              ? new Date(product.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: '2-digit',
                  year: 'numeric',
                })
              : '--',
          },
        ],
      },
      ...(product.descriptionSale
        ? [
            {
              title: 'Sales Description',
              fields: [{ label: 'Description', value: product.descriptionSale }],
            },
          ]
        : []),
    ];
  }, [product]);

  if (loading) {
    return <LoadingState message="Loading product..." />;
  }

  if (error || !product) {
    return (
      <div className="p-4">
        <div
          className="rounded-xl p-4 text-sm"
          style={{
            background: 'var(--color-error-soft, #fef2f2)',
            color: 'var(--color-error, #dc2626)',
          }}
        >
          {error ?? 'Product not found.'}
        </div>
      </div>
    );
  }

  const initials = product.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div
            className="rounded-2xl p-5 w-full max-w-sm"
            style={{ background: 'var(--bg-secondary, var(--bg-primary))' }}
          >
            <p
              className="text-base font-semibold mb-2"
              style={{ color: 'var(--text-primary)' }}
            >
              Delete {product.name}?
            </p>
            <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(false)}
                className="flex-1 py-3 rounded-xl border border-border text-text-primary font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-3 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-error)' }}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <DetailScreen
        onBack={onBack}
        avatar={initials}
        title={product.name}
        subtitle={product.puCategory ? `${product.puCategory} product` : undefined}
        badge={
          product.active ? (
            <span className="list-card-badge list-card-badge--completed">Active</span>
          ) : (
            <span className="list-card-badge list-card-badge--default">Inactive</span>
          )
        }
        sections={sections}
        headerActions={[
          {
            icon: <Trash2 size={18} style={{ color: 'var(--color-error)' }} />,
            label: 'Delete Product',
            onClick: () => setDeleteConfirm(true),
          },
        ]}
        fabAction={onEdit}
        fabIcon={<Pencil size={20} strokeWidth={2.5} />}
        fabLabel="Edit Product"
      />
    </>
  );
}
