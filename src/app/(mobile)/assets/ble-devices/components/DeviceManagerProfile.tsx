"use client";

import React, { useEffect, useState } from 'react';
import { useI18n } from '@/i18n';
import { WorkflowProfile } from '@/components/shared';
import { BLE_DM_TOKEN_KEY, BLE_DM_USER_KEY } from '../BleDevicesLogin';

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

    // Read the employee record that was stored by BleDevicesLogin at sign-in time.
    // Both keys live in localStorage and persist across app restarts.
    const token = localStorage.getItem(BLE_DM_TOKEN_KEY);
    if (!token) {
      setEmployee(null);
      return;
    }

    try {
      const raw = localStorage.getItem(BLE_DM_USER_KEY);
      if (raw) {
        const user = JSON.parse(raw);
        setEmployee({
          id: user.id ?? 'N/A',
          name: user.name ?? '',
          email: user.email ?? '',
          phone: user.phone ?? undefined,
        });
      } else {
        setEmployee(null);
      }
    } catch {
      setEmployee(null);
    }
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
