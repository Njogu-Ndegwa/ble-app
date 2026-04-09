"use client";

import React from 'react';
import { useI18n } from '@/i18n';
import { IdCard, Mail, HelpCircle, LogOut, ChevronRight, ArrowLeftRight, Building2, type LucideIcon } from 'lucide-react';

export interface WorkflowProfileProps {
  employee: {
    id: string | number;
    name: string;
    email: string;
    phone?: string;
  } | null;
  onLogout: () => void;
  /** Lucide icon shown in the role card header */
  roleIcon?: LucideIcon;
  /** Image source for a custom SVG/PNG role icon (takes precedence over roleIcon) */
  roleIconSrc?: string;
  /** Display label for the role (e.g. "Swap Attendant", "Sales Representative") */
  roleLabel: string;
  /** Label under the employee ID row */
  employeeIdLabel?: string;
  /** Fallback initials when employee name is unavailable */
  fallbackInitials?: string;
  /** Currently selected Service Account (omit to hide SA section) */
  serviceAccount?: { name: string; my_role: string; account_class: string } | null;
  /** Called when the user wants to switch to a different Service Account */
  onSwitchSA?: () => void;
}

function formatPhoneNumber(phone: string): string {
  if (!phone) return "";
  let cleaned = phone.replace(/\s+/g, "");
  if (!cleaned.startsWith("+")) {
    cleaned = "+" + cleaned;
  }
  const match = cleaned.match(/^(\+\d{1,3})(\d+)$/);
  if (match) {
    const countryCode = match[1];
    const remaining = match[2];
    const groups: string[] = [];
    let i = 0;
    if (remaining.length > 0) {
      groups.push(remaining.slice(0, 2));
      i = 2;
    }
    while (i < remaining.length) {
      groups.push(remaining.slice(i, i + 3));
      i += 3;
    }
    return `${countryCode} ${groups.join(" ")}`;
  }
  return cleaned;
}

const ROLE_BADGE_CLASS: Record<string, string> = {
  admin: 'sa-badge-admin',
  staff: 'sa-badge-staff',
  agent: 'sa-badge-agent',
};

const WorkflowProfile: React.FC<WorkflowProfileProps> = ({
  employee,
  onLogout,
  roleIcon: RoleIcon,
  roleIconSrc,
  roleLabel,
  employeeIdLabel,
  fallbackInitials = '??',
  serviceAccount,
  onSwitchSA,
}) => {
  const { t } = useI18n();

  const initials = employee?.name
    ? employee.name
        .split(' ')
        .map(n => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : fallbackInitials;

  const idLabel = employeeIdLabel || t('profile.employeeId') || 'Employee ID';

  return (
    <div className="flex flex-col flex-1 min-h-0 p-4 overflow-y-auto">
      {/* Profile Header */}
      <div className="flex flex-col items-center text-center pt-2 pb-6">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-2xl font-bold text-white mb-3">
          {initials}
        </div>
        <h2 className="text-xl font-bold text-text-primary">
          {employee?.name || t('common.guest') || 'Guest'}
        </h2>
        <p className="text-sm text-text-muted font-mono mt-1">
          {employee?.phone ? formatPhoneNumber(employee.phone) : employee?.email || ''}
        </p>
      </div>

      {/* Details Card */}
      <div className="bg-bg-secondary border border-border rounded-xl overflow-hidden mb-4">
        {/* Role header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border-subtle">
          <div className="w-10 h-10 rounded-lg bg-brand flex items-center justify-center flex-shrink-0">
            {roleIconSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={roleIconSrc} alt="" width={20} height={20} style={{ objectFit: 'contain' }} draggable={false} />
            ) : RoleIcon ? (
              <RoleIcon size={20} className="text-text-inverse" />
            ) : null}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-primary">{roleLabel}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              <span className="text-xs text-success font-medium">
                {t('common.active') || 'Active'}
              </span>
            </div>
          </div>
        </div>

        {/* Employee ID */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle">
          <IdCard size={18} className="text-text-muted flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-text-muted">{idLabel}</p>
            <p className="text-sm font-medium text-text-primary">#{employee?.id || 'N/A'}</p>
          </div>
        </div>

        {/* Email */}
        {employee?.email && (
          <div className="flex items-center gap-3 px-4 py-3">
            <Mail size={18} className="text-text-muted flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-text-muted">{t('profile.emailAddress') || 'Email Address'}</p>
              <p className="text-sm text-text-primary break-all">{employee.email}</p>
            </div>
          </div>
        )}
      </div>

      {/* Service Account Card */}
      {serviceAccount && onSwitchSA && (
        <div className="bg-bg-secondary border border-border rounded-xl overflow-hidden mb-4">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <Building2 size={18} className="text-text-muted flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-text-muted">{t('sa.currentAccount') || 'Service Account'}</p>
              <p className="text-sm font-medium text-text-primary truncate">{serviceAccount.name}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`sa-badge ${ROLE_BADGE_CLASS[serviceAccount.my_role] ?? 'sa-badge-agent'}`}>
                  {serviceAccount.my_role}
                </span>
                <span className="sa-badge sa-badge-class">
                  {serviceAccount.account_class}
                </span>
              </div>
            </div>
            <button
              onClick={onSwitchSA}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand/10 text-brand text-xs font-medium transition-colors hover:bg-brand/20 active:bg-brand/25 flex-shrink-0"
            >
              <ArrowLeftRight size={13} />
              <span>{t('sa.switchAccount') || 'Switch'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Menu */}
      <div className="bg-bg-secondary border border-border rounded-xl overflow-hidden">
        <button className="flex items-center gap-3 w-full px-4 py-3.5 text-left transition-colors hover:bg-bg-tertiary active:bg-bg-tertiary border-b border-border-subtle">
          <HelpCircle size={18} className="text-text-muted flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary">{t('rider.helpSupport') || 'Help & Support'}</p>
            <p className="text-xs text-text-muted">{t('rider.supportDesc') || 'FAQs, contact support'}</p>
          </div>
          <ChevronRight size={16} className="text-text-muted flex-shrink-0" />
        </button>

        <button
          onClick={onLogout}
          className="flex items-center gap-3 w-full px-4 py-3.5 text-left transition-colors hover:bg-error-soft active:bg-error-soft"
        >
          <LogOut size={18} className="text-error flex-shrink-0" />
          <p className="text-sm font-medium text-error">{t('common.logout') || 'Log Out'}</p>
        </button>
      </div>
    </div>
  );
};

export default WorkflowProfile;
