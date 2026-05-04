"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MyDevicesRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/assets/ble-devices');
  }, [router]);
  return null;
}
