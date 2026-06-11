# Device Details Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the My Devices → Details page per the approved spec (`docs/superpowers/specs/2026-06-11-device-detail-redesign-design.md`): primary "Add days" card, fixed result zone, quiet Free/Reset rows with confirmation, CMD Service demoted to a collapsed Advanced panel — all BLE/GraphQL logic unchanged.

**Architecture:** `DeviceDetailView.tsx` keeps every piece of state and logic (state machine, GraphQL calls, BLE write + verify loop) and becomes a composer of five new presentational components in `devices/components/`. A shared `types.ts` holds the moved type definitions. A generic `ConfirmModal` is added to the existing `src/app/modals.tsx`.

**Tech Stack:** Next.js / React functional components, TypeScript, lucide-react icons, CSS variables from `globals.css`, `useI18n()` for strings, react-hot-toast.

**Verification convention (replaces TDD steps):** this repo has no unit-test infrastructure; per `AGENTS.md` each task verifies with `npx tsc --noEmit` and the final task adds `npx next lint` + `npx next build`. On-device BLE testing is done by Dennis.

**Working directory:** `C:\Users\pc\ble-app`, branch `dev`. The repo has unrelated uncommitted changes — stage ONLY the files named in each commit step, never `git add -A`.

---

## File Structure

- Create `src/app/(mobile)/mydevices/devices/components/types.ts` — shared types (`CodeType`, `ResultState`, `LastCode`)
- Modify `src/app/modals.tsx` — add `ConfirmModal` (reuses internal `Modal`)
- Create `src/app/(mobile)/mydevices/devices/components/StatusCard.tsx` — remaining-days card
- Create `src/app/(mobile)/mydevices/devices/components/AddDaysCard.tsx` — chips + custom input + generate button
- Create `src/app/(mobile)/mydevices/devices/components/ResultZone.tsx` — seven-state fixed slot
- Create `src/app/(mobile)/mydevices/devices/components/OtherCodes.tsx` — Free/Reset rows
- Create `src/app/(mobile)/mydevices/devices/components/AdvancedPanel.tsx` — disclosure wrapping the CMD service panel
- Modify `src/app/(mobile)/mydevices/devices/DeviceDetailView.tsx` — import types, add new state, swap render
- Modify `src/i18n/messages/en.json` — new strings

Existing components for reference style: `src/app/(mobile)/mydevices/devices/MobileListView.tsx` (inline styles + CSS variables idiom).

---

### Task 1: Shared types + ConfirmModal

**Files:**
- Create: `src/app/(mobile)/mydevices/devices/components/types.ts`
- Modify: `src/app/modals.tsx` (append after `NumericModal`)

- [ ] **Step 1.1: Create `types.ts`**

```ts
export type CodeType = 'days' | 'free' | 'reset' | 'retrieve';

export type ResultStatus =
  | 'idle' | 'generating' | 'generated' | 'writing' | 'written' | 'writeFailed' | 'error';

export interface ResultState {
  status: ResultStatus;
  codeType: CodeType | null;
  codeDec: string | null;
  error: string | null;
}

export interface LastCode {
  codeDec: string;
  codeType: CodeType;
  at: number;
}
```

- [ ] **Step 1.2: Append `ConfirmModal` to `src/app/modals.tsx`**

