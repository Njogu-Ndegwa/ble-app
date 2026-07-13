# ble-app — Agent Working Agreements

## Project overview
Next.js mobile-first web app (PWA/WebView) for BLE device management, PAYGO energy services, and attendant workflows. Deployed as a WebView on Android (`wvapp.omnivoltaic.com`). Git branch `dev` is the active development branch; `master` (dennis/master remote) is dev/staging — force-push there is expected.

## API conventions
- **Main GraphQL API** (`apiUrl`): federated-graphql-api.omnivoltaic.com — ERM/Thing microservices (BLE Device Manager, device reads/writes)
- **ABS Platform API** (`absApiUrl`): abs-platform-dev.omnivoltaic.com — Attendant & Sales workflows
- **Odoo-calling flows** (swap, sales, activator, rider): must use GraphQL only — never MQTT preconditions
- **BLE/Keypad applets**: MQTT is allowed here

## Auth architecture
- Main app tokens: `access_token`, `refresh_token`, `distributorId`, `user` in localStorage
- BLE Device Manager applet tokens: `ble-dm-token`, `ble-dm-refresh-token`, `ble-dm-user` (scoped, separate from main)
- Apollo errorLink in `src/lib/apollo-client.ts` handles silent token refresh on UNAUTHENTICATED; reads `data.refreshClientAccessToken` (NOT `data.refreshToken`) from the REFRESH_TOKEN mutation response
- `AUTH_OPERATIONS = new Set(["SignInUser", "RefreshClientAccessToken"])` exempts auth mutations from errorLink interception — add new auth mutations here to prevent infinite loops
- `clearAllAuth()` in `src/lib/attendant-auth.ts` wipes all auth including DM keys

## BLE applet patterns
- Native bridge: `connBleByMacAddress`, `initServiceBleData`, `readBleCharacteristic`, `writeBleCharacteristic` in `src/app/utils.js`
- BLE GATT services: `ATT_SERVICE` (opid/ppid), `CMD_SERVICE` (pubk = code characteristic), `STS_SERVICE` (rcrd = remaining days)
- Two state copies: `serviceAttrList` (master, updated by bridge callbacks) and `attrList` (display copy passed to detail views). The `svcComplete` handler **must sync both** by calling `setAtrrList(updated)` inside the `setServiceAttrList` updater — see `KeypadApp.tsx` as the reference implementation
- After a BLE write, show a spinner immediately (`setIsRefreshing(true)`) then poll the changed characteristics directly via `readBleCharacteristic` at ~1s/2s/4s delays. Do NOT re-initiate full service scans. PAYGO tokens decode in milliseconds on the device after write ack.

## Design process (redesigns & new pages)
Any time we redesign an existing page or create a new original page, follow a mockup-first process — never jump straight to implementation:
1. **Diagnose/explore visually**: recreate the current layout (or sketch the new page) as an HTML mockup in the brainstorming visual companion (browser at a localhost URL), annotate problems, and have Dennis confirm which issues matter before designing.
2. **Research competitors**: check how comparable products (e.g., PAYGO/device-management apps like Angaza Hub, PaygOps, Bboxx Pulse) solve the same screen before finalizing UX decisions.
3. **Propose 2–3 layout options as mockups** in the visual companion, with trade-offs and a recommendation; Dennis picks/refines in the browser.
4. Only after a mockup is approved, write the spec and implement from it.
Mockups live in `.superpowers/brainstorm/` (gitignored); use the app's real theme tokens (`--accent`, `--bg-secondary`, etc.) so mockups look like the actual app.

## Code conventions
- TypeScript + React functional components with hooks
- i18n via `useI18n()` / `t()` — all user-facing strings go through translation
- Toast notifications via `react-hot-toast`
- Styles: CSS variables (`--color-*`, `--toast-*`, etc.); class names in `flow-header`, `attendant-container`, `login-*` etc.
- No comments unless explaining a non-obvious invariant or workaround

## Assembly & Fleets applets
- **Slugs**: `assembly-cell` → Assembly Cell (`src/app/(mobile)/assembly/`); `assets` → Fleets (`src/app/(mobile)/fleets/`). The `assets` slug also gates BLE Device Manager, so SAs with `assets` see both tiles.
- **API pattern**: `src/lib/assembly-api.ts` / `fleets-api.ts` follow the tickets-api pattern — caller passes `getSalesRoleToken()`, `buildOdooHeaders` resolves `X-SA-ID`. Not the products-api pattern.
- **Reference**: `ovesorg/odoo-portal-frontend` branch `service-portal` (`app/(portal)/portal/assembly/`, `app/(portal)/portal/fleets/`). ADRs in `ovesorg/dirac-odoo` (ADR 0007 Build Record, ADR 0008 Assembly-Cell).
- **Backend**: abs_connector REST (`/api/assembly/mos`, `/api/fleets`, `/api/stock/lots`). 503 = abs_connector build on that device is too old to know those routes.
- **Write paths** (Claim MO, create/deactivate fleet, add/remove serial) need a real-login on-device pass before trusting end-to-end.
- **Single-applet auto-nav**: When an SA's applet list is exactly `['assembly-cell']`, role-select skips the grid and navigates directly to `/assembly`. Any single-slug SA should behave the same.

## Rollup applet (`src/app/(mobile)/rollup/`)
- Dashboard shows backend-driven "stacks" (record categories). Each stack card's `onOpenApplet(type, label)` routes to an embedded sub-applet via `RollupApp.tsx`'s `renderContent()` switch.
- To add a new record type: (1) add icon entry to `STACK_CONFIG` in `RollupDashboard.tsx`; (2) create `Embedded*.tsx` wrapper in `components/`; (3) add `case 'type':` in `RollupApp.tsx` switch with a `dynamic()` import.
- Backend slug for tickets in Rollup is `ticket` (not `ticketing`). `RollupFileType` TS union does not need to be exhaustive — unknown types fall through to `RollupFileDetail`.
- SA scope is automatic: `setSAScopeOverride(currentSaId)` in `RollupApp.tsx` sets the drilled-into SA for all embedded applet requests.

