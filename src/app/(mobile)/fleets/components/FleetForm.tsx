'use client';

import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useI18n } from '@/i18n';
import { FormInput, FormSection } from '@/components/ui';
import { getSalesRoleToken } from '@/lib/attendant-auth';
import { createFleet, updateFleet } from '@/lib/fleets-api';
import {
  ASSOCIATION_KIND_OPTIONS,
  ASSOCIATION_ROLE_OPTIONS,
  FLEET_KIND_OPTIONS,
  type AssociationKind,
  type AssociationRole,
  type FleetKind,
  type FleetRow,
} from '@/lib/fleets-types';

const selectStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: 'var(--bg-surface)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text-primary)',
  height: '40px',
  padding: '10px 12px',
  fontSize: '12px',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '4px',
  fontSize: 'var(--font-sm)',
  fontWeight: 500,
  color: 'var(--text-secondary)',
};

interface FleetFormProps {
  /** When set, the form edits this fleet; otherwise it creates a new one. */
  fleet?: FleetRow;
  onDone: (fleet: FleetRow) => void;
  onCancel: () => void;
}

export default function FleetForm({ fleet, onDone, onCancel }: FleetFormProps) {
  const { t } = useI18n();
  const isEdit = Boolean(fleet);

  const [name, setName] = useState(fleet?.name ?? '');
  const [externalRef, setExternalRef] = useState(fleet?.external_ref || '');
  const [fleetKind, setFleetKind] = useState<FleetKind>(fleet?.fleet_kind ?? 'circulation_pool');
  const [associationKind, setAssociationKind] = useState<AssociationKind>('binding');
  const [associationRole, setAssociationRole] = useState<AssociationRole>('operator');
  const [note, setNote] = useState(fleet?.note || '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) {
      newErrors.name = t('fleets.form.nameRequired') || 'Name is required';
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setSaving(true);
    try {
      const token = getSalesRoleToken() || '';
      let saved: FleetRow;
      if (isEdit && fleet) {
        saved = await updateFleet(
          fleet.id,
          {
            name: name.trim(),
            external_ref: externalRef.trim(),
            fleet_kind: fleetKind,
            note: note.trim(),
          },
          token,
        );
        toast.success(t('fleets.form.updated') || 'Fleet updated');
      } else {
        saved = await createFleet(
          {
            name: name.trim(),
            external_ref: externalRef.trim() || undefined,
            fleet_kind: fleetKind,
            association_kind: associationKind,
            association_role: associationRole,
            note: note.trim() || undefined,
          },
          token,
        );
        toast.success(t('fleets.form.created') || 'Fleet created');
      }
      onDone(saved);
    } catch (err: any) {
      toast.error(err?.message ?? (t('fleets.form.saveError') || 'Failed to save fleet'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 pt-3 pb-2">
        <button
          onClick={onCancel}
          className="p-2 -ml-2 rounded-lg hover:bg-bg-elevated transition-colors"
          aria-label={t('common.back') || 'Back'}
        >
          <ArrowLeft size={20} className="text-text-primary" />
        </button>
        <h2 className="text-lg font-semibold text-text-primary">
          {isEdit
            ? (t('fleets.form.editTitle') || 'Edit Fleet')
            : (t('fleets.form.createTitle') || 'New Fleet')}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <FormSection title={t('fleets.form.detailsSection') || 'Fleet Details'}>
          <FormInput
            label={t('fleets.form.name') || 'Name'}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('fleets.form.namePlaceholder') || 'e.g. Nairobi rental pool'}
            error={errors.name}
          />
          <FormInput
            label={t('fleets.form.externalRef') || 'External reference'}
            value={externalRef}
            onChange={(e) => setExternalRef(e.target.value)}
            placeholder={t('fleets.form.externalRefPlaceholder') || 'Stable id used by ABS/ARM, e.g. arm-fleet-abc123'}
            helperText={t('fleets.form.externalRefHint') || 'Optional. External systems resolve this fleet by this reference.'}
          />
          <div className="form-group" style={{ marginBottom: 'var(--space-2)' }}>
            <label className="text-label" style={labelStyle}>
              {t('fleets.form.kind') || 'Kind'}
            </label>
            <select
              value={fleetKind}
              onChange={(e) => setFleetKind(e.target.value as FleetKind)}
              className="form-input"
              style={selectStyle}
            >
              {FLEET_KIND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </FormSection>

        {/* Assignment fields only make sense at creation time — they seed the
            ov.sa_fleet_assignment row for the selected SA. */}
        {!isEdit && (
          <FormSection title={t('fleets.form.assignmentSection') || 'Account Association'}>
            <div className="form-group" style={{ marginBottom: 'var(--space-2)' }}>
              <label className="text-label" style={labelStyle}>
                {t('fleets.form.associationRole') || 'Account role'}
              </label>
              <select
                value={associationRole}
                onChange={(e) => setAssociationRole(e.target.value as AssociationRole)}
                className="form-input"
                style={selectStyle}
              >
                {ASSOCIATION_ROLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 'var(--space-2)' }}>
              <label className="text-label" style={labelStyle}>
                {t('fleets.form.associationKind') || 'Account association'}
              </label>
              <select
                value={associationKind}
                onChange={(e) => setAssociationKind(e.target.value as AssociationKind)}
                className="form-input"
                style={selectStyle}
              >
                {ASSOCIATION_KIND_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <p className="text-xs text-text-muted mt-1">
                {t('fleets.form.associationKindHint') ||
                  'Access-only fleets can be listed but serials cannot be assigned from this account.'}
              </p>
            </div>
          </FormSection>
        )}

        <FormSection title={t('fleets.form.noteSection') || 'Note'}>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            placeholder={t('fleets.form.notePlaceholder') || 'Internal notes about this fleet.'}
            className="w-full px-3 py-2 rounded-lg border border-border bg-bg-surface text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
          />
        </FormSection>
      </div>

      <div className="px-4 py-3 border-t border-border flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 py-3 rounded-xl border border-border text-text-primary font-medium text-sm active:scale-[0.98] transition-transform"
        >
          {t('common.cancel') || 'Cancel'}
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
              {t('fleets.form.saving') || 'Saving...'}
            </>
          ) : isEdit ? (
            t('fleets.form.saveChanges') || 'Save Changes'
          ) : (
            t('fleets.form.create') || 'Create Fleet'
          )}
        </button>
      </div>
    </div>
  );
}
