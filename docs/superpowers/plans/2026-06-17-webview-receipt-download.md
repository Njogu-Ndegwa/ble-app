# WebView Receipt/File Download — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users download receipts/invoices at the end of every applet flow, saving the file to the phone's public Downloads with a tap-to-open notification, when the applet runs inside the `oves-app` Android WebView (with a graceful browser fallback).

**Architecture:** One shared web entry point (`saveFile`) converts a generated PDF `Blob` to base64 and calls the existing `window.WebViewJavascriptBridge.callHandler('saveFile', …)`. A shared `generateReceiptPdf` renders the existing `{title, receiptId, rows[]}` model to a PDF. On Android (`oves-app`), the `saveFile` bridge handler is repaired to write to public Downloads (MediaStore) and post a tap-to-open notification; a JS shim + `DownloadManager` cover any other anchor/http download generically.

**Tech Stack:** Next.js + React + TypeScript + vitest (web); `jspdf` (already a dep); Java + Android SDK + `com.github.lzyzsd.jsbridge` + Gradle (oves-app).

## Global Constraints
- Target Android app is **`oves-app`** (`com.oves.app`, branch `main`). **Do not touch `HTML5_WebView_APP`.**
- minSdk **26**, targetSdk **34**, compileSdk **34**.
- Web bridge call API: `window.WebViewJavascriptBridge.callHandler(name, dataJsonString, cb)`, available after the `WebViewJavascriptBridgeReady` event (see `src/app/context/bridgeContext.tsx`). Do not re-implement bridge plumbing.
- All ble-app React components touching the bridge/flows MUST stay `"use client"` (server components hid on-device features before — see memory `verify-ble-changes-on-device-before-push`).
- jspdf is imported lazily: `const { jsPDF } = await import('jspdf');`.
- Android Gradle needs **JDK 17** at `dev-tools/jdk17` (per memory `webview-cold-start-white-screen`).
- Never push bridge changes to dev without on-device verification on Dennis's phone.
- Receipt row model (existing, in `src/components/shared/SuccessReceipt.tsx`): `interface ReceiptRow { label: string; value: string; mono?: boolean; color?: string; copyable?: boolean; }`.

---

## Phase 0 — Worktrees & Test Environment

### Task 0: Worktrees + jsdom test env

**Files:**
- Create (web worktree): isolated `ble-app` worktree on branch `feat/webview-receipt-download` off `dev`.
- Create (android worktree): isolated `oves-app` worktree on branch `feat/webview-download` off `main`. (The pre-existing `.claude/worktrees/fix-download` branch `fix/download-functionality` holds the prior `saveFile` handler — use it as **reference only**; we re-author cleanly off `main`.)
- Modify: `ble-app/package.json` (add `jsdom` devDependency)

**Interfaces:**
- Produces: two worktrees ready for edits; vitest able to run DOM-dependent tests via the per-file `// @vitest-environment jsdom` directive.

- [ ] **Step 1: Create the ble-app worktree** (via superpowers:using-git-worktrees; fallback below)

```bash
cd /c/Users/pc/ble-app
git worktree add -b feat/webview-receipt-download ../ble-app-download dev
```

- [ ] **Step 2: Create the oves-app worktree**

```bash
cd /c/Users/pc/oves-app
git fetch origin
git worktree add -b feat/webview-download ../oves-app-download origin/main
```

- [ ] **Step 3: Add jsdom to ble-app worktree**

Run in the ble-app worktree:
```bash
npm install -D jsdom
```
Expected: `jsdom` appears under devDependencies; `npm ls jsdom` resolves.

- [ ] **Step 4: Verify vitest runs**

Run: `npx vitest run --reporter=dot`
Expected: exits 0 (no tests yet = "no test files found" is acceptable; if it errors, fix config before continuing).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add jsdom devDependency for DOM unit tests"
```

---

## Phase 1 — Web shared infrastructure (ble-app worktree)

### Task 1: `saveFile` util

**Files:**
- Create: `src/lib/download/saveFile.ts`
- Test: `src/lib/download/saveFile.test.ts`

**Interfaces:**
- Produces:
  - `isOvesWebView(): boolean`
  - `blobToBase64(blob: Blob): Promise<string>` (returns base64 WITHOUT the `data:…;base64,` prefix)
  - `saveFile(blob: Blob, filename: string, mimeType?: string): Promise<void>`

- [ ] **Step 1: Write the failing test**

`src/lib/download/saveFile.test.ts`:
```ts
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { isOvesWebView, blobToBase64, saveFile } from './saveFile';

afterEach(() => {
  delete (window as any).WebViewJavascriptBridge;
  vi.restoreAllMocks();
});

describe('isOvesWebView', () => {
  it('is false when no bridge present', () => {
    expect(isOvesWebView()).toBe(false);
  });
  it('is true when bridge present', () => {
    (window as any).WebViewJavascriptBridge = { callHandler: vi.fn() };
    expect(isOvesWebView()).toBe(true);
  });
});

