# WebView Receipt/File Download — End-to-End Design

- **Date:** 2026-06-17
- **Status:** Approved (design) — pending spec review
- **Author:** Dennis + Claude
- **Repos in scope:** `ble-app` (web) and **`oves-app`** (the real Android backend app, package `com.oves.app`, default branch `main`)
- **Explicitly out of scope:** `HTML5_WebView_APP` (not the production build)

> **Correction note:** An earlier draft of this spec targeted `HTML5_WebView_APP`. That was wrong — `oves-app` is the real app. This spec targets `oves-app`, which conveniently already contains the prior (half-built) download attempt to repair rather than rebuild.

## 1. Problem

Users cannot download receipts/files from the applet when it runs inside the Android WebView.

Two independent failures combine to make every download a no-op:

1. **No download action exists on receipts.** The success screens at the end of each flow render a receipt for *viewing* only:
   - Attendant (swap) and Sales (registration) use the shared `SuccessReceipt` component — it has per-row copy buttons but **no download/save action**.
   - Top-up (`StepDone`) and Rider render their own custom receipt UI, also with no download.
   The only PDF download anywhere is the Orders invoice/proforma.

2. **The one existing download dies in the WebView.** `src/lib/portal/generate-invoice-pdf.ts` builds the PDF client-side as a jsPDF `blob`, then tries, in order: `navigator.share` → open a `data:` URL in a new tab → `<a download>.click()`. Inside the Android WebView all three silently fail: file sharing via `navigator.canShare({files})` is unsupported, `window.open` is blocked, and a `blob:` anchor download has no handler. Nothing happens and no error surfaces.

### Prior attempt (in `oves-app`, to be repaired)
The `fix/download-functionality` worktree (`C:\Users\pc\oves-app\.claude\worktrees\fix-download`, branch behind `origin/dev` by ~12 commits) already added, uncommitted, to `BaseWebViewActivity.java`:
- A `setupDownloadListener()` + a `downloadFile` bridge handler that use **OkHttp to fetch an HTTP URL** — useless for a client-generated `blob:`. **Dead path; will be dropped.**
- A correct-shaped **`saveFile(base64, fileName)` bridge handler** — but the web side never calls it, and it writes to **app-private** storage (`Android/data/com.oves.app/files/Download/`, invisible to the user). **This is the piece to keep and fix** (write to public Downloads + notify).

So the work is: wire the web side to call `saveFile`, and fix `saveFile` to save to public Downloads with a tap-to-open notification.

## 2. Goals / Non-Goals

**Goals**
- Add a working **Download receipt** action to every flow's success screen: Attendant, Sales, Top-up, Rider.
- Make the existing **Orders invoice/proforma** download work inside the WebView.
- Files land in the phone's **public Downloads** folder, visible in the file manager.
- After a save: a **toast** ("Saved to Downloads") plus a **notification whose tap opens the file**.
- A **generic** Android safety-net so any other anchor-based download (e.g. the OTA file) also works without per-feature native code.
- Graceful fallback to normal browser behaviour outside the WebView.

**Non-Goals**
- No server-side PDF generation (receipts stay client-side).
- No download-progress UI for v1 (the notification is the completion signal).
- No changes to `HTML5_WebView_APP`.
- No pixel-perfect screenshot of the on-screen card (clean PDF from structured data — no `html2canvas`).

## 3. Architecture Overview

```
[Flow success screen]
   └─ "Download receipt" button
        └─ generateReceiptPdf({title, receiptId, rows}) ──► Blob
              └─ saveFile(blob, filename, mimeType)         ← single shared entry point
                    ├─ in WebView?  →  FileReader→base64 → bridge.callHandler('saveFile', {base64, fileName})
                    └─ in browser? →  navigator.share / anchor
                                                                 ▼
   ANDROID (oves-app, com.oves.app)
        ├─ saveFile bridge handler (REPAIR existing):
        │     base64 → DownloadSaver.saveToPublicDownloads() → toast + notification
        ├─ JS shim (safety net, injected onPageFinished):
        │     intercept <a download> blob:/data: clicks → base64 → same saveFile handler
        └─ setDownloadListener: route http(s): downloads → system DownloadManager
```

### Design principles
- **One web entry point** (`saveFile`) so no flow re-implements share/anchor logic.
- **One PDF generator** keyed on the existing `{title, receiptId, rows[]}` receipt model.
- **Reuse the existing bridge** (`window.WebViewJavascriptBridge`) — the same channel BLE/MQTT already use; no new `@JavascriptInterface`.
- **Generic native safety net**: the JS shim captures any anchor download not routed through `saveFile` (e.g. OTA).

## 4. Web Side (`ble-app`)

The bridge is already exposed via `src/app/context/bridgeContext.tsx`: `window.WebViewJavascriptBridge.callHandler(name, data, cb)`, ready after the `WebViewJavascriptBridgeReady` event. The `saveFile` util reuses this — no new bridge plumbing.