## Rider map (`src/app/(mobile)/rider/app/map/`)
- Two backends behind a shared interface (`RiderMapTypes.ts`): **Google** (`RiderMapGoogle.tsx`) and **Leaflet/OSM** (`RiderMapLeaflet.tsx`).
- `RiderMap.tsx` is the thin switch: `isChina() ? <RiderMapLeaflet/> : <RiderMapGoogle/>` (both `dynamic ssr:false`). In China, `RiderMapProvider` is a passthrough — never mounts `<APIProvider>`.
- `isChina.ts` detects China via **device timezone** (`Asia/Shanghai`/`Asia/Urumqi` + `zh-CN`), SSR-safe. VPN-proof.
- `useRouting.ts` early-returns if `isChina()` so the blocked Google Routes API is never called.
- `gcj02.ts` + `deepLinks.ts`: external nav → Amap (GCJ-02) in China, Google Maps elsewhere. Called from `RiderApp.handleNavigateToStation`.
- Leaflet backend is Scope 1 (find/locate/deep-link out). No route polyline or follow-tilt in China.

## OTA firmware upgrade (wired end-to-end, pending on-device verification)
- **Firmware version**: characteristic `fwv` (fallback `fw`) in `ATT_SERVICE`; read via `.realVal` — already shown in `DeviceDetailView.tsx:948`
- **Cloud API** (federated GraphQL): `getSpecificItemFirmware`, `getFileObjectsForFirmwareVersion` (→ S3 `downloadUrl`), `getAllItemFirmwares`, `getDeviceGattByFirmware`; mutations: `createItemFirmware`, `updateItemFirmware`, `deleteItemFirmware`, `uploadItemFirmwaresDockerStandalone`
- **Native OTA SDK**: `oves-app/ota66_sdk2` is a Telink BLE OTA SDK. Entry point: `OTASDKUtils(context, cb).updateFirware(mac, filePath)` with `onProcess(float)` / `onUpdateComplete()` / `onError(code)` callbacks. Firmware file format is **Intel HEX**.
- **Native bridge** (oves-app branch `feat/ble-ota`): dep enabled in `app/build.gradle`; handlers `startOtaUpdate` {macAddress, fileName, base64} and `cancelOtaUpdate` in `BaseWebViewActivity`; events to web: `otaProgressCallBack` {macAddress, progress} / `otaErrorCallBack` {macAddress, code: ota66_sdk2 ErrorCode 1000-1009} / `otaCompleteCallBack`. Before the OTA SDK takes over, native stops scanning and fully releases the app GATT via `BleDeviceUtil.destroyAndClose()` (disconnect + close, unlike `destroy()`), then waits 800 ms.
- **Web side**: `src/lib/hooks/ble/useOtaUpdate.ts` (state machine idle→starting→transferring→rebooting→success/error), `src/lib/graphql/firmware.ts` (ops verified by schema introspection on the dev federated endpoint), `OtaUpdateModal.tsx` in the Device Manager — launched from `DeviceDetailView` technical mode (All Devices details). Firmware source: cloud version list → S3 `downloadUrl` fetch, or local `.hex`/`.hex16` file pick.
- **Constraint**: WebView cannot use `ftp://` URLs (Chrome dropped FTP in v95) — firmware must come from S3 presigned HTTPS URLs. Do not use the FTP server for firmware delivery.
- **Open question**: whether all `codeSystem` values (ACP1/ACP2/OPENTOKEN) map to Telink chips — if not, need additional vendor OTA SDKs.

## Payment flow conventions
- **WeChat/Z-Pay**: never re-confirm a Z-Pay `trade_no` via `confirmPaymentManual` — that is the LiPay/M-Pesa receipt endpoint and will fail or return `total_paid: 0`. Use `confirmWechatPayment(receipt, totalPaid)` from `usePaymentCollection.ts`, which trusts the widget amount and calls publish directly. Reference: `SalesFlow.tsx handleWechatPaid`.
- **Manual receipts** (M-Pesa / LiPay): use `confirmPayment(receipt)` which calls `confirmPaymentManual` — correct for mobile-money manual entry only.
- **Known unfixed**: `AttendantFlow.tsx handleWechatPaid` (swap flow) still calls `confirmPayment(tradeNo)` for WeChat — same latent bug as the rider top-up had; needs the same fix.

## Dev server
- `npm run dev` starts on port **3010** (not 3000). `package.json` name is `"bot-frontend"`. LAN: `http://192.168.100.29:3010`.
- Use Node (not PowerShell or Python) to diff i18n keys: `node -e "const en=require('./src/i18n/messages/en.json'),fr=require('./src/i18n/messages/fr.json');console.log(Object.keys(en).filter(k=>!(k in fr)))"` — PowerShell `ConvertFrom-Json` chokes on duplicate keys; inline Python `print()` of zh.json values fails with `UnicodeEncodeError` (Windows stdout = cp1252).
- **Glob/Grep on broad patterns times out**: `src/app/(mobile)/*` hits the 20s limit. Always scope to a specific subdirectory (e.g., `src/app/(mobile)/assembly/**`). To enumerate top-level applets, use `Bash ls -1 src/app/(mobile)/`.

## Testing / verification
- `npx tsc --noEmit` — type check before claiming a fix is complete
- `npx next lint` — lint check; pre-existing warnings are acceptable, new errors are not
- `npx next build` — production build verification for significant changes