describe('blobToBase64', () => {
  it('returns base64 without the data-uri prefix', async () => {
    const b64 = await blobToBase64(new Blob(['hi'], { type: 'text/plain' }));
    expect(b64).toBe('aGk='); // base64 of "hi"
  });
});

describe('saveFile', () => {
  it('routes to the bridge saveFile handler in the WebView', async () => {
    const callHandler = vi.fn((_name: string, _data: string, cb: (r: string) => void) => cb('{}'));
    (window as any).WebViewJavascriptBridge = { callHandler };
    await saveFile(new Blob(['hi'], { type: 'application/pdf' }), 'r.pdf', 'application/pdf');
    expect(callHandler).toHaveBeenCalledTimes(1);
    const [name, dataStr] = callHandler.mock.calls[0];
    expect(name).toBe('saveFile');
    const payload = JSON.parse(dataStr as string);
    expect(payload).toMatchObject({ base64: 'aGk=', fileName: 'r.pdf', mimeType: 'application/pdf' });
  });

  it('falls back to an anchor download in a plain browser', async () => {
    const click = vi.fn();
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: any) => {
      const el = realCreate(tag);
      if (tag === 'a') (el as any).click = click;
      return el as any;
    });
    (URL as any).createObjectURL = vi.fn(() => 'blob:x');
    (URL as any).revokeObjectURL = vi.fn();
    await saveFile(new Blob(['hi'], { type: 'application/pdf' }), 'r.pdf', 'application/pdf');
    expect(click).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/download/saveFile.test.ts`
Expected: FAIL — cannot find module `./saveFile`.

- [ ] **Step 3: Write minimal implementation**

`src/lib/download/saveFile.ts`:
```ts
/**
 * Single WebView-aware file save entry point.
 * In the oves-app WebView, routes a Blob to the native `saveFile` bridge handler
 * (which writes to public Downloads + notifies). In a normal browser, falls back
 * to Web Share / anchor download.
 */

export function isOvesWebView(): boolean {
  return typeof window !== 'undefined' && !!(window as any).WebViewJavascriptBridge;
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result ?? '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

export async function saveFile(
  blob: Blob,
  filename: string,
  mimeType = 'application/octet-stream',
): Promise<void> {
  if (isOvesWebView()) {
    const base64 = await blobToBase64(blob);
    await new Promise<void>((resolve) => {
      (window as any).WebViewJavascriptBridge.callHandler(
        'saveFile',
        JSON.stringify({ base64, fileName: filename, mimeType }),
        () => resolve(),
      );
    });
    return;
  }

  // Browser fallback
  const file = new File([blob], filename, { type: mimeType });
  const nav = navigator as any;
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: filename });
      return;
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 250);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/download/saveFile.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/download/saveFile.ts src/lib/download/saveFile.test.ts
git commit -m "feat(download): add WebView-aware saveFile util"
```

---

### Task 2: Receipt → PDF generator

**Files:**
- Create: `src/lib/receipt/generate-receipt-pdf.ts`
- Test: `src/lib/receipt/generate-receipt-pdf.test.ts`

**Interfaces:**
- Consumes: `ReceiptRow` from `@/components/shared/SuccessReceipt`.
- Produces:
  - `buildReceiptFilename(input: { receiptId?: string; title: string }, date?: Date): string`
  - `interface ReceiptPdfInput { title: string; receiptId?: string; receiptTitle?: string; rows: ReceiptRow[]; }`
  - `generateReceiptPdf(input: ReceiptPdfInput): Promise<Blob>`

- [ ] **Step 1: Write the failing test**

`src/lib/receipt/generate-receipt-pdf.test.ts`:
```ts
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { buildReceiptFilename, generateReceiptPdf } from './generate-receipt-pdf';

describe('buildReceiptFilename', () => {
  it('uses the receiptId and a timestamp', () => {
    const d = new Date('2026-06-17T09:05:00');
    expect(buildReceiptFilename({ receiptId: 'TXN-12345', title: 'Swap Complete' }, d))
      .toBe('TXN-12345-20260617-0905.pdf');
  });
  it('falls back to a slug of the title when no receiptId', () => {
    const d = new Date('2026-06-17T09:05:00');
    expect(buildReceiptFilename({ title: 'Swap Complete' }, d))
      .toBe('swap-complete-20260617-0905.pdf');
  });
});

describe('generateReceiptPdf', () => {
  it('produces a non-empty application/pdf blob', async () => {
    const blob = await generateReceiptPdf({
      title: 'Swap Complete',
      receiptId: 'TXN-1',
      rows: [
        { label: 'Subscription ID', value: 'SUB-1', mono: true },
        { label: 'Amount Paid', value: 'CFA 500', mono: true },
      ],
    });
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/receipt/generate-receipt-pdf.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementation**

`src/lib/receipt/generate-receipt-pdf.ts`:
```ts
import type { ReceiptRow } from '@/components/shared/SuccessReceipt';

export interface ReceiptPdfInput {
  title: string;
  receiptId?: string;
  receiptTitle?: string;
  rows: ReceiptRow[];
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function buildReceiptFilename(
  input: { receiptId?: string; title: string },
  date: Date = new Date(),
): string {
  const stamp =
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}`;
  const base = input.receiptId
    ? input.receiptId
    : input.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${base}-${stamp}.pdf`;
}

export async function generateReceiptPdf(input: ReceiptPdfInput): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const margin = 15;
  let y = margin + 4;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(30, 30, 30);
  pdf.text(input.title, margin, y);

  if (input.receiptId) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(120, 120, 120);
    pdf.text(`#${input.receiptId}`, pageWidth - margin, y, { align: 'right' });
  }

  y += 6;
  pdf.setDrawColor(220, 220, 220);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 8;

  if (input.receiptTitle) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(60, 60, 60);
    pdf.text(input.receiptTitle, margin, y);
    y += 7;
  }

  pdf.setFontSize(11);
  for (const row of input.rows) {
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(110, 110, 110);
    pdf.text(row.label, margin, y);

    pdf.setFont(row.mono ? 'courier' : 'helvetica', 'bold');
    pdf.setTextColor(30, 30, 30);
    pdf.text(String(row.value), pageWidth - margin, y, { align: 'right' });
    y += 7;
    if (y > 280) {
      pdf.addPage();
      y = margin + 4;
    }
  }

  y += 4;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(150, 150, 150);
  pdf.text(`Generated ${new Date().toLocaleString()}`, margin, y);

  return pdf.output('blob');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/receipt/generate-receipt-pdf.test.ts`
Expected: PASS (3 tests). If jspdf throws in jsdom, capture the error and report before proceeding (do not stub away the failure).

- [ ] **Step 5: Commit**

```bash
git add src/lib/receipt/generate-receipt-pdf.ts src/lib/receipt/generate-receipt-pdf.test.ts
git commit -m "feat(receipt): add generateReceiptPdf from receipt rows"
```

---

## Phase 2 — Web wiring (ble-app worktree)

### Task 3: Download button on `SuccessReceipt` (covers Attendant + Sales)

**Files:**
- Modify: `src/components/shared/SuccessReceipt.tsx`

**Interfaces:**
- Consumes: `saveFile` (Task 1), `generateReceiptPdf` + `buildReceiptFilename` (Task 2).
- Produces: `SuccessReceipt` renders a Download button by default; new optional prop `downloadable?: boolean` (default `true`).

- [ ] **Step 1: Add imports + state + handler**

In `src/components/shared/SuccessReceipt.tsx`, add to the imports near the top (after the existing `toast` import):
```tsx
import { saveFile } from '@/lib/download/saveFile';
import { generateReceiptPdf, buildReceiptFilename } from '@/lib/receipt/generate-receipt-pdf';
```

Add `downloadable` to the props interface:
```tsx
  /** Whether to show the Download button (default true) */
  downloadable?: boolean;
```

Destructure it in the component signature (default true):
```tsx
  downloadable = true,
```

Inside the component body, after the `const [copiedIndex, ...]` line, add:
```tsx
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const blob = await generateReceiptPdf({ title, receiptId, receiptTitle, rows });
      const filename = buildReceiptFilename({ receiptId, title });
      await saveFile(blob, filename, 'application/pdf');
      toast.success(t('common.downloaded') || 'Receipt downloaded');
    } catch (err) {
      console.error('Receipt download failed:', err);
      toast.error(t('common.downloadFailed') || 'Download failed');
    } finally {
      setDownloading(false);
    }
  };
```

- [ ] **Step 2: Render the button**

Immediately after the closing `</div>` of the `receipt-card` block (the `<div className="receipt-card" …>…</div>`), add:
```tsx
      {downloadable && (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleDownload}
          disabled={downloading}
          style={{ width: '100%', marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {downloading ? (t('common.downloading') || 'Downloading…') : (t('common.downloadReceipt') || 'Download receipt')}
        </button>
      )}
```

- [ ] **Step 3: Type-check + lint**

Run: `npx tsc --noEmit` and `npm run lint` (or the project's lint script)
Expected: no new errors in `SuccessReceipt.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/SuccessReceipt.tsx
git commit -m "feat(receipt): add Download button to SuccessReceipt (Attendant+Sales)"
```

---

### Task 4: Download button on Top-up `StepDone`

**Files:**
- Modify: `src/app/(mobile)/topup/components/StepDone.tsx`

**Interfaces:**
- Consumes: `saveFile`, `generateReceiptPdf`, `buildReceiptFilename`; `ReceiptRow` type; the existing `TopupReceipt` (fields: `customerName?`, `vehicleId?`, `subscriptionCode`, `planName?`, `kwhCredited`, `price`, `currency?`, `quotaBefore`, `quotaAfter`, `wasRetry`).

- [ ] **Step 1: Add imports + handler**

Add imports under the existing ones:
```tsx
import { useState } from 'react';
import toast from 'react-hot-toast';
import type { ReceiptRow } from '@/components/shared/SuccessReceipt';
import { saveFile } from '@/lib/download/saveFile';
import { generateReceiptPdf, buildReceiptFilename } from '@/lib/receipt/generate-receipt-pdf';
```
(If `React` is already imported as default, keep it; add the `useState` named import only if not already present.)

Inside the component, after `const { t } = useI18n();`, add:
```tsx
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const rows: ReceiptRow[] = [];
      if (receipt.customerName) rows.push({ label: t('topup.customer') || 'Customer', value: receipt.customerName });
      if (receipt.vehicleId) rows.push({ label: t('topup.bike') || 'Bike', value: receipt.vehicleId, mono: true });
      rows.push({ label: t('topup.subscriptionId') || 'Subscription ID', value: receipt.subscriptionCode, mono: true });
      if (receipt.planName) rows.push({ label: t('topup.plan') || 'Plan', value: receipt.planName });
      rows.push({ label: t('topup.energyCredit') || 'Energy credit', value: `+${receipt.kwhCredited.toLocaleString()} kWh`, mono: true });
      if (receipt.price > 0) rows.push({ label: t('topup.planValue') || 'Plan value', value: `${receipt.currency ? `${receipt.currency} ` : ''}${receipt.price.toLocaleString()}`, mono: true });
      rows.push({ label: t('topup.balanceChange') || 'Balance after top-up', value: balanceValue, mono: true });

      const blob = await generateReceiptPdf({
        title: t('topup.topUpComplete') || 'Top-up Complete',
        receiptId: receipt.subscriptionCode,
        receiptTitle: t('topup.receipt') || 'Top-up Receipt',
        rows,
      });
      await saveFile(blob, buildReceiptFilename({ receiptId: receipt.subscriptionCode, title: 'topup' }), 'application/pdf');
      toast.success(t('common.downloaded') || 'Receipt downloaded');
    } catch (err) {
      console.error('Top-up receipt download failed:', err);
      toast.error(t('common.downloadFailed') || 'Download failed');
    } finally {
      setDownloading(false);
    }
  };