### 4.1 `saveFile` util — `src/lib/download/saveFile.ts` (new)
```ts
export function isOvesWebView(): boolean
// true when window.WebViewJavascriptBridge is present.

export async function saveFile(
  blob: Blob,
  filename: string,
  mimeType?: string,
): Promise<void>
```
Behaviour:
- **In the WebView:** `FileReader.readAsDataURL(blob)` → strip prefix → `window.WebViewJavascriptBridge.callHandler('saveFile', JSON.stringify({ base64, fileName: filename }), cb)`. Deterministic; does not depend on the shim. Skip `navigator.share`/`window.open`.
- **In a normal browser:** today's behaviour — `navigator.share({files})` when available, else anchor download.

Replaces the bespoke logic currently inlined at the end of `generate-invoice-pdf.ts`.

### 4.2 Receipt → PDF generator — `src/lib/receipt/generate-receipt-pdf.ts` (new)
```ts
import type { ReceiptRow } from '@/components/shared/SuccessReceipt';

export interface ReceiptPdfInput {
  title: string;          // "Swap Complete"
  receiptId?: string;     // "TXN-12345"
  receiptTitle?: string;  // "Transaction Receipt"
  rows: ReceiptRow[];     // existing label/value model
  brandLogoUrl?: string;  // '/assets/Logo-Oves.png'
}
export function generateReceiptPdf(input: ReceiptPdfInput): Blob;
```
- Uses `jspdf` (already a dependency). Header (logo + title + id), label/value table from `rows`, footer/timestamp.
- Reuses styling constants from `generate-invoice-pdf.ts` (extract shared bits if clean, else mirror).
- Filename: `<receiptId || title-slug>-<yyyymmdd-hhmm>.pdf`.

### 4.3 `SuccessReceipt` button — `src/components/shared/SuccessReceipt.tsx`
- Add an optional **Download** button (default on). On click: `saveFile(generateReceiptPdf({title, receiptId, receiptTitle, rows}), filename, 'application/pdf')`, with success/failure toasts.
- Attendant `Step6Success` and Sales `Step5Success` already pass `title`/`receiptId`/`rows` → both get download for free.

### 4.4 Top-up — `src/app/(mobile)/topup/components/StepDone.tsx`
- Map its `TopupReceipt` into `ReceiptRow[]` (or render through `SuccessReceipt`) and add the Download button → `generateReceiptPdf` + `saveFile`.

### 4.5 Rider — `src/app/(mobile)/rider/app/RiderApp.tsx`
- Add a Download button at the success/receipt render point, mapping rider transaction data into `ReceiptRow[]`. Change localized to that surface.

### 4.6 Orders invoice — `src/lib/portal/generate-invoice-pdf.ts` + `OrderDetail.tsx`
- Refactor the tail of `generateInvoicePdf` to build the blob and delegate to shared `saveFile`. Invoice + proforma then work in the WebView.

### 4.7 OTA download — `src/app/(mobile)/ota/upload/page.tsx`
- No web change required: its raw `<a download>` is captured by the Android shim. Verify only.

## 5. Android Side (`oves-app`, `com.oves.app`)

Hosts: `activity/BaseWebViewActivity.java` (registers bridge handlers, `bridgeWebView`, `onCreate` already calls the prior `setupDownloadListener()`); WebView clients with `onPageFinished` in `activity/WebViewActivity.java` (L215) and `activity/fragment/WebViewFragment.java` (L165). Bridge lib `com.github.lzyzsd.jsbridge`. minSdk 26 / targetSdk 34. Confirm during planning which host loads the applet and inject the shim there (likely both for safety).

### 5.1 Repair the `saveFile` bridge handler (`BaseWebViewActivity.java`)
- Keep the existing `registerHandler("saveFile", …)` shape `{base64, fileName}`; decode base64 (strip any `data:…;base64,` prefix) on a background thread.
- Replace the app-private write with `DownloadSaver.saveToPublicDownloads(...)`.
- On success: toast + notification (UI thread); callback `Result.ok(uri)`. On failure: toast "Download failed" + `Result.fail`.
- Drop the dead OkHttp `downloadFile` handler and the URL-based `setupDownloadListener`→OkHttp path (replaced by 5.3).

### 5.2 JS shim (safety net) — injected in `onPageFinished` via `evaluateJavascript`
Capturing-phase document click listener (idempotent via `window.__ovesDownloadHooked`):
- Walk to nearest `<a download>`; if `href` starts with `blob:`/`data:` → `preventDefault()`, `fetch(href)` → `blob()` → `FileReader.readAsDataURL` → `window.WebViewJavascriptBridge.callHandler('saveFile', JSON.stringify({base64, fileName}), …)`.
- Catches programmatic `a.click()` (synthetic clicks bubble). `http(s):` anchors fall through to 5.3.

