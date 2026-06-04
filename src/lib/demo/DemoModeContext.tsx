'use client';

/**
 * Demo Mode context for the Manual Swap simulation harness.
 *
 * When active (`isDemo === true`), the Attendant flow short-circuits every
 * backend/BLE touchpoint and feeds scenario-driven mock data instead, so the
 * whole manual-swap process can be walked on a desktop with no device and no
 * network. The default value is inert (`isDemo === false`), so `useDemoMode()`
 * is a safe no-op on the real `/attendant/manual-swap` route where no provider
 * is mounted.
 */

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';

export type DemoScenarioId = 'enough' | 'notEnough';

export interface DemoModeValue {
  /** True only inside the demo route. Production code paths read this to stay inert. */
  isDemo: boolean;
  /** Which simulated quota situation is active. */
  scenario: DemoScenarioId;
  /** Switch the active scenario (restarts the flow via the remount key). */
  setScenario: (scenario: DemoScenarioId) => void;
  /** Restart the flow at step 1 without changing scenario. */
  restart: () => void;
  /** Changes whenever scenario or restart-nonce changes; use as a remount key. */
  flowKey: string;
}

const INERT: DemoModeValue = {
  isDemo: false,
  scenario: 'enough',
  setScenario: () => {},
  restart: () => {},
  flowKey: '',
};

const DemoModeContext = createContext<DemoModeValue>(INERT);

export function useDemoMode(): DemoModeValue {
  return useContext(DemoModeContext);
}

export function DemoModeProvider({
  children,
  initialScenario = 'enough',
}: {
  children: ReactNode;
  initialScenario?: DemoScenarioId;
}) {
  const [scenario, setScenarioState] = useState<DemoScenarioId>(initialScenario);
  const [nonce, setNonce] = useState(0);

  const setScenario = useCallback((next: DemoScenarioId) => {
    setScenarioState(next);
    // Bump the nonce too so picking the *same* scenario still restarts the flow.
    setNonce((n) => n + 1);
  }, []);

  const restart = useCallback(() => {
    setNonce((n) => n + 1);
  }, []);

  const value = useMemo<DemoModeValue>(
    () => ({
      isDemo: true,
      scenario,
      setScenario,
      restart,
      flowKey: `${scenario}:${nonce}`,
    }),
    [scenario, setScenario, restart, nonce],
  );

  return <DemoModeContext.Provider value={value}>{children}</DemoModeContext.Provider>;
}