```

- [ ] **Step 2: Add the button**

Just before the existing `Top up another` button, add:
```tsx
      <button type="button" className="btn btn-secondary" onClick={handleDownload} disabled={downloading} style={{ width: '100%' }}>
        {downloading ? (t('common.downloading') || 'Downloading…') : (t('common.downloadReceipt') || 'Download receipt')}
      </button>
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(mobile)/topup/components/StepDone.tsx"
git commit -m "feat(topup): add Download receipt button to StepDone"
```

---

### Task 5: Download button on Rider success surface

**Files:**
- Modify: `src/app/(mobile)/rider/app/RiderApp.tsx`

**Interfaces:**
- Consumes: `saveFile`, `generateReceiptPdf`, `buildReceiptFilename`, `ReceiptRow`.

- [ ] **Step 1: Locate the success/receipt render**

Run: `npx vitest --version` is irrelevant; instead search:
```bash
grep -nE "success-screen|SuccessReceipt|receipt|complete|Complete|<h2|Done" "src/app/(mobile)/rider/app/RiderApp.tsx" | head -40
```
Identify the JSX block that renders the post-transaction success/receipt and the variables holding the transaction data (amount, subscription/vehicle, energy, reference, timestamp).

- [ ] **Step 2: Add imports + handler**

Add (near the other imports, keeping `"use client"` at top):
```tsx
import type { ReceiptRow } from '@/components/shared/SuccessReceipt';
import { saveFile } from '@/lib/download/saveFile';
import { generateReceiptPdf, buildReceiptFilename } from '@/lib/receipt/generate-receipt-pdf';
```
Add a `downloadingReceipt` state with the component's other `useState` hooks:
```tsx
  const [downloadingReceipt, setDownloadingReceipt] = useState(false);