### 5.3 `setDownloadListener` (replace prior OkHttp version)
- `http(s):` URLs → `DownloadManager.Request` into public Downloads, cookies via `CookieManager`, `VISIBLE_NOTIFY_COMPLETED` (its own notification + open-on-tap).
- `data:` top-level → decode → `DownloadSaver`.

### 5.4 `DownloadSaver` (new util)
```java
static Uri saveToPublicDownloads(Context ctx, byte[] bytes, String fileName, String mimeType)
```
- **API 29+ (primary):** `MediaStore.Downloads.EXTERNAL_CONTENT_URI` insert (`IS_PENDING` then clear) → public Downloads, no storage permission → content Uri.
- **API 26–28:** write to `Environment.DIRECTORY_DOWNLOADS` (have `WRITE_EXTERNAL_STORAGE`) + `MediaScannerConnection.scanFile`; openable Uri via FileProvider.
- Collision-safe naming: `name (1).pdf`, ….

### 5.5 Notification (tap-to-open)
- One notification channel. Notification "Saved to Downloads — <filename>"; tap → `PendingIntent` `ACTION_VIEW` on the Uri + `FLAG_GRANT_READ_URI_PERMISSION` + MIME → default viewer. No viewer → notification still confirms save.

### 5.6 Permissions / manifest
- Add `<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>` (absent today).
- Runtime-request `POST_NOTIFICATIONS` on API 33+; if denied, degrade to **toast-only** (still saves).
- Add a `FileProvider` (absent today) for the legacy (<29) open path; not needed for 29+ MediaStore Uri.

## 6. Data Flow (happy path, in WebView)
1. User taps **Download receipt**.
2. `generateReceiptPdf(...)` → PDF `Blob`.
3. `saveFile(blob, name, 'application/pdf')` → base64 → `callHandler('saveFile', {base64, fileName})`.
4. Android `saveFile` handler → `DownloadSaver.saveToPublicDownloads` → public Downloads → content Uri.
5. Toast "Saved to Downloads" + notification.
6. Tap notification → PDF opens.

## 7. Error Handling

| Failure | Handling |
|---|---|
| PDF generation throws | Web toast "Failed to generate receipt"; nothing saved. |
| Not in WebView | Browser fallback (share/anchor); unchanged. |
| base64 read fails (web) | No bridge call; logged; flow unbroken. |
| base64 decode / IO error (native) | Toast "Download failed" + log; no notification; `Result.fail`. |
| `POST_NOTIFICATIONS` denied (33+) | File still saved; toast only. |
| No viewer for MIME on tap | Notification confirms save; no crash. |

## 8. Testing & Verification

**Android (primary — on Dennis's phone):**
1. Build debug APK of `oves-app` (Gradle needs JDK 17 — `dev-tools/jdk17` per project notes), install.
2. Run each flow to completion and tap Download:
   - Attendant swap, Sales registration, Top-up, Rider → receipt PDF in Downloads, opens on tap.
   - Orders → invoice **and** proforma.
   - OTA upload page download → file in Downloads.
3. Confirm toast + tap-to-open notification each time.
4. Verify on API 33+ (notification-permission path); if a ≤28 device exists, verify legacy path.

**Web:**
- Desktop browser: downloads still work via browser fallback (no regression).
- Type-check / lint / existing tests pass.

## 9. Rollout — isolated worktrees

- **`ble-app`** — new git worktree off `dev` (current local branch); branch e.g. `feat/webview-receipt-download`.
- **`oves-app`** — **reuse the existing `fix/download-functionality` worktree** at `C:\Users\pc\oves-app\.claude\worktrees\fix-download` (update it: it's ~12 commits behind `origin/dev`/`main`); keep the good `saveFile` handler, drop the OkHttp paths.
- Web and Android land together (the contract spans both); verify end-to-end before merging either.

## 10. Risks & Mitigations
- **Shim misses a programmatic download** → capturing-phase listener catches synthetic `a.click()`; `setDownloadListener` covers http(s); receipts/invoice use the deterministic direct bridge call anyway.
- **`BridgeWebViewClient` re-injection on navigation** → idempotent shim guard; inject after `super.onPageFinished`.
- **MediaStore OEM quirks** → standard `IS_PENDING` pattern + legacy fallback for <29.
- **Large base64 across bridge** → receipts are small (tens of KB); large files can use the http(s) DownloadManager path.
- **Stale oves-app worktree** → rebase/update onto current `main` before adding work.

## 11. Open Questions
- None blocking. Final items for the plan: confirm which oves-app host (`WebViewActivity` vs `WebViewFragment`) loads the applet (inject shim there / both); whether Top-up/Rider reuse `SuccessReceipt` vs a thin local mapping.
