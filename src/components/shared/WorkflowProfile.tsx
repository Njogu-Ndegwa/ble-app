"use client";

import React from 'react';
import { useI18n } from '@/i18n';
import { IdCard, Mail, HelpCircle, LogOut, ChevronRight, type LucideIcon } from 'lucide-react';

export interface WorkflowProfileProps {
  employee: {
    id: string | number;
    name: string;
    email: string;
    phone?: string;
  } | null;
  onLogout: () => void;
  /** Icon shown in the role card header */
  roleIcon: LucideIcon;
  /** Display label for the role (e.g. "Swap Attendant", "Sales Representative") */
  roleLabel: string;
  /** Label under the employee ID row */
  employeeIdLabel?: string;
  /** Fallback initials when employee name is unavailable */
  fallbackInitials?: string;
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

const WorkflowProfile: React.FC<WorkflowProfileProps> = ({
  employee,
  onLogout,
  roleIcon: RoleIcon,
  roleLabel,
  employeeIdLabel,
  fallbackInitials = '??',
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

      {/* Role Card */}
      <div className="bg-bg-secondary border border-border rounded-xl p-4 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-brand flex items-center justify-center flex-shrink-0">
            <RoleIcon size={20} className="text-text-inverse" />
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

        {/* Info Rows */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-info-soft border border-brand/20">
            <div className="w-9 h-9 rounded-lg bg-brand flex items-center justify-center flex-shrink-0">
              <IdCard size={18} className="text-text-inverse" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-primary">ID #{employee?.id || 'N/A'}</p>
              <p className="text-xs text-text-muted">{idLabel}</p>
            </div>
          </div>

          {employee?.email && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-bg-tertiary">
              <div className="w-9 h-9 rounded-full bg-bg-elevated flex items-center justify-center flex-shrink-0 border border-border">
                <Mail size={16} className="text-brand" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-text-primary break-all">{employee.email}</p>
                <p className="text-xs text-text-muted">{t('profile.emailAddress') || 'Email Address'}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Menu */}
      <div className="bg-bg-secondary border border-border rounded-xl overflow-hidden">
        <button className="flex items-center gap-3 w-full px-4 py-3.5 text-left transition-colors hover:bg-bg-tertiary active:bg-bg-tertiary border-b border-border-subtle">
          <div className="w-9 h-9 rounded-full bg-bg-tertiary flex items-center justify-center flex-shrink-0">
            <HelpCircle size={18} className="text-text-secondary" />
          </div>
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
          <div className="w-9 h-9 rounded-full bg-error-soft flex items-center justify-center flex-shrink-0">
            <LogOut size={18} className="text-error" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-error">{t('common.logout') || 'Log Out'}</p>
          </div>
        </button>
      </div>
    </div>
  );
};

export default WorkflowProfile;