```
Add a handler near the other handlers — map the identified transaction variables into rows (replace the example fields with the real variables found in Step 1):
```tsx
  const handleDownloadRiderReceipt = async (tx: {
    reference?: string; subscription?: string; vehicle?: string;
    energy?: string; amount?: string; time?: string;
  }) => {
    setDownloadingReceipt(true);
    try {
      const rows: ReceiptRow[] = [];
      if (tx.subscription) rows.push({ label: 'Subscription', value: tx.subscription, mono: true });
      if (tx.vehicle) rows.push({ label: 'Vehicle', value: tx.vehicle, mono: true });
      if (tx.energy) rows.push({ label: 'Energy', value: tx.energy, mono: true });
      if (tx.amount) rows.push({ label: 'Amount', value: tx.amount, mono: true });
      if (tx.time) rows.push({ label: 'Time', value: tx.time, mono: true });
      const blob = await generateReceiptPdf({
        title: 'Transaction Complete',
        receiptId: tx.reference,
        receiptTitle: 'Rider Receipt',
        rows,
      });
      await saveFile(blob, buildReceiptFilename({ receiptId: tx.reference, title: 'rider' }), 'application/pdf');
    } catch (err) {
      console.error('Rider receipt download failed:', err);
    } finally {
      setDownloadingReceipt(false);
    }
  };
