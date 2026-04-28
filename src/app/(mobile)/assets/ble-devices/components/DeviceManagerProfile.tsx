"use client";

import React, { useEffect, useState } from 'react';
import { useI18n } from '@/i18n';
import { WorkflowProfile } from '@/components/shared';
import { getDecodedToken } from '@/lib/auth';

interface DeviceManagerProfileProps {
  /** @deprecated Change role is now exposed via the header back button. Kept for backwards compatibility. */
  onChangeRole?: () => void;
  onLogout: () => void;
  /** @deprecated The active tool is reflected in the bottom nav; the profile always shows the role. */
  toolLabel?: string;
  /** @deprecated Kept for backwards compatibility, no longer rendered. */
  toolSubtitle?: string;
}

interface DeviceManagerEmployee {
  id: string | number;
  name: string;
  email: string;
  phone?: string;
}

const DeviceManagerProfile: React.FC<DeviceManagerProfileProps> = ({ onLogout }) => {
  const { t } = useI18n();
  const [employee, setEmployee] = useState<DeviceManagerEmployee | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let storedName = '';
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const parsed = JSON.parse(raw);
        storedName = parsed?.name || '';
      }
    } catch {
      /* ignore malformed user blob */
    }

    const decoded = getDecodedToken();
    const email: string = decoded?.email || '';
    const id: string | number =
      decoded?.user_id ?? localStorage.getItem('distributorId') ?? 'N/A';
    const name = storedName || decoded?.username || decoded?.name || '';

    if (!name && !email && id === 'N/A') {
      setEmployee(null);
      return;
    }

    setEmployee({
      id,
      name,
      email,
    });
  }, []);

  return (
    <WorkflowProfile
      employee={employee}
      onLogout={onLogout}
      roleIconSrc="/assets/BleDeviceAttendant.svg"
      roleLabel={t('role.bleDeviceManager') || 'Device Manager'}
      employeeIdLabel={t('profile.employeeId') || 'Employee ID'}
      fallbackInitials="DM"
    />
  );
};

export default DeviceManagerProfile;