Add at end of file (it reuses the file-private `Modal` and follows `AsciiStringModal`'s shape):

```tsx
// Confirmation Modal
export const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
}) => {
  const { t } = useI18n();

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-5 pt-0">
        <h3 className="text-xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>{title}</h3>
        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>{message}</p>
        <div className="flex justify-end space-x-3">
          <button onClick={onClose} className="btn btn-secondary">
            {t('Cancel')}
          </button>
          <button onClick={() => { onConfirm(); onClose(); }} className="btn btn-primary">
            {confirmLabel || t('Confirm')}
          </button>
        </div>
      </div>
    </Modal>
  );
};
```

- [ ] **Step 1.3: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0 (no new errors).

- [ ] **Step 1.4: Commit**

```bash
git add "src/app/(mobile)/mydevices/devices/components/types.ts" src/app/modals.tsx
git commit -m "feat(mydevices): shared detail-view types and ConfirmModal"
```

---

### Task 2: StatusCard

**Files:**
- Create: `src/app/(mobile)/mydevices/devices/components/StatusCard.tsx`

- [ ] **Step 2.1: Create component**

```tsx
'use client';

import React from 'react';
import { Calendar, Loader2 } from 'lucide-react';
import { useI18n } from '@/i18n';

interface StatusCardProps {
  hasRcrd: boolean;
  remainingDays: string | null;
  isRefreshing: boolean;
}

const StatusCard: React.FC<StatusCardProps> = ({ hasRcrd, remainingDays, isRefreshing }) => {
  const { t } = useI18n();

  return (
    <div
      className="rounded-xl p-4 mb-4 flex items-center gap-3"
      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: 'var(--accent-soft)' }}
      >
        <Calendar size={20} style={{ color: 'var(--accent)' }} />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="text-xs font-medium uppercase tracking-wide"
          style={{ color: 'var(--text-secondary)' }}
        >
          {t('Remaining Days')}
        </p>
        {isRefreshing ? (
          <div className="flex items-center gap-2 mt-1">
            <Loader2 size={18} className="animate-spin" style={{ color: 'var(--accent)' }} />
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('Updating...')}</span>
          </div>
        ) : hasRcrd ? (
          <span className="text-3xl font-bold font-mono leading-tight" style={{ color: 'var(--text-primary)' }}>
            {remainingDays ?? t('N/A')}
          </span>
        ) : (
          <span className="text-sm animate-pulse" style={{ color: 'var(--text-muted)' }}>{t('Loading...')}</span>
        )}
      </div>
    </div>
  );
};

export default StatusCard;
```

- [ ] **Step 2.2: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 2.3: Commit**

```bash
git add "src/app/(mobile)/mydevices/devices/components/StatusCard.tsx"
git commit -m "feat(mydevices): StatusCard component for detail redesign"
```

---

### Task 3: AddDaysCard

**Files:**
- Create: `src/app/(mobile)/mydevices/devices/components/AddDaysCard.tsx`

- [ ] **Step 3.1: Create component**

```tsx
'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { useI18n } from '@/i18n';

const QUICK_DAYS = [7, 14, 30, 90] as const;

interface AddDaysCardProps {
  selectedChip: number | 'custom' | null;
  customDays: string;
  duration: number | null;
  isBusy: boolean;
  busyActive: boolean;
  onSelectChip: (chip: number | 'custom') => void;
  onCustomChange: (raw: string) => void;
  onGenerate: () => void;
}

const AddDaysCard: React.FC<AddDaysCardProps> = ({
  selectedChip, customDays, duration, isBusy, busyActive,
  onSelectChip, onCustomChange, onGenerate,
}) => {
  const { t } = useI18n();
  const disabled = isBusy || !duration;

  return (
    <div
      className="rounded-xl p-4 mb-4"
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--accent-glow)',
        boxShadow: '0 0 24px -10px var(--accent-glow)',
      }}
    >
      <p
        className="text-xs font-semibold uppercase tracking-wide mb-3"
        style={{ color: 'var(--accent)' }}
      >
        {t('Add days')}
      </p>
      <div className="flex gap-2 mb-3">
        {QUICK_DAYS.map((d) => {
          const active = selectedChip === d;
          return (
            <button
              key={d}
              className="flex-1 rounded-lg text-sm font-semibold py-2 transition-colors"
              style={{
                background: active ? 'var(--accent-soft)' : 'transparent',
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                color: active ? 'var(--accent)' : 'var(--text-secondary)',
              }}
              onClick={() => onSelectChip(d)}
              disabled={isBusy}
            >
              {d}
            </button>
          );
        })}
        <button
          className="rounded-lg text-sm font-semibold py-2 px-3 transition-colors"
          style={{
            flex: '1.3 1 0%',
            background: selectedChip === 'custom' ? 'var(--accent-soft)' : 'transparent',
            border: `1px solid ${selectedChip === 'custom' ? 'var(--accent)' : 'var(--border)'}`,
            color: selectedChip === 'custom' ? 'var(--accent)' : 'var(--text-secondary)',
          }}
          onClick={() => onSelectChip('custom')}
          disabled={isBusy}
        >
          {t('Custom')}
        </button>
      </div>
      {selectedChip === 'custom' && (
        <div className="flex items-center gap-2 mb-3">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            className="form-input"
            style={{ textAlign: 'center', fontSize: '14px', fontWeight: 600, width: '90px', flexShrink: 0 }}
            placeholder="0"
            value={customDays}
            onChange={(e) => onCustomChange(e.target.value)}
            autoFocus
          />
          <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            {t('days')}
          </span>
        </div>
      )}
      <button
        className="w-full rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2"
        style={{
          minHeight: 44,
          padding: '12px 18px',
          fontSize: 14,
          background: disabled
            ? 'var(--bg-tertiary)'
            : 'linear-gradient(135deg, var(--accent) 0%, #00a0a0 100%)',
          color: disabled ? 'var(--text-muted)' : '#fff',
          opacity: disabled ? 0.5 : 1,
          border: disabled ? '1px solid var(--border)' : 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
        onClick={onGenerate}
        disabled={disabled}
      >
        {busyActive ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            {t('Working...')}
          </>
        ) : (
          t('Generate & Write to Device')
        )}
      </button>
    </div>
  );
};

export default AddDaysCard;
```

- [ ] **Step 3.2: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3.3: Commit**

```bash
git add "src/app/(mobile)/mydevices/devices/components/AddDaysCard.tsx"
git commit -m "feat(mydevices): AddDaysCard with quick-pick day chips"
```

---

### Task 4: ResultZone

**Files:**
- Create: `src/app/(mobile)/mydevices/devices/components/ResultZone.tsx`

Display helpers live here: `chunk3` groups digit runs in threes for display only (copy uses raw value); `relTime` renders a coarse relative timestamp.

- [ ] **Step 4.1: Create component**

```tsx
'use client';

import React from 'react';
import {
  Clipboard, Loader2, CheckCircle, AlertCircle, Download, Send,
} from 'lucide-react';
import { useI18n } from '@/i18n';
import type { CodeType, LastCode, ResultState } from './types';

const chunk3 = (code: string) => code.replace(/(\d{3})(?=\d)/g, '$1 ');

interface ResultZoneProps {
  result: ResultState;
  lastCode: LastCode | null;
  remainingDays: string | null;
  isRefreshing: boolean;
  onRetrieve: () => void;
  onRetryWrite: () => void;
  onTryAgain: () => void;
  onResend: () => void;
  onCopy: (code: string) => void;
}

const ResultZone: React.FC<ResultZoneProps> = ({
  result, lastCode, remainingDays, isRefreshing,
  onRetrieve, onRetryWrite, onTryAgain, onResend, onCopy,
}) => {
  const { t } = useI18n();

  const codeTypeLabel = (ct: CodeType | null) => {
    switch (ct) {
      case 'days': return t('Days Code');
      case 'free': return t('Free Code');
      case 'reset': return t('Reset Code');
      case 'retrieve': return t('Retrieved Code');
      default: return t('Code');
    }
  };

  const relTime = (at: number) => {
    const mins = Math.floor((Date.now() - at) / 60000);
    if (mins < 1) return t('just now');
    if (mins < 60) return t('{n}m ago', { n: mins });
    return t('{n}h ago', { n: Math.floor(mins / 60) });
  };

  // Generating
  if (result.status === 'generating') {
    return (
      <div
        className="rounded-xl p-4 mb-4 flex items-center gap-3"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
      >
        <Loader2 size={20} className="animate-spin flex-shrink-0" style={{ color: 'var(--accent)' }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {result.codeType === 'retrieve' ? t('Retrieving last code...') : t('Generating code...')}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{codeTypeLabel(result.codeType)}</p>
        </div>
      </div>
    );
  }

  // Generated / Writing / Written / WriteFailed — code is present
  if (
    (result.status === 'generated' || result.status === 'writing'
      || result.status === 'written' || result.status === 'writeFailed')
    && result.codeDec
  ) {
    const borderColor =
      result.status === 'written' ? 'var(--color-success)'
      : result.status === 'writeFailed' ? '#f59e0b'
      : 'var(--border)';

    return (
      <div
        className="rounded-xl p-4 mb-4 transition-all duration-300"
        style={{ background: 'var(--bg-secondary)', border: `1px solid ${borderColor}` }}
      >
        <div className="flex items-start justify-between mb-2">
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-md"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
          >
            {codeTypeLabel(result.codeType)}
            {result.status === 'written' && ` · ${t('just now')}`}
            {result.status === 'writeFailed' && ` · ${t('Not on device yet')}`}
          </span>
          <button
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onClick={() => onCopy(result.codeDec!)}
            aria-label={t('Copy code')}
          >
            <Clipboard size={16} />
          </button>
        </div>
        <p
          className="text-3xl font-bold font-mono tracking-wider mb-3 text-center"
          style={{ color: 'var(--accent)' }}
        >
          {chunk3(result.codeDec)}
        </p>
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2"
          style={{ background: 'var(--bg-tertiary)' }}
        >
          {(result.status === 'generated' || result.status === 'writing') && (
            <>
              <Loader2 size={14} className="animate-spin" style={{ color: 'var(--accent)' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                {t('Writing code to device...')}
              </span>
            </>
          )}
          {result.status === 'written' && (
            <>
              <CheckCircle size={14} className="flex-shrink-0" style={{ color: 'var(--color-success)' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--color-success)' }}>
                {isRefreshing || remainingDays == null
                  ? t('Written. Confirming days...')
                  : t('Written. Device now reads {days} days', { days: remainingDays })}
              </span>
            </>
          )}
          {result.status === 'writeFailed' && (
            <div className="flex items-center justify-between w-full gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle size={14} className="flex-shrink-0" style={{ color: '#f59e0b' }} />
                <span className="text-xs font-medium break-words" style={{ color: '#f59e0b' }}>
                  {result.error || t('Failed to write to device')}
                </span>
              </div>
              <button
                className="text-xs font-semibold px-2 py-1 rounded-md flex-shrink-0"
                style={{ color: 'var(--accent)', background: 'var(--bg-secondary)' }}
                onClick={onRetryWrite}
              >
                {t('Retry write')}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Generation / retrieval error
  if (result.status === 'error') {
    return (
      <div
        className="rounded-xl p-4 mb-4 flex items-start gap-3"
        style={{
          background: 'var(--color-error-soft, rgba(239,68,68,0.08))',
          border: '1px solid var(--color-error)',
        }}
      >
        <AlertCircle size={20} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--color-error)' }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold mb-0.5" style={{ color: 'var(--color-error)' }}>
            {result.codeType === 'retrieve' ? t('Failed to retrieve code') : t('Failed to generate code')}
          </p>
          <p className="text-xs break-words" style={{ color: 'var(--text-secondary)' }}>{result.error}</p>
        </div>
        <button
          className="text-xs font-semibold px-3 py-1.5 rounded-lg flex-shrink-0 transition-colors"
          style={{
            color: 'var(--color-error)',
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.2)',
          }}
          onClick={onTryAgain}
        >
          {t('Try Again')}
        </button>
      </div>
    );
  }

  // Idle with a known last code — resting row
  if (lastCode) {
    return (
      <div
        className="rounded-xl px-4 py-3 mb-4 flex items-center justify-between gap-2"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
      >
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
            {t('Last code')} · {codeTypeLabel(lastCode.codeType)} · {relTime(lastCode.at)}
          </p>
          <p className="text-sm font-mono mt-0.5 truncate" style={{ color: 'var(--text-primary)' }}>
            {chunk3(lastCode.codeDec)}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            className="text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"
            style={{ color: 'var(--accent)', background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
            onClick={onResend}
          >
            <Send size={12} />
            {t('Resend')}
          </button>
          <button
            className="p-1.5 rounded-lg"
            style={{ color: 'var(--text-secondary)' }}
            onClick={() => onCopy(lastCode.codeDec)}
            aria-label={t('Copy code')}
          >
            <Clipboard size={14} />
          </button>
        </div>
      </div>
    );
  }

  // Idle, nothing known — retrieve affordance
  return (
    <div
      className="rounded-xl px-4 py-3 mb-4 flex items-center justify-between gap-2"
      style={{ background: 'transparent', border: '1px dashed var(--border)' }}
    >
      <div>
        <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
          {t('Last code')}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{t('Not loaded')}</p>
      </div>
      <button
        className="text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 flex-shrink-0"
        style={{ color: 'var(--accent)', background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
        onClick={onRetrieve}
      >
        <Download size={12} />
        {t('Retrieve & rewrite')}
      </button>
    </div>
  );
};

export default ResultZone;
```

- [ ] **Step 4.2: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4.3: Commit**

```bash
git add "src/app/(mobile)/mydevices/devices/components/ResultZone.tsx"
git commit -m "feat(mydevices): ResultZone fixed-slot state display"
```

---

### Task 5: OtherCodes + AdvancedPanel

**Files:**
- Create: `src/app/(mobile)/mydevices/devices/components/OtherCodes.tsx`
- Create: `src/app/(mobile)/mydevices/devices/components/AdvancedPanel.tsx`

- [ ] **Step 5.1: Create `OtherCodes.tsx`**

```tsx
'use client';

import React from 'react';
import { Unlock, RotateCcw, Loader2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import type { CodeType } from './types';

interface OtherCodesProps {
  isBusy: boolean;
  busyType: CodeType | null;
  onRequest: (type: 'free' | 'reset') => void;
}

const OtherCodes: React.FC<OtherCodesProps> = ({ isBusy, busyType, onRequest }) => {
  const { t } = useI18n();

  const rows: Array<{
    type: 'free' | 'reset';
    icon: React.ReactNode;
    title: string;
    desc: string;
  }> = [
    {
      type: 'free',
      icon: <Unlock size={18} style={{ color: 'var(--accent)' }} />,
      title: t('Free Code'),
      desc: t('Unlocks the device permanently'),
    },
    {
      type: 'reset',
      icon: <RotateCcw size={18} style={{ color: 'var(--accent)' }} />,
      title: t('Reset Code'),
      desc: t('Restores the device to default state'),
    },
  ];

  return (
    <div className="mb-4">
      <h3
        className="text-xs font-semibold uppercase tracking-wide mb-2 px-1"
        style={{ color: 'var(--text-secondary)' }}
      >
        {t('Other codes')}
      </h3>
      {rows.map((row) => (
        <div
          key={row.type}
          className="rounded-xl p-3 mb-2 flex items-center gap-3"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
        >
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--accent-soft)' }}
          >
            {row.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{row.title}</p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{row.desc}</p>
          </div>
          <button
            className="text-xs font-semibold px-3 py-2 rounded-lg flex-shrink-0 flex items-center gap-1.5"
            style={{
              color: isBusy ? 'var(--text-muted)' : 'var(--accent)',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              cursor: isBusy ? 'not-allowed' : 'pointer',
              opacity: isBusy ? 0.5 : 1,
            }}
            onClick={() => onRequest(row.type)}
            disabled={isBusy}
          >
            {isBusy && busyType === row.type ? (
              <Loader2 size={12} className="animate-spin" />
            ) : null}
            {t('Generate')}
          </button>
        </div>
      ))}
    </div>
  );
};

export default OtherCodes;
```

- [ ] **Step 5.2: Create `AdvancedPanel.tsx`**

This wraps the existing CMD Service JSX (from `DeviceDetailView.tsx:1098-1191`) in a collapsed disclosure. Function unchanged.

```tsx
'use client';

import React from 'react';
import { ChevronDown, Clipboard, RefreshCw, Settings } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useI18n } from '@/i18n';

interface AdvancedPanelProps {
  open: boolean;
  onToggle: () => void;
  cmdService: any;
  pubkCharacteristic: any;
  pubkValue: string | null;
  isLoadingService: string | null;
  serviceLoadingProgress: number;
  isReading: boolean;
  onRead: () => void;
  onWrite: () => void;
  onRefreshService: () => void;
  translateDescription: (desc: string) => string;
}

const AdvancedPanel: React.FC<AdvancedPanelProps> = ({
  open, onToggle, cmdService, pubkCharacteristic, pubkValue,
  isLoadingService, serviceLoadingProgress, isReading,
  onRead, onWrite, onRefreshService, translateDescription,
}) => {
  const { t } = useI18n();

  return (
    <div className="mb-6">
      <button
        className="w-full rounded-xl px-4 py-3 flex items-center justify-between transition-colors"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          <Settings size={16} />
          {t('Advanced — raw device access')}
        </span>
        <ChevronDown
          size={16}
          className="transition-transform duration-200"
          style={{ color: 'var(--text-secondary)', transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </button>

      {open && (
        <div className="mt-3">
          {isLoadingService === 'CMD' && (
            <div className="w-full h-1 mb-3 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
              <div
                className="h-full transition-all duration-300 ease-in-out"
                style={{ width: `${serviceLoadingProgress}%`, background: 'var(--accent)' }}
              />
            </div>
          )}
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{t('CMD Service')}</h3>
            <button
              onClick={onRefreshService}
              disabled={!!isLoadingService}
              className={`flex items-center justify-center w-7 h-7 rounded-lg transition-all ${isLoadingService ? 'animate-spin' : ''}`}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                cursor: isLoadingService ? 'not-allowed' : 'pointer',
                opacity: isLoadingService ? 0.5 : 1,
              }}
              aria-label={t('Refresh CMD service')}
            >
              <RefreshCw size={14} />
            </button>
          </div>
          {cmdService && pubkCharacteristic ? (
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}
            >
              <div className="flex justify-between items-center px-4 py-2" style={{ background: 'var(--bg-tertiary)' }}>
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {pubkCharacteristic.name}
                </span>
                <div className="flex space-x-2">
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '8px 14px', fontSize: 13, minHeight: 36, flex: '0 0 auto' }}
                    onClick={onRead}
                    disabled={isReading}
                  >
                    {isReading ? t('Reading...') : t('Read')}
                  </button>
                  <button
                    className="btn btn-primary"
                    style={{ padding: '8px 14px', fontSize: 13, minHeight: 36, flex: '0 0 auto' }}
                    onClick={onWrite}
                  >
                    {t('Write')}
                  </button>
                </div>
              </div>
              <div className="p-3 space-y-2">
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('Description')}</p>
                  <p className="text-xs" style={{ color: 'var(--text-primary)' }}>
                    {translateDescription(pubkCharacteristic.desc)}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex-grow min-w-0">
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('Current Value')}</p>
                    <p className="text-sm font-mono truncate" style={{ color: 'var(--text-primary)' }}>
                      {pubkValue || 'N/A'}
                    </p>
                  </div>
                  <button
                    className="p-1.5 transition-colors flex-shrink-0"
                    style={{ color: 'var(--text-secondary)' }}
                    onClick={() => {
                      navigator.clipboard.writeText(String(pubkValue || 'N/A'));
                      toast.success(t('Value copied to clipboard'));
                    }}
                    aria-label={t('Copy to clipboard')}
                  >
                    <Clipboard size={14} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 text-center" style={{ color: 'var(--text-secondary)' }}>
              {isLoadingService === 'CMD' ? (
                <p className="text-sm">{t('Loading CMD service data...')}</p>
              ) : (
                <p className="text-sm">{t('No data available for CMD service')}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdvancedPanel;
```

- [ ] **Step 5.3: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5.4: Commit**

```bash
git add "src/app/(mobile)/mydevices/devices/components/OtherCodes.tsx" "src/app/(mobile)/mydevices/devices/components/AdvancedPanel.tsx"
git commit -m "feat(mydevices): OtherCodes rows and AdvancedPanel disclosure"
```

---

### Task 6: Rewire DeviceDetailView

**Files:**
- Modify: `src/app/(mobile)/mydevices/devices/DeviceDetailView.tsx`

All logic stays. Changes are: imports, type source, new state, three small handlers, one effect, and a full render swap.

- [ ] **Step 6.1: Replace local types with shared import; update imports**

Delete lines 16-26 (`type CodeType ...` through `const INITIAL_RESULT ...`) and add:

```ts
import StatusCard from './components/StatusCard';
import AddDaysCard from './components/AddDaysCard';
import ResultZone from './components/ResultZone';
import OtherCodes from './components/OtherCodes';
import AdvancedPanel from './components/AdvancedPanel';
import type { CodeType, ResultState, LastCode } from './components/types';

const INITIAL_RESULT: ResultState = { status: 'idle', codeType: null, codeDec: null, error: null };
```

Update the modals import to include the new modal: `import { AsciiStringModal, ConfirmModal } from '../../../modals';`

Trim the lucide import to only what the slimmed file still uses (the components own the rest):

```ts
import { AlertCircle, Loader2 } from 'lucide-react';
```

- [ ] **Step 6.2: Add new state and handlers**

Next to the existing `const [daysInput, setDaysInput] = useState('');` (line ~390) — rename it and add the new state:

```ts
const [customDays, setCustomDays] = useState('');
const [selectedChip, setSelectedChip] = useState<number | 'custom' | null>(null);
const [lastCode, setLastCode] = useState<LastCode | null>(null);
const [advancedOpen, setAdvancedOpen] = useState(false);
const [confirmFor, setConfirmFor] = useState<'free' | 'reset' | null>(null);
```

Replace `handleDaysInputChange` with:

```ts
const handleSelectChip = (chip: number | 'custom') => {
  setSelectedChip(chip);
  if (chip === 'custom') {
    const parsed = parseInt(customDays, 10);
    setDuration(parsed > 0 ? parsed : null);
  } else {
    setDuration(chip);
  }
};

const handleCustomChange = (raw: string) => {
  const val = raw.replace(/\D/g, '');
  setCustomDays(val);
  const parsed = parseInt(val, 10);
  setDuration(parsed > 0 ? parsed : null);
};
```

Add below `handleRetryWrite`:

```ts
const handleConfirmOtherCode = () => {
  if (confirmFor === 'free') handleGenerateFreeCode();
  else if (confirmFor === 'reset') handleGenerateResetCode();
};

const handleTryAgain = () => {
  if (result.codeType === 'days') handleGenerateDaysCode();
  else if (result.codeType === 'free') handleGenerateFreeCode();
  else if (result.codeType === 'reset') handleGenerateResetCode();
  else if (result.codeType === 'retrieve') handleRetrieveCodes();
};

// Re-write the last known code through the normal generated→write pathway
const handleResend = () => {
  if (!lastCode || isBusy) return;
  setResult({ status: 'generated', codeType: lastCode.codeType, codeDec: lastCode.codeDec, error: null });
};

const handleCopyCode = (code: string) => {
  navigator.clipboard.writeText(code);
  toast.success(t('Code copied to clipboard'));
};
```

- [ ] **Step 6.3: Add written → resting-row effect**

After the existing generated→write `useEffect` (line ~432):

```ts
// After a confirmed write, remember the code and let the result card settle
// into the compact "last code" row after a short dwell.
useEffect(() => {
  if (result.status === 'written' && result.codeDec && result.codeType) {
    setLastCode({ codeDec: result.codeDec, codeType: result.codeType, at: Date.now() });
    const id = setTimeout(() => setResult(INITIAL_RESULT), 10_000);
    return () => clearTimeout(id);
  }
}, [result.status, result.codeDec, result.codeType]);
```

- [ ] **Step 6.4: Delete now-unused local helpers**

Remove `codeTypeLabel` and `codeTypeColor` (lines ~632-648) — `ResultZone` owns labeling now and color identity is gone by design. Keep `translateDescription`, `remainingDays`, `pubkValue`.

- [ ] **Step 6.5: Replace everything inside `<div className="p-4 max-w-md mx-auto">`**

The hero block (lines 668-673) and the outer wrapper stay byte-identical. The `AsciiStringModal` stays; add `ConfirmModal` next to it:

```tsx
<ConfirmModal
  isOpen={confirmFor !== null}
  onClose={() => setConfirmFor(null)}
  onConfirm={handleConfirmOtherCode}
  title={confirmFor === 'free' ? t('Generate Free Code?') : t('Generate Reset Code?')}
  message={confirmFor === 'free'
    ? t('A Free Code unlocks the device permanently, removing all payment restrictions. Continue?')
    : t('A Reset Code restores the device to its default locked state. Continue?')}
  confirmLabel={t('Generate')}
/>
```

The container content becomes (identification banner JSX is the existing block, unchanged apart from position):

```tsx
<div className="p-4 max-w-md mx-auto">
  <StatusCard
    hasRcrd={!!rcrdCharacteristic}
    remainingDays={remainingDays != null ? String(remainingDays) : null}
    isRefreshing={isRefreshing}
  />

  {/* Device Identification Status — existing block, verbatim */}
  {!itemId && (
    /* ... keep the current banner JSX from lines 727-759 exactly ... */
  )}

  <AddDaysCard
    selectedChip={selectedChip}
    customDays={customDays}
    duration={duration}
    isBusy={isBusy}
    busyActive={isBusy && result.codeType === 'days'}
    onSelectChip={handleSelectChip}
    onCustomChange={handleCustomChange}
    onGenerate={handleGenerateDaysCode}
  />

  <ResultZone
    result={result}
    lastCode={lastCode}
    remainingDays={remainingDays != null ? String(remainingDays) : null}
    isRefreshing={isRefreshing}
    onRetrieve={handleRetrieveCodes}
    onRetryWrite={handleRetryWrite}
    onTryAgain={handleTryAgain}
    onResend={handleResend}
    onCopy={handleCopyCode}
  />

  <OtherCodes
    isBusy={isBusy}
    busyType={isBusy ? result.codeType : null}
    onRequest={setConfirmFor}
  />

  <AdvancedPanel
    open={advancedOpen}
    onToggle={() => setAdvancedOpen((v) => !v)}
    cmdService={cmdService}
    pubkCharacteristic={pubkCharacteristic}
    pubkValue={pubkValue != null ? String(pubkValue) : null}
    isLoadingService={isLoadingService ?? null}
    serviceLoadingProgress={serviceLoadingProgress}
    isReading={isLoading}
    onRead={handleRead}
    onWrite={handleWriteClick}
    onRefreshService={handleRefreshService}
    translateDescription={translateDescription}
  />
</div>
```

Delete the replaced blocks: stat row (676-724), code-operation cards (761-901), result card (903-1053), retrieve button (1055-1096), CMD service section (1098-1191).

- [ ] **Step 6.6: Verify compile and lint**

Run: `npx tsc --noEmit`
Expected: exit 0. Common trip-ups: unused imports left behind (`Clipboard`, `Calendar`, `Clock`, `Unlock`, `RotateCcw`, `CheckCircle`, `Download`, `RefreshCw` must be gone from DeviceDetailView), `daysInput` references not renamed.

Run: `npx next lint`
Expected: no new errors (pre-existing warnings acceptable).

- [ ] **Step 6.7: Commit**

```bash
git add "src/app/(mobile)/mydevices/devices/DeviceDetailView.tsx"
git commit -m "feat(mydevices): redesign device details page around primary Add Days flow"
```

---

### Task 7: i18n strings

**Files:**
- Modify: `src/i18n/messages/en.json`

- [ ] **Step 7.1: Add new keys**

Add these key/value pairs (keys = values; en.json is source of truth, fr/zh fall back to English):

```json
"Add days": "Add days",
"Custom": "Custom",
"Generate & Write to Device": "Generate & Write to Device",
"Working...": "Working...",
"Other codes": "Other codes",
"Unlocks the device permanently": "Unlocks the device permanently",
"Restores the device to default state": "Restores the device to default state",
"Advanced — raw device access": "Advanced — raw device access",
"Last code": "Last code",
"Not loaded": "Not loaded",
"Retrieve & rewrite": "Retrieve & rewrite",
"Resend": "Resend",
"Not on device yet": "Not on device yet",
"Retry write": "Retry write",
"Written. Confirming days...": "Written. Confirming days...",
"Written. Device now reads {days} days": "Written. Device now reads {days} days",
"just now": "just now",
"{n}m ago": "{n}m ago",
"{n}h ago": "{n}h ago",
"Generate Free Code?": "Generate Free Code?",
"Generate Reset Code?": "Generate Reset Code?",
"A Free Code unlocks the device permanently, removing all payment restrictions. Continue?": "A Free Code unlocks the device permanently, removing all payment restrictions. Continue?",
"A Reset Code restores the device to its default locked state. Continue?": "A Reset Code restores the device to its default locked state. Continue?",
"Confirm": "Confirm",
"Copy code": "Copy code",
"Refresh CMD service": "Refresh CMD service",
"Copy to clipboard": "Copy to clipboard"
```

Skip any key that already exists in the file (check each; e.g. "Confirm" may exist).

- [ ] **Step 7.2: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0. Also confirm en.json is valid JSON: `node -e "JSON.parse(require('fs').readFileSync('src/i18n/messages/en.json','utf8')); console.log('ok')"`
Expected: `ok`

- [ ] **Step 7.3: Commit**

```bash
git add src/i18n/messages/en.json
git commit -m "feat(i18n): strings for device details redesign"
```

---

### Task 8: Final verification

- [ ] **Step 8.1: Type check** — `npx tsc --noEmit` → exit 0
- [ ] **Step 8.2: Lint** — `npx next lint` → no new errors
- [ ] **Step 8.3: Production build** — `npx next build` → succeeds
- [ ] **Step 8.4: Fix anything found, re-run, commit fixes**

```bash
git add <only-files-you-fixed>
git commit -m "fix(mydevices): build/lint fixes for details redesign"
```

On-device BLE verification (connect, generate days code, watch result zone progress to "Written. Device now reads N days", Free/Reset confirms, Advanced read/write) is Dennis's final step.

---

## Self-Review Notes

- **Spec coverage:** status card (T2), identification banner kept (T6.5), Add Days card + chips (T3), all seven result-zone states incl. retrieve relabel + resend + chunked display (T4), confirm dialogs (T1, T6), Advanced disclosure with full CMD panel (T5), component split (T1-T5), i18n (T7), verification (T8). Written→resting-row dwell implemented in T6.3.
- **Type consistency:** `CodeType`/`ResultState`/`LastCode` defined once in T1 and imported everywhere; `busyType` is `CodeType | null` matching `result.codeType`; `remainingDays`/`pubkValue` are stringified at the call site because the underlying BLE values are `any`.
- **Behavior preserved:** generate→auto-write effect untouched; retrieve still writes (T4 labels it honestly); retry/try-again reuse existing handlers; verify-loop spinner surfaces in StatusCard and the written status line.