```

- [ ] **Step 3: Render the button** in the success block identified in Step 1, passing the real transaction object:
```tsx
      <button type="button" className="btn btn-secondary" disabled={downloadingReceipt}
        onClick={() => handleDownloadRiderReceipt(/* real tx vars here */)} style={{ width: '100%' }}>
        {downloadingReceipt ? 'Downloading…' : 'Download receipt'}
      </button>
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors. Adjust the `tx` field mapping until it compiles against the real variables.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(mobile)/rider/app/RiderApp.tsx"
git commit -m "feat(rider): add Download receipt button to success surface"
```

---

### Task 6: Route Orders invoice/proforma through `saveFile`

**Files:**
- Modify: `src/lib/portal/generate-invoice-pdf.ts:292-335`

**Interfaces:**
- Consumes: `saveFile` (Task 1).

- [ ] **Step 1: Replace the tail of `generateInvoicePdf`**

Replace the block from `const filename = \`${ref}.pdf\`;` through the end of the function (the share / new-tab / anchor logic, current lines ~292-335) with:
```ts
  const filename = `${ref}.pdf`;
  const blob = pdf.output('blob');
  const { saveFile } = await import('@/lib/download/saveFile');
  await saveFile(blob, filename, 'application/pdf');
}
```
(Leave everything above `const filename` unchanged.)

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors; no remaining references to the removed `newTab`/`dataUrl`/`a`/`url` locals.

- [ ] **Step 3: Commit**

```bash
git add src/lib/portal/generate-invoice-pdf.ts
git commit -m "refactor(orders): route invoice/proforma download through saveFile"
```

---

### Task 7: Add i18n strings for the download UI

**Files:**
- Modify: `src/i18n/messages/en.json`, `src/i18n/messages/fr.json`, `src/i18n/messages/zh.json`

**Interfaces:** none (UI strings; code already falls back to English literals if missing).

- [ ] **Step 1: Add keys under `common`** in each file (translate values for fr/zh):
```json
"downloadReceipt": "Download receipt",
"downloading": "Downloading…",
"downloaded": "Receipt downloaded",
"downloadFailed": "Download failed"
```
fr: "Télécharger le reçu", "Téléchargement…", "Reçu téléchargé", "Échec du téléchargement".
zh: "下载收据", "下载中…", "收据已下载", "下载失败".

- [ ] **Step 2: Validate JSON**

Run: `node -e "['en','fr','zh'].forEach(l=>require('./src/i18n/messages/'+l+'.json'))"`
Expected: no parse error.

- [ ] **Step 3: Commit**

```bash
git add src/i18n/messages/en.json src/i18n/messages/fr.json src/i18n/messages/zh.json
git commit -m "i18n: add receipt download strings"
```

---

### Task 8: Full web build gate

- [ ] **Step 1: Run the test suite**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 3: Commit (if any lockfile/config changed); otherwise skip.**

---

## Phase 3 — Android (oves-app worktree, `com.oves.app`)

> Reference for the existing (broken) handler: `C:\Users\pc\oves-app\.claude\worktrees\fix-download\app\src\main\java\com\oves\app\activity\BaseWebViewActivity.java` (the `saveFile` handler shape) and `util\DownloadUtil.java`. We re-author cleanly.

### Task 9: `DownloadSaver` util (MediaStore + legacy)

**Files:**
- Create: `app/src/main/java/com/oves/app/util/DownloadSaver.java`

**Interfaces:**
- Produces: `static android.net.Uri saveToPublicDownloads(Context ctx, byte[] bytes, String fileName, String mimeType) throws IOException`

- [ ] **Step 1: Implement**

`app/src/main/java/com/oves/app/util/DownloadSaver.java`:
```java
package com.oves.app.util;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.text.TextUtils;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;

public final class DownloadSaver {
    private DownloadSaver() {}

    public static Uri saveToPublicDownloads(Context ctx, byte[] bytes, String fileName, String mimeType) throws IOException {
        String safeName = (fileName == null || TextUtils.isEmpty(fileName)) ? ("download_" + System.currentTimeMillis()) : fileName;
        String mime = TextUtils.isEmpty(mimeType) ? "application/octet-stream" : mimeType;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentResolver resolver = ctx.getContentResolver();
            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, safeName);
            values.put(MediaStore.Downloads.MIME_TYPE, mime);
            values.put(MediaStore.Downloads.IS_PENDING, 1);
            Uri collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI;
            Uri item = resolver.insert(collection, values);
            if (item == null) throw new IOException("MediaStore insert returned null");
            try (OutputStream os = resolver.openOutputStream(item)) {
                if (os == null) throw new IOException("openOutputStream returned null");
                os.write(bytes);
                os.flush();
            }
            values.clear();
            values.put(MediaStore.Downloads.IS_PENDING, 0);
            resolver.update(item, values, null, null);
            return item;
        } else {
            File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
            if (!dir.exists()) dir.mkdirs();
            File file = uniqueFile(dir, safeName);
            try (FileOutputStream fos = new FileOutputStream(file)) {
                fos.write(bytes);
                fos.flush();
            }
            MediaScannerConnection.scanFile(ctx, new String[]{file.getAbsolutePath()}, new String[]{mime}, null);
            return Uri.fromFile(file);
        }
    }

    private static File uniqueFile(File dir, String name) {
        File f = new File(dir, name);
        if (!f.exists()) return f;
        int dot = name.lastIndexOf('.');
        String base = dot > 0 ? name.substring(0, dot) : name;
        String ext = dot > 0 ? name.substring(dot) : "";
        for (int i = 1; i < 1000; i++) {
            File c = new File(dir, base + " (" + i + ")" + ext);
            if (!c.exists()) return c;
        }
        return new File(dir, base + " (" + System.currentTimeMillis() + ")" + ext);
    }
}
```

