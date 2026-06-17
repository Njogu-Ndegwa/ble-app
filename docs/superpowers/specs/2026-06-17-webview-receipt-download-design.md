# WebView Receipt/File Download — End-to-End Design

- **Date:** 2026-06-17
- **Status:** Approved (design) — pending spec review
- **Author:** Dennis + Claude
- **Repos in scope:** `ble-app` (web) and `HTML5_WebView_APP` (Android WebView host, package `com.example.myapplication`, the build on Dennis's phone)
- **Explicitly out of scope:** `oves-app` (not the production build)

## 1. Problem

Users cannot download receipts/files from the applet when it runs inside the Android WebView.

Two independent failures combine to make every download a no-op:

1. **No download action exists on receipts.** The success screens at the end of each flow render a receipt for *viewing* only:
   - Attendant (swap) and Sales (registration) use the shared `SuccessReceipt` component — it has per-row copy buttons but **no download/save action**.
   - Top-up (`StepDone`) and Rider render their own custom receipt UI, also with no download.
   The only PDF download anywhere is the Orders invoice/proforma.

2. **The one existing download dies in the WebView.** `src/lib/portal/generate-invoice-pdf.ts` builds the PDF client-side as a jsPDF `blob`, then tries, in order: `navigator.share` → open a `data:` URL in a new tab → `<a download>.click()`. Inside the Android WebView all three silently fail: file sharing via `navigator.canShare({files})` is unsupported, `window.open` is blocked, and a `blob:` anchor download has no `DownloadListener` to handle it. Nothing happens and no error surfaces.

A prior attempt (in `oves-app`, now out of scope) added an OkHttp-based `downloadFile` bridge handler that can only fetch an HTTP URL — useless for a client-generated `blob:` — plus a `saveFile(base64)` handler the web side never called that wrote to app-private storage (invisible to the user). It was never ported to `HTML5_WebView_APP`. That approach is abandoned.

## 2. Goals / Non-Goals

**Goals**
- Add a working **Download receipt** action to every flow's success screen: Attendant, Sales, Top-up, Rider.
- Make the existing **Orders invoice/proforma** download work inside the WebView.
- Files land in the phone's **public Downloads** folder, visible in the file manager.
- After a save: a **toast** ("Saved to Downloads") plus a **notification whose tap opens the file** in the user's default viewer.
- A **generic** Android mechanism so any current or future download (including the OTA file download) "just works" with no per-feature native code.
- Graceful fallback to normal browser behaviour when the app runs in a regular browser (not the WebView).

**Non-Goals**
- No server-side PDF generation (receipts stay client-side).
- No download-progress UI for v1 (receipts are small; the notification is the completion signal).
- No changes to `oves-app`.
- No pixel-perfect screenshot of the on-screen card (we render a clean PDF from structured data — no `html2canvas` dependency).

## 3. Architecture Overview

```
[Flow success screen]
   └─ "Download receipt" button
        └─ generateReceiptPdf({title, receiptId, rows}) ──► Blob
              └─ saveFile(blob, filename, mimeType)         ← single shared entry point
                    ├─ in WebView?  →  anchor download (blob:)  ─┐
                    └─ in browser? →  navigator.share / anchor   │
                                                                 ▼
   ANDROID (HTML5_WebView_APP / WebViewFragment)
        ├─ injected JS shim: intercepts <a download> blob:/data: clicks
        │     → FileReader → base64 → AndroidFileSaver.save(base64, name, mime)
        ├─ setDownloadListener: routes http(s): downloads → system DownloadManager
        └─ AndroidFileSaver.save():
              → DownloadSaver.saveToPublicDownloads()  (MediaStore 29+ / legacy+scan 26–28)
              → Toast "Saved to Downloads"
              → Notification (tap = ACTION_VIEW on content Uri)
```

### Design principles
- **One web entry point** (`saveFile`) so no flow re-implements share/anchor logic.
- **One PDF generator** keyed on the existing `{title, receiptId, rows[]}` receipt model.
- **Generic native capture**: the Android side never knows what a "receipt" is — it captures any download the WebView emits.

## 4. Web Side (`ble-app`)

### 4.1 `saveFile` util — `src/lib/download/saveFile.ts` (new)
Single WebView-aware download entry point.

```ts
export function isOvesWebView(): boolean
// true when running inside HTML5_WebView_APP — detected via the bridge/JS interface
// presence (e.g. window.WebViewJavascriptBridge or window.AndroidFileSaver) and/or UA marker.

export async function saveFile(
  blob: Blob,
  filename: string,
  mimeType?: string,
): Promise<void>
```

Behaviour:
- **In the WebView:** create an object URL and trigger an `<a download={filename}>` click. The Android JS shim intercepts this, reads the blob, and saves natively. (Anchor is used rather than a direct bridge call so the *same* path also covers any other anchor-based download; the shim is the universal catch.) Skip `navigator.share`/`window.open` entirely here — they only swallow the flow.
- **In a normal browser:** keep today's behaviour — `navigator.share({files})` when available, else anchor download.

This replaces the bespoke logic currently inlined at the end of `generate-invoice-pdf.ts`.

### 4.2 Receipt → PDF generator — `src/lib/receipt/generate-receipt-pdf.ts` (new)
```ts
import type { ReceiptRow } from '@/components/shared/SuccessReceipt';

export interface ReceiptPdfInput {
  title: string;          // e.g. "Swap Complete"
  receiptId?: string;     // e.g. "TXN-12345"
  receiptTitle?: string;  // e.g. "Transaction Receipt"
  rows: ReceiptRow[];     // existing label/value model
  brandLogoUrl?: string;  // '/assets/Logo-Oves.png'
}

export function generateReceiptPdf(input: ReceiptPdfInput): Blob;
```
- Uses `jspdf` (already a dependency via the invoice generator). Renders header (logo + title + receipt id), then a label/value table from `rows`, then a footer/timestamp.
- Reuses the styling constants from `generate-invoice-pdf.ts` (fonts, colors, margins) — extract shared bits if cleanly possible; otherwise mirror them.
- Filename convention: `<receiptId || title-slug>-<yyyymmdd-hhmm>.pdf`.

### 4.3 `SuccessReceipt` button — `src/components/shared/SuccessReceipt.tsx`
- Add an optional **Download** button in the receipt card header/footer, shown when downloadable (default on).
- On click: `saveFile(generateReceiptPdf({title, receiptId, receiptTitle, rows}), filename, 'application/pdf')`, with a toast on success and on failure.
- Because Attendant `Step6Success` and Sales `Step5Success` already pass `title`/`receiptId`/`rows`, **both get download for free**.

### 4.4 Top-up — `src/app/(mobile)/topup/components/StepDone.tsx`
- It builds rows inline via a local `row()` helper against a `TopupReceipt`. Add a Download button that maps the `TopupReceipt` into `ReceiptRow[]` (or refactors `StepDone` to render through `SuccessReceipt`) and calls `generateReceiptPdf` + `saveFile`. Recommended: reuse `SuccessReceipt` if the layout matches; otherwise a thin local mapping.

### 4.5 Rider — `src/app/(mobile)/rider/app/RiderApp.tsx`
- Identify the success/receipt render point and add a Download button wired to `generateReceiptPdf` + `saveFile`, mapping the rider transaction data into `ReceiptRow[]`. (Rider is the largest component; the change is localized to its success surface.)

### 4.6 Orders invoice — `src/lib/portal/generate-invoice-pdf.ts` + `OrderDetail.tsx`
- Refactor the tail of `generateInvoicePdf` to produce the blob and delegate to the shared `saveFile`. Removes the WebView-dead share/new-tab/anchor block. Invoice + proforma then work in the WebView via the same path.

### 4.7 OTA download — `src/app/(mobile)/ota/upload/page.tsx`
- No web change required: it already uses a raw `<a download>` anchor, which the Android shim captures. Verify only.

## 5. Android Side (`HTML5_WebView_APP`, package `com.example.myapplication`)

Live WebView host: **`activity/fragment/WebViewFragment.java`** — `BridgeWebView bridgeWebView`, bridge lib `com.github.lzyzsd.jsbridge`, `onPageFinished` at ~L163-167. (`BaseWebViewActivity.java` also hosts a bridge instance; wire whichever instance loads the applet — confirmed during planning. Apply to the fragment's WebView, which loads the applet.)

### 5.1 `AndroidFileSaver` (new `@JavascriptInterface` class)
Registered via `bridgeWebView.addJavascriptInterface(new AndroidFileSaver(context), "AndroidFileSaver")` during WebView init.
```java
@JavascriptInterface
public void save(String base64, String fileName, String mimeType)
```
- Decodes base64 (strips any `data:...;base64,` prefix) on a background thread (`ThreadPool`).
- Delegates to `DownloadSaver.saveToPublicDownloads(...)`.
- On success: post toast + notification on the UI thread. On failure: toast "Download failed" + log.
- Guards: empty/oversized payload rejected with a logged error + toast.

### 5.2 JS shim (injected in `onPageFinished` via `evaluateJavascript`)
Adds a **capturing** document click listener (idempotent — guard with a `window.__ovesDownloadHooked` flag):
- On click, walk to the nearest `<a download>` (or element with `download` attr).
- If its `href` starts with `blob:` or `data:` → `preventDefault()`, `fetch(href)` → `blob()` → `FileReader.readAsDataURL` → call `AndroidFileSaver.save(dataUrl, downloadName, blob.type)`.
- `http(s):` anchors fall through to the native `DownloadListener` (5.3).
- Catches programmatic `a.click()` (synthetic clicks bubble to the capturing listener).

### 5.3 `setDownloadListener` (WebView init)
- For `http(s):` URLs: enqueue a `DownloadManager.Request` into public Downloads with `setNotificationVisibility(VISIBLE_NOTIFY_COMPLETED)` and cookies forwarded via `CookieManager`. DownloadManager provides its own visible notification + open-on-tap.
- For `data:` top-level downloads: decode and route to `DownloadSaver`.

### 5.4 `DownloadSaver` (new util)
```java
static Uri saveToPublicDownloads(Context ctx, byte[] bytes, String fileName, String mimeType)
```
- **API 29+ (primary, minSdk is 26 / targetSdk 34):** `MediaStore.Downloads.EXTERNAL_CONTENT_URI` insert (`IS_PENDING` write then clear) → public Downloads, no storage permission. Returns the content Uri.
- **API 26–28:** write to `Environment.DIRECTORY_DOWNLOADS` (have `WRITE_EXTERNAL_STORAGE`) + `MediaScannerConnection.scanFile` so it appears in file managers. Build an openable Uri via the existing/added `FileProvider`.
- Collision-safe naming: `name (1).pdf`, `name (2).pdf`, …

### 5.5 Notification (tap-to-open)
- Create a notification channel (once). Post a notification "Saved to Downloads — <filename>".
- Tap → `PendingIntent` with `ACTION_VIEW` on the saved Uri + `FLAG_GRANT_READ_URI_PERMISSION` + the file's MIME type → opens the default viewer.
- If no viewer handles the MIME, the notification still confirms the save; toast guides the user to Downloads.

### 5.6 Permissions / manifest
- Add `<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>`.
- Runtime-request `POST_NOTIFICATIONS` on API 33+ at an appropriate point; if denied, degrade to **toast-only** (still saves the file).
- Confirm a `FileProvider` exists for the legacy (<29) open path; add one (`@xml/file_paths` with the Downloads dir) if absent. Not needed for the 29+ MediaStore Uri.

## 6. Data Flow (happy path, in WebView)

1. User taps **Download receipt** on a success screen.
2. `generateReceiptPdf(...)` returns a PDF `Blob`.
3. `saveFile(blob, name, 'application/pdf')` creates a `blob:` URL and clicks a hidden `<a download>`.
4. JS shim intercepts → reads blob → base64 → `AndroidFileSaver.save(...)`.
5. `DownloadSaver` writes to public Downloads (MediaStore) → content Uri.
6. Toast "Saved to Downloads" + notification posted.
7. User taps notification → PDF opens in their viewer.

## 7. Error Handling

| Failure | Handling |
|---|---|
| PDF generation throws | Web toast "Failed to generate receipt"; nothing saved. |
| Not in WebView | Browser fallback (share/anchor); unchanged behaviour. |
| Blob read fails in shim | No native call; logged; web flow unbroken. |
| base64 decode / IO error | Native toast "Download failed" + log; no notification. |
| `POST_NOTIFICATIONS` denied (33+) | File still saved; toast only. |
| No viewer for MIME on tap | Notification confirms save; no crash. |

## 8. Testing & Verification

**Android (primary — on Dennis's phone):**
1. Build debug APK of `HTML5_WebView_APP`, install on the phone (Gradle needs JDK 17 — see `dev-tools/jdk17` per project notes).
2. Run each flow to completion and tap Download:
   - Attendant swap → receipt PDF in Downloads, opens on tap.
   - Sales registration → same.
   - Top-up → same.
   - Rider → same.
   - Orders → invoice **and** proforma.
   - OTA upload page download → file lands in Downloads.
3. Confirm toast + tap-to-open notification each time.
4. Verify on API 33+ (notification-permission path); if a ≤28 device is available, verify the legacy path.

**Web:**
- In a desktop browser, confirm downloads still work via the browser fallback (no regression).
- Type-check / lint / existing test suite pass.

## 9. Rollout — isolated worktrees

- **`ble-app`** — new git worktree off the current `dev` branch; branch e.g. `feat/webview-receipt-download`.
- **`HTML5_WebView_APP`** — new git worktree off `master`; branch e.g. `feat/webview-download`. Primary, since this is the phone build.
- Web and Android land together (the contract spans both); verify end-to-end before merging either.

## 10. Risks & Mitigations

- **Shim misses a programmatic download** → mitigated by capturing-phase listener that catches synthetic `a.click()`; `setDownloadListener` covers http(s).
- **`BridgeWebViewClient` re-injection on navigation** → idempotent shim guard; inject after `super.onPageFinished`.
- **MediaStore quirks across OEMs** → standard `IS_PENDING` insert pattern; legacy fallback for <29.
- **Large base64 across the bridge** → receipts are small (tens of KB); acceptable. Future large files can use the http(s) DownloadManager path instead.

## 11. Open Questions
- None blocking. The exact `ble-app` base branch (`dev` vs `master`) and whether Top-up/Rider should be migrated onto `SuccessReceipt` vs a thin local mapping will be finalized in the implementation plan.
