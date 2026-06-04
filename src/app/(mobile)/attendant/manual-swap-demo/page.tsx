"use client";

/**
 * Manual Swap — DEMO / simulation route.
 *
 * Renders the REAL Attendant manual-swap flow (AttendantApp with
 * workflowMode="manual-payment") wrapped in a DemoModeProvider. In demo mode the
 * flow short-circuits every backend/BLE call and feeds scenario-driven mock data,
 * so the whole process can be walked on a desktop with no device and no network.
 *
 * Pick "Enough quota" vs "Not enough quota" from the floating DEMO control to see
 * how the pages differ — the "Not enough" run lands on the new manual-swap Review
 * notice that steers the customer to buy a new subscription plan.
 *
 * This route deliberately bypasses AttendantPageShell (Microsoft login + Service
 * Account selection) so it needs no real credentials. It is a test harness only.
 */

import React, { Suspense } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Toaster } from "react-hot-toast";
import {
  DemoModeProvider,
  useDemoMode,
  type DemoScenarioId,
} from "@/lib/demo/DemoModeContext";
import DemoScenarioPicker from "@/lib/demo/DemoScenarioPicker";

const Loading = () => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      height: "100dvh",
      background: "var(--bg-primary, #0a0a0a)",
    }}
  >
    <div className="loading-spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
  </div>
);

const ManualSwapApp = dynamic(() => import("../attendant/AttendantApp"), {
  loading: Loading,
  ssr: false,
});

// Remounts the whole flow whenever the scenario (or restart nonce) changes, so
// every run starts clean at step 1 with the selected mock data.
function DemoFlowHost() {
  const { flowKey } = useDemoMode();
  return <ManualSwapApp key={flowKey} workflowMode="manual-payment" />;
}

function DemoContent() {
  const search = useSearchParams();
  const initialScenario: DemoScenarioId =
    search.get("scenario") === "notEnough" ? "notEnough" : "enough";

  return (
    <DemoModeProvider initialScenario={initialScenario}>
      <Toaster position="top-center" />
      <DemoFlowHost />
      <DemoScenarioPicker />
    </DemoModeProvider>
  );
}

export default function ManualSwapDemoPage() {
  return (
    <Suspense fallback={<Loading />}>
      <DemoContent />
    </Suspense>
  );
}