- [ ] **Step 2: Verify it compiles** (combined later in Task 14). For now, confirm no obvious syntax errors by re-reading.

- [ ] **Step 3: Commit**

```bash
git add app/src/main/java/com/oves/app/util/DownloadSaver.java
git commit -m "feat(download): add DownloadSaver (MediaStore + legacy public Downloads)"
```

---

### Task 10: `DownloadNotifier` (channel + tap-to-open) + FileProvider resources

**Files:**
- Create: `app/src/main/java/com/oves/app/util/DownloadNotifier.java`
- Create: `app/src/main/res/xml/file_paths.xml`

**Interfaces:**
- Produces: `static void notifySaved(Context ctx, Uri uri, String fileName, String mimeType)`

- [ ] **Step 1: Implement the notifier**

`app/src/main/java/com/oves/app/util/DownloadNotifier.java`:
```java
package com.oves.app.util;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.NotificationCompat;

public final class DownloadNotifier {
    private static final String CHANNEL_ID = "downloads";
    private DownloadNotifier() {}

    public static void notifySaved(Context ctx, Uri uri, String fileName, String mimeType) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "Downloads", NotificationManager.IMPORTANCE_DEFAULT);
            nm.createNotificationChannel(ch);
        }

        Intent view = new Intent(Intent.ACTION_VIEW);
        view.setDataAndType(uri, mimeType == null ? "*/*" : mimeType);
        view.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pi = PendingIntent.getActivity(ctx, (int) (System.currentTimeMillis() & 0x7fffffff), view, flags);

        Notification n = new NotificationCompat.Builder(ctx, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.stat_sys_download_done)
                .setContentTitle("Saved to Downloads")
                .setContentText(fileName)
                .setContentIntent(pi)
                .setAutoCancel(true)
                .build();
        nm.notify((int) (System.currentTimeMillis() & 0x7fffffff), n);
    }
}
```
(If `androidx.core:core` is not already a dependency, replace `NotificationCompat.Builder(ctx, CHANNEL_ID)` with `new Notification.Builder(ctx, CHANNEL_ID)` guarded for API 26+. Confirm during Task 14 build; oves-app is AndroidX, so NotificationCompat should resolve.)

- [ ] **Step 2: Add FileProvider paths**

`app/src/main/res/xml/file_paths.xml`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<paths>
    <external-path name="downloads" path="Download/" />
    <external-files-path name="ext_files" path="." />
</paths>
```

- [ ] **Step 3: Commit**

```bash
git add app/src/main/java/com/oves/app/util/DownloadNotifier.java app/src/main/res/xml/file_paths.xml
git commit -m "feat(download): add DownloadNotifier + FileProvider paths"
```

---

### Task 11: Repair the `saveFile` bridge handler; drop dead OkHttp paths

**Files:**
- Modify: `app/src/main/java/com/oves/app/activity/BaseWebViewActivity.java`

**Interfaces:**
- Consumes: `DownloadSaver.saveToPublicDownloads`, `DownloadNotifier.notifySaved`.
- Produces: bridge handler `saveFile` that accepts `{ base64, fileName, mimeType }`.

- [ ] **Step 1: Add imports** (top of file, with the other imports):
```java
import android.net.Uri;
import com.oves.app.util.DownloadSaver;
import com.oves.app.util.DownloadNotifier;
import java.util.Base64;
```

- [ ] **Step 2: Register/replace the `saveFile` handler** inside `registerMethod()` (or wherever other `bridgeWebView.registerHandler(...)` calls live). Use this exact handler:
```java
        bridgeWebView.registerHandler("saveFile", new BridgeHandler() {
            @Override
            public void handler(String data, CallBackFunction function) {
                final String base64, fileName, mimeType;
                try {
                    org.json.JSONObject o = new org.json.JSONObject(data);
                    base64 = o.getString("base64");
                    fileName = o.optString("fileName", "receipt_" + System.currentTimeMillis() + ".pdf");
                    mimeType = o.optString("mimeType", "application/octet-stream");
                } catch (Exception e) {
                    function.onCallBack(gson.toJson(Result.fail(PARAMETER_ERROR, false)));
                    return;
                }
                ThreadPool.getExecutor().execute(() -> {
                    try {
                        String raw = base64;
                        int comma = raw.indexOf(',');
                        if (comma != -1) raw = raw.substring(comma + 1);
                        byte[] bytes = Base64.decode(raw, Base64.DEFAULT);
                        final Uri uri = DownloadSaver.saveToPublicDownloads(getApplicationContext(), bytes, fileName, mimeType);
                        runOnUiThread(() -> {
                            DownloadNotifier.notifySaved(getApplicationContext(), uri, fileName, mimeType);
                            Toaster.show("Saved to Downloads");
                            function.onCallBack(gson.toJson(Result.ok(uri.toString())));
                        });
                    } catch (Exception e) {
                        runOnUiThread(() -> {
                            Toaster.show("Download failed");
                            function.onCallBack(gson.toJson(Result.fail(FAIL, false)));
                        });
                    }
                });
            }
        });
