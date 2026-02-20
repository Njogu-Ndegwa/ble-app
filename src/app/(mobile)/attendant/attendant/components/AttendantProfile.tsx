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
}

const AttendantProfile: React.FC<AttendantProfileProps> = ({ employee, onLogout }) => {
  const { t } = useI18n();

  return (
    <WorkflowProfile
      employee={employee}
      onLogout={onLogout}
      roleIcon={UserPlus}
      roleLabel={t('role.attendant') || 'Swap Attendant'}
      employeeIdLabel={t('attendant.profile.employeeId') || 'Employee ID'}
      fallbackInitials="AT"
    />
  );
};

export default AttendantProfile;
