// app/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { isAuthenticated } from '@/lib/auth';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    // Check authentication status
    if (isAuthenticated()) {
      router.replace('/assets/ble-devices'); // Redirect authenticated users
    } else {
      router.replace('/keypad/keypad'); // Redirect non-authenticated users
    }
  }, [router]);

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-[#24272C] to-[#0C0C0E] flex items-center justify-center">
      <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
    </div>
  );
}