```
> Note: `Base64.decode` here is `android.util.Base64` — use that (remove the `java.util.Base64` import if the project prefers `android.util.Base64`; either works, but keep one consistently).

- [ ] **Step 3: Remove the dead OkHttp `downloadFile` handler and the URL-based `setupDownloadListener()`** if the prior attempt's versions are present in this worktree (they are NOT in a fresh `main` checkout — confirm with `grep -n "downloadFile\|setupDownloadListener" BaseWebViewActivity.java`; if absent, nothing to remove).

- [ ] **Step 4: Commit**

```bash
git add app/src/main/java/com/oves/app/activity/BaseWebViewActivity.java
git commit -m "feat(download): saveFile handler writes to public Downloads + notifies"
```

---

### Task 12: `setDownloadListener` for http(s) downloads

**Files:**
- Modify: `app/src/main/java/com/oves/app/activity/WebViewActivity.java` (inside `initWebView()`, near `setWebViewClient`) and `app/src/main/java/com/oves/app/activity/fragment/WebViewFragment.java` (same).

**Interfaces:** uses `DownloadManager`, `CookieManager`.

- [ ] **Step 1: Add the listener** in each `initWebView()` after the WebView is configured:
```java
        bridgeWebView.setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) -> {
            try {
                if (url == null) return;
                if (url.startsWith("http")) {
                    android.app.DownloadManager.Request req = new android.app.DownloadManager.Request(android.net.Uri.parse(url));
                    req.setMimeType(mimetype);
                    String cookie = android.webkit.CookieManager.getInstance().getCookie(url);
                    if (cookie != null) req.addRequestHeader("cookie", cookie);
                    req.addRequestHeader("User-Agent", userAgent);
                    String name = android.webkit.URLUtil.guessFileName(url, contentDisposition, mimetype);
                    req.setNotificationVisibility(android.app.DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                    req.setDestinationInExternalPublicDir(android.os.Environment.DIRECTORY_DOWNLOADS, name);
                    android.app.DownloadManager dm = (android.app.DownloadManager) getContext().getSystemService(android.content.Context.DOWNLOAD_SERVICE);
                    if (dm != null) dm.enqueue(req);
                }
                // blob:/data: are handled by the JS shim (Task 13) → saveFile bridge handler.
            } catch (Exception e) {
                android.util.Log.e("WebDownload", "download listener error", e);
            }
        });
```
> In `WebViewActivity` use `this` / `getApplicationContext()` instead of `getContext()` (Activity has no `getContext()`); in `WebViewFragment` use `requireContext()`.

- [ ] **Step 2: Commit**

```bash
git add app/src/main/java/com/oves/app/activity/WebViewActivity.java app/src/main/java/com/oves/app/activity/fragment/WebViewFragment.java
git commit -m "feat(download): route http(s) WebView downloads to DownloadManager"
```

---

### Task 13: JS shim to capture blob:/data: anchor downloads

**Files:**
- Modify: `WebViewActivity.java` `onPageFinished` (~L215) and `WebViewFragment.java` `onPageFinished` (~L165).

- [ ] **Step 1: Inject the shim** after `super.onPageFinished(view, url);` in each:
```java
                String js =
                    "(function(){if(window.__ovesDownloadHooked)return;window.__ovesDownloadHooked=true;" +
                    "document.addEventListener('click',function(e){" +
                    "var a=e.target&&e.target.closest?e.target.closest('a[download]'):null;" +
                    "if(!a)return;var href=a.getAttribute('href')||'';" +
                    "if(href.indexOf('blob:')!==0&&href.indexOf('data:')!==0)return;" +
                    "e.preventDefault();" +
                    "var name=a.getAttribute('download')||'download';" +
                    "fetch(href).then(function(r){return r.blob();}).then(function(b){" +
                    "var fr=new FileReader();fr.onloadend=function(){" +
                    "var res=String(fr.result||'');var i=res.indexOf(',');var b64=i>=0?res.slice(i+1):res;" +
                    "if(window.WebViewJavascriptBridge){window.WebViewJavascriptBridge.callHandler('saveFile',JSON.stringify({base64:b64,fileName:name,mimeType:b.type||'application/octet-stream'}),function(){});}" +
                    "};fr.readAsDataURL(b);});" +
                    "},true);})();";
                view.evaluateJavascript(js, null);
