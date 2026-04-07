'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { FormInput, FormSection, FormRow } from '@/components/ui';
import { LoadingState } from '@/components/ui/State';
import { portalApolloClient } from '@/lib/portal/portal-apollo-client';
import { PRODUCT_UNIT_QUERY } from '@/lib/portal/queries';
import { UPDATE_PRODUCT_UNIT } from '@/lib/portal/mutations';
import type {
  ProductUnitEntity,
  ProductUnitDetailResponse,
  UpdateProductUnitInput,
} from '@/lib/portal/types';

interface EditProductProps {
  productId: string;
  onDone: () => void;
  onCancel: () => void;
}

export default function EditProduct({ productId, onDone, onCancel }: EditProductProps) {
  const [product, setProduct] = useState<ProductUnitEntity | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [listPrice, setListPrice] = useState('');
  const [type, setType] = useState('');
  const [puCategory, setPuCategory] = useState('');
  const [puMetric, setPuMetric] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [contractType, setContractType] = useState('');
  const [description, setDescription] = useState('');
  const [descriptionSale, setDescriptionSale] = useState('');
  const [recurringInvoice, setRecurringInvoice] = useState(false);
  const [saleOk, setSaleOk] = useState(true);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const fetchProduct = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await portalApolloClient.query<ProductUnitDetailResponse>({
        query: PRODUCT_UNIT_QUERY,
        variables: { id: productId },
        fetchPolicy: 'network-only',
      });
      const p = data.productUnit;
      setProduct(p);
      setName(p.name ?? '');
      setSku(p.sku ?? '');
      setListPrice(p.listPrice?.toString() ?? '');
      setType(p.type ?? '');
      setPuCategory(p.puCategory ?? '');
      setPuMetric(p.puMetric ?? '');
      setServiceType(p.serviceType ?? '');
      setContractType(p.contractType ?? '');
      setDescription(p.description ?? '');
      setDescriptionSale(p.descriptionSale ?? '');
      setRecurringInvoice(p.recurringInvoice ?? false);
      setSaleOk(p.saleOk ?? true);
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to load product.');
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  const handleSave = async () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Name is required';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setSaving(true);
    try {
      const input: UpdateProductUnitInput = {
        name: name.trim(),
        sku: sku.trim() || null,
        listPrice: listPrice ? parseFloat(listPrice) : null,
        type: type || null,
        puCategory: puCategory || null,
        puMetric: puMetric || null,
        serviceType: serviceType || null,
        contractType: contractType || null,
        description: description.trim() || null,
        descriptionSale: descriptionSale.trim() || null,
        recurringInvoice,
        saleOk,
      };

      await portalApolloClient.mutate({
        mutation: UPDATE_PRODUCT_UNIT,
        variables: { id: productId, input },
      });

      toast.success('Product updated.');
      onDone();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to update product.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading product..." />;
  }

  if (!product) {
    return (
      <div className="p-4">
        <div
          className="rounded-xl p-4 text-sm"
          style={{
            background: 'var(--color-error-soft, #fef2f2)',
            color: 'var(--color-error, #dc2626)',
          }}
        >
          Product not found.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 pt-3 pb-2">
        <button
          onClick={onCancel}
          className="p-2 -ml-2 rounded-lg hover:bg-bg-elevated transition-colors"
          aria-label="Back"
        >
          <ArrowLeft size={20} className="text-text-primary" />
        </button>
        <h2 className="text-lg font-semibold text-text-primary">Edit Product</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <FormSection title="Basic Information">
          <FormInput
            label="Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Product name"
            error={errors.name}
          />
          <FormRow columns={2}>
            <FormInput
              label="SKU"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="SKU code"
            />
            <FormInput
              label="Price"
              type="number"
              value={listPrice}
              onChange={(e) => setListPrice(e.target.value)}
              placeholder="0.00"
            />
          </FormRow>
        </FormSection>

        <FormSection title="Classification">
          <FormRow columns={2}>
            <div className="form-group" style={{ marginBottom: 'var(--space-2)' }}>
              <label className="text-label" style={{
                display: 'block', marginBottom: '4px',
                fontSize: 'var(--font-sm)', fontWeight: 500,
                color: 'var(--text-secondary)',
              }}>
                Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="form-input"
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  height: '40px',
                  padding: '10px 12px',
                  fontSize: '12px',
                }}
              >
                <option value="">—</option>
                <option value="consu">Consumable</option>
                <option value="service">Service</option>
                <option value="product">Storable</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 'var(--space-2)' }}>
              <label className="text-label" style={{
                display: 'block', marginBottom: '4px',
                fontSize: 'var(--font-sm)', fontWeight: 500,
                color: 'var(--text-secondary)',
              }}>
                PU Category
              </label>
              <select
                value={puCategory}
                onChange={(e) => setPuCategory(e.target.value)}
                className="form-input"
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  height: '40px',
                  padding: '10px 12px',
                  fontSize: '12px',
                }}
              >
                <option value="">—</option>
                <option value="physical">Physical</option>
                <option value="service">Service</option>
                <option value="contract">Contract</option>
                <option value="digital">Digital</option>
              </select>
            </div>
          </FormRow>
          <FormRow columns={2}>
            <div className="form-group" style={{ marginBottom: 'var(--space-2)' }}>
              <label className="text-label" style={{
                display: 'block', marginBottom: '4px',
                fontSize: 'var(--font-sm)', fontWeight: 500,
                color: 'var(--text-secondary)',
              }}>
                PU Metric
              </label>
              <select
                value={puMetric}
                onChange={(e) => setPuMetric(e.target.value)}
                className="form-input"
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  height: '40px',
                  padding: '10px 12px',
                  fontSize: '12px',
                }}
              >
                <option value="">—</option>
                <option value="piece">Piece</option>
                <option value="duration">Duration</option>
                <option value="count">Count</option>
                <option value="energy">Energy</option>
                <option value="distance">Distance</option>
              </select>
            </div>
            <FormInput
              label="Service Type"
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
              placeholder="Service type"
            />
          </FormRow>
          <FormInput
            label="Contract Type"
            value={contractType}
            onChange={(e) => setContractType(e.target.value)}
            placeholder="Contract type"
          />
        </FormSection>

        <FormSection title="Descriptions">
          <FormInput
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Internal description"
          />
          <FormInput
            label="Sales Description"
            value={descriptionSale}
            onChange={(e) => setDescriptionSale(e.target.value)}
            placeholder="Description shown to customers"
          />
        </FormSection>

        <FormSection title="Settings">
          <div className="flex items-center justify-between py-2">
            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
              Recurring Invoice
            </span>
            <button
              type="button"
              onClick={() => setRecurringInvoice(!recurringInvoice)}
              className={`relative w-10 h-6 rounded-full transition-colors ${
                recurringInvoice ? 'bg-[var(--color-success)]' : 'bg-[var(--bg-surface)]'
              }`}
              style={{ border: recurringInvoice ? 'none' : '1px solid var(--border-default)' }}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  recurringInvoice ? 'translate-x-4' : ''
                }`}
              />
            </button>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
              Available for Sale
            </span>
            <button
              type="button"
              onClick={() => setSaleOk(!saleOk)}
              className={`relative w-10 h-6 rounded-full transition-colors ${
                saleOk ? 'bg-[var(--color-success)]' : 'bg-[var(--bg-surface)]'
              }`}
              style={{ border: saleOk ? 'none' : '1px solid var(--border-default)' }}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  saleOk ? 'translate-x-4' : ''
                }`}
              />
            </button>
          </div>
        </FormSection>
      </div>

      <div className="px-4 py-3 border-t border-border flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 py-3 rounded-xl border border-border text-text-primary font-medium text-sm active:scale-[0.98] transition-transform"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ backgroundColor: 'var(--color-brand)' }}
          className="flex-1 py-3 rounded-xl text-black font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </button>
      </div>
    </div>
  );
}
