'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, User, ShoppingCart, Target, ExternalLink } from 'lucide-react';
import Card from '@/components/ui/Card';
import { PreviewRow } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import type { RollupFileType } from '@/lib/rollup/types';
import { getSalesRoleToken } from '@/lib/attendant-auth';
import { getSAIdForHeaders } from '@/lib/sa-auth';

const ODOO_BASE_URL =
  process.env.NEXT_PUBLIC_ODOO_API_URL || 'https://crm-omnivoltaic.odoo.com';

const ODOO_API_KEY =
  process.env.NEXT_PUBLIC_ODOO_API_KEY || 'abs_connector_secret_key_2024';

interface RollupFileDetailProps {
  type: RollupFileType;
  id: number;
  displayName: string;
  onBack: () => void;
}

function buildDetailHeaders(): HeadersInit {
  const token = getSalesRoleToken();
  const saId = getSAIdForHeaders('sales');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-API-KEY': ODOO_API_KEY,
    // Pin Odoo's response language so translatable fields are identical
    // across devices. See buildOdooHeaders in odoo-api.ts for context.
    'Accept-Language': 'en',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (saId) headers['X-SA-ID'] = saId;
  return headers;
}

function getDetailEndpoint(type: RollupFileType, id: number): string {
  switch (type) {
    case 'customer':
      return `${ODOO_BASE_URL}/api/contacts/${id}`;
    case 'sale_order':
      return `${ODOO_BASE_URL}/api/orders/${id}`;
    case 'lead':
      return `${ODOO_BASE_URL}/api/crm/leads/${id}`;
  }
}

const TYPE_CONFIG: Record<RollupFileType, {
  icon: React.FC<{ size?: number; style?: React.CSSProperties }>;
  color: string;
  label: string;
}> = {
  customer: { icon: User, color: 'var(--color-brand)', label: 'Customer' },
  sale_order: { icon: ShoppingCart, color: 'var(--color-success)', label: 'Sale Order' },
  lead: { icon: Target, color: 'var(--color-warning)', label: 'Lead' },
};

export default function RollupFileDetail({
  type,
  id,
  displayName,
  onBack,
}: RollupFileDetailProps) {
  const [detail, setDetail] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const config = TYPE_CONFIG[type];
  const Icon = config.icon;

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = getDetailEndpoint(type, id);
      const res = await fetch(url, { headers: buildDetailHeaders() });
      if (!res.ok) {
        throw new Error(`Failed to load ${config.label.toLowerCase()} details`);
      }
      const json = await res.json();
      setDetail(json.data ?? json);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load details');
    } finally {
      setLoading(false);
    }
  }, [type, id, config.label]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const renderCustomerFields = () => {
    if (!detail) return null;
    return (
      <>
        {detail.name && <PreviewRow label="Name" value={detail.name} />}
        {detail.email && <PreviewRow label="Email" value={detail.email} />}
        {detail.phone && <PreviewRow label="Phone" value={detail.phone} mono />}
        {detail.mobile && <PreviewRow label="Mobile" value={detail.mobile} mono />}
        {detail.city && <PreviewRow label="City" value={detail.city} />}
        {detail.country && <PreviewRow label="Country" value={typeof detail.country === 'object' ? detail.country.name : detail.country} />}
      </>
    );
  };

  const renderOrderFields = () => {
    if (!detail) return null;
    return (
      <>
        {detail.name && <PreviewRow label="Order" value={detail.name} mono />}
        {detail.state && <PreviewRow label="Status" value={<Badge variant={detail.state === 'sale' ? 'success' : 'secondary'}>{detail.state}</Badge>} />}
        {detail.partner_name && <PreviewRow label="Customer" value={detail.partner_name} />}
        {detail.date_order && <PreviewRow label="Date" value={detail.date_order} />}
        {(detail.amount_total != null) && <PreviewRow label="Total" value={`${detail.amount_total}`} mono />}
        {detail.payment_status && <PreviewRow label="Payment" value={detail.payment_status} />}
      </>
    );
  };

  const renderLeadFields = () => {
    if (!detail) return null;
    return (
      <>
        {detail.name && <PreviewRow label="Lead" value={detail.name} />}
        {detail.contact_name && <PreviewRow label="Contact" value={detail.contact_name} />}
        {detail.email_from && <PreviewRow label="Email" value={detail.email_from} />}
        {detail.phone && <PreviewRow label="Phone" value={detail.phone} mono />}
        {detail.stage_name && <PreviewRow label="Stage" value={detail.stage_name} />}
        {(detail.expected_revenue != null) && <PreviewRow label="Expected Revenue" value={`${detail.expected_revenue}`} mono />}
      </>
    );
  };

  const renderFields = () => {
    switch (type) {
      case 'customer': return renderCustomerFields();
      case 'sale_order': return renderOrderFields();
      case 'lead': return renderLeadFields();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 'var(--space-9)',
            height: 'var(--space-9)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <ArrowLeft size={18} style={{ color: 'var(--text-primary)' }} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="text-h4 truncate">{displayName}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-0-5)' }}>
            <Icon size={14} style={{ color: config.color }} />
            <span className="text-caption text-muted">{config.label}</span>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
          padding: 'var(--space-4) 0',
        }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              style={{
                height: 40,
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-surface)',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <Card variant="outlined">
          <div style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
            <div className="text-body-sm" style={{ color: 'var(--color-error)', marginBottom: 'var(--space-2)' }}>
              {error}
            </div>
            <button
              onClick={fetchDetail}
              style={{
                padding: 'var(--space-2) var(--space-4)',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontSize: 'var(--font-sm)',
                fontFamily: 'var(--font-sans)',
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        </Card>
      )}

      {/* Detail fields */}
      {!loading && !error && detail && (
        <Card variant="default">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {renderFields()}
          </div>
        </Card>
      )}
    </div>
  );
}
