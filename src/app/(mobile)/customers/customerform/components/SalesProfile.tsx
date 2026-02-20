"use client";

import React from 'react';
import { ShoppingBag } from 'lucide-react';
import { useI18n } from '@/i18n';
import { WorkflowProfile } from '@/components/shared';

interface SalesProfileProps {
  employee: {
    id: string | number;
    name: string;
    email: string;
    phone?: string;
  } | null;
  onLogout: () => void;
}

const SalesProfile: React.FC<SalesProfileProps> = ({ employee, onLogout }) => {
  const { t } = useI18n();

  return (
    <WorkflowProfile
      employee={employee}
      onLogout={onLogout}
      roleIcon={ShoppingBag}
      roleLabel={t('role.salesRep') || 'Sales Representative'}
      employeeIdLabel={t('sales.profile.employeeId') || 'Employee ID'}
      fallbackInitials="SR"
    />
  );
};

export default SalesProfile;
