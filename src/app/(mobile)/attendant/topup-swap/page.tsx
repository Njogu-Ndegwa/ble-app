"use client";

import dynamic from "next/dynamic";
import AttendantPageShell from "../AttendantPageShell";

const TopUpSwapApp = dynamic(() => import("../attendant/AttendantApp"), {
  loading: () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', flexDirection: 'column', gap: 16, background: 'var(--bg-primary, #0a0a0a)' }}>
      <div className="loading-spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
    </div>
  ),
  ssr: false,
});

// Wrapper component to inject the top-up-only workflow mode. In this mode the
// rider is never charged a cash differential at the counter — when quota is
// short they are asked to top up in the Rider app — and the Pay step is dropped
// from the timeline entirely.
function TopUpSwapAppWrapper(props: { onLogout?: () => void; onSwitchSA?: () => void }) {
  return <TopUpSwapApp {...props} workflowMode="topup-only" />;
}

export default function TopUpSwapPage() {
  return (
    <AttendantPageShell
      appComponent={TopUpSwapAppWrapper}
      microsoftReturnPath="/attendant/topup-swap"
      saKey="attendant"
    />
  );
}