```

- [ ] **Step 2: Commit**

```bash
git add app/src/main/java/com/oves/app/activity/WebViewActivity.java app/src/main/java/com/oves/app/activity/fragment/WebViewFragment.java
git commit -m "feat(download): inject JS shim to capture blob/data anchor downloads"
```

---

### Task 14: Manifest — POST_NOTIFICATIONS, FileProvider, runtime permission

**Files:**
- Modify: `app/src/main/AndroidManifest.xml`
- Modify: `app/src/main/java/com/oves/app/activity/BaseWebViewActivity.java` (runtime notif permission request)

- [ ] **Step 1: Add permission** (with the other `uses-permission` lines):
```xml
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

- [ ] **Step 2: Add the FileProvider** inside `<application>`:
```xml
        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="${applicationId}.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_paths" />
        </provider>
```
> If a `<provider>` with the same authority already exists, do not duplicate it; reuse it.

- [ ] **Step 3: Request POST_NOTIFICATIONS at runtime** — in `BaseWebViewActivity.onCreate` (after `initPermissions()` or alongside it):
```java
        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 9911);
        }
```
(Add `import android.os.Build;` if not already imported. Denial is non-fatal — files still save.)

- [ ] **Step 4: Commit**

```bash
git add app/src/main/AndroidManifest.xml app/src/main/java/com/oves/app/activity/BaseWebViewActivity.java
git commit -m "feat(download): add POST_NOTIFICATIONS, FileProvider, runtime perm"
```

---

### Task 15: Build the debug APK

- [ ] **Step 1: Build** (from the oves-app worktree, JDK 17):
```bash
JAVA_HOME=/c/Users/pc/dev-tools/jdk17 ./gradlew assembleDebug
```
Expected: `BUILD SUCCESSFUL`; APK at `app/build/outputs/apk/debug/`. Fix any compile errors (most likely: `NotificationCompat` dependency, `getContext()` vs `requireContext()`, `Base64` import choice) and rebuild.

- [ ] **Step 2: Commit** any build-fix changes with a clear message.

---

## Phase 4 — End-to-end verification (on Dennis's phone)

### Task 16: Manual E2E

- [ ] Install the debug APK on the phone.
- [ ] Point the WebView at the `ble-app` build containing the web changes (deploy the worktree branch to the dev/staging URL the app loads, or sideload).
- [ ] For each flow, complete a transaction and tap **Download receipt** / **Download Invoice**:
  - [ ] Attendant swap → PDF appears in Downloads; toast shown; notification tap opens the PDF.
  - [ ] Sales registration → same.
  - [ ] Top-up → same.
  - [ ] Rider → same.
  - [ ] Orders → invoice AND proforma.
  - [ ] OTA upload page download → file in Downloads.
- [ ] Confirm on an Android 13+ device the notification-permission prompt appears once; deny it and confirm the file still saves (toast-only).
- [ ] Report results; if anything fails, debug with `systematic-debugging` before claiming done.

---

## Self-Review

**Spec coverage:**
- §4.1 saveFile util → Task 1 ✓
- §4.2 receipt PDF generator → Task 2 ✓
- §4.3 SuccessReceipt button (Attendant+Sales) → Task 3 ✓
- §4.4 Top-up → Task 4 ✓
- §4.5 Rider → Task 5 ✓
- §4.6 Orders refactor → Task 6 ✓
- §4.7 OTA (no web change; verify) → Task 16 ✓
- §5.1 repair saveFile handler → Task 11 ✓
- §5.2 JS shim → Task 13 ✓
- §5.3 setDownloadListener → Task 12 ✓
- §5.4 DownloadSaver → Task 9 ✓
- §5.5 notification → Task 10 ✓
- §5.6 permissions/manifest/FileProvider → Tasks 10, 14 ✓
- §8 testing → Tasks 8, 15, 16 ✓
- §9 worktrees → Task 0 ✓
- i18n strings (implied by UI) → Task 7 ✓

**Placeholder scan:** Task 5 (Rider) requires in-situ discovery of the success block (Step 1) before wiring — this is an explicit action with the mapping pattern provided, not a vague placeholder. All other tasks contain complete code.

**Type consistency:** `saveFile(blob, filename, mimeType?)`, `generateReceiptPdf(input): Promise<Blob>`, `buildReceiptFilename({receiptId?, title}, date?)`, `ReceiptRow` — names match across Tasks 1–6 and the Android `{base64, fileName, mimeType}` payload matches the handler in Task 11.
