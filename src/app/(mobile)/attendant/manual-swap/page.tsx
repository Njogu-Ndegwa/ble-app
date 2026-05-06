"use client";

import dynamic from "next/dynamic";
import AttendantPageShell from "../AttendantPageShell";

const ManualSwapApp = dynamic(() => import("../attendant/AttendantApp"), {
  loading: () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', flexDirection: 'column', gap: 16, background: 'var(--bg-primary, #0a0a0a)' }}>
      <div className="loading-spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
    </div>
  ),
  ssr: false,
});

// Wrapper component to inject manual-payment workflow mode
function ManualSwapAppWrapper(props: { onLogout?: () => void; onSwitchSA?: () => void }) {
  return <ManualSwapApp {...props} workflowMode="manual-payment" />;
}

export default function ManualSwapPage() {
  return (
    <AttendantPageShell
      appComponent={ManualSwapAppWrapper}
      microsoftReturnPath="/attendant/manual-swap"
      saKey="attendant"
    />
  );
}
