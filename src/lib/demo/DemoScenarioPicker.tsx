'use client';

/**
 * Floating control for the Manual Swap demo harness.
 *
 * Lets you pick which quota situation to simulate and restart the flow. Picking
 * a scenario restarts the flow at step 1 (via the remount key in DemoModeProvider)
 * so you always walk a clean run with the chosen data.
 */

import React, { useState } from 'react';
import { useDemoMode } from './DemoModeContext';
import { DEMO_SCENARIO_OPTIONS } from './manualSwapScenarios';

export default function DemoScenarioPicker() {
  const { isDemo, scenario, setScenario, restart } = useDemoMode();
  const [collapsed, setCollapsed] = useState(false);

  if (!isDemo) return null;

  return (
    <div className={`demo-picker ${collapsed ? 'is-collapsed' : ''}`}>
      <button
        type="button"
        className="demo-picker-badge"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
      >
        <span className="demo-dot" />
        DEMO
        <span className="demo-caret">{collapsed ? '▴' : '▾'}</span>
      </button>

      {!collapsed && (
        <div className="demo-picker-body">
          <p className="demo-picker-title">Simulate scenario</p>
          <div className="demo-picker-options">
            {DEMO_SCENARIO_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`demo-opt ${scenario === opt.id ? 'is-active' : ''}`}
                onClick={() => setScenario(opt.id)}
              >
                <span className="demo-opt-label">{opt.label}</span>
                <span className="demo-opt-hint">{opt.hint}</span>
              </button>
            ))}
          </div>
          <button type="button" className="demo-restart" onClick={restart}>
            ↻ Restart flow
          </button>
          <p className="demo-picker-foot">No backend · no device · mock data</p>
        </div>
      )}

      <style jsx>{`
        .demo-picker {
          position: fixed;
          top: 10px;
          right: 10px;
          z-index: 99999;
          width: 232px;
          font-family: inherit;
          color: #f4f4f5;
          filter: drop-shadow(0 8px 24px rgba(0, 0, 0, 0.45));
        }
        .demo-picker.is-collapsed {
          width: auto;
        }
        .demo-picker-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 10px;
          border: none;
          border-radius: 999px;
          background: linear-gradient(135deg, #7c3aed, #db2777);
          color: #fff;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          cursor: pointer;
        }
        .demo-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #4ade80;
          box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.6);
          animation: demo-pulse 1.8s infinite;
        }
        .demo-caret {
          font-size: 9px;
          opacity: 0.85;
        }
        .demo-picker-body {
          margin-top: 8px;
          padding: 12px;
          border-radius: 14px;
          background: rgba(20, 20, 24, 0.96);
          border: 1px solid rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(8px);
        }
        .demo-picker-title {
          margin: 0 0 8px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #a1a1aa;
        }
        .demo-picker-options {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .demo-opt {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 9px 10px;
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.03);
          text-align: left;
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s;
        }
        .demo-opt:hover {
          background: rgba(255, 255, 255, 0.06);
        }
        .demo-opt.is-active {
          border-color: #7c3aed;
          background: rgba(124, 58, 237, 0.18);
        }
        .demo-opt-label {
          font-size: 13px;
          font-weight: 600;
          color: #f4f4f5;
        }
        .demo-opt-hint {
          font-size: 11px;
          line-height: 1.3;
          color: #a1a1aa;
        }
        .demo-restart {
          margin-top: 10px;
          width: 100%;
          padding: 8px;
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.04);
          color: #f4f4f5;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .demo-restart:hover {
          background: rgba(255, 255, 255, 0.09);
        }
        .demo-picker-foot {
          margin: 8px 0 0;
          font-size: 10px;
          text-align: center;
          color: #71717a;
        }
        @keyframes demo-pulse {
          0% { box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.55); }
          70% { box-shadow: 0 0 0 6px rgba(74, 222, 128, 0); }
          100% { box-shadow: 0 0 0 0 rgba(74, 222, 128, 0); }
        }
      `}</style>
    </div>
  );
}
