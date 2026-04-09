"use client";

import React from 'react';
import { UserPlus } from 'lucide-react';
import { useI18n } from '@/i18n';
import { WorkflowProfile } from '@/components/shared';

interface AttendantProfileProps {
  employee: {
    id: string | number;
    name: string;
    email: string;
    phone?: string;
  } | null;
  onLogout: () => void;
  serviceAccount?: { name: string; my_role: string; account_class: string } | null;
  onSwitchSA?: () => void;
}

const AttendantProfile: React.FC<AttendantProfileProps> = ({ employee, onLogout, serviceAccount, onSwitchSA }) => {
  const { t } = useI18n();

  return (
    <WorkflowProfile
      employee={employee}
      onLogout={onLogout}
      roleIcon={UserPlus}
      roleLabel={t('role.attendant') || 'Swap Attendant'}
      employeeIdLabel={t('attendant.profile.employeeId') || 'Employee ID'}
      fallbackInitials="AT"
      serviceAccount={serviceAccount}
      onSwitchSA={onSwitchSA}
    />
  );
};

export default AttendantProfile;
