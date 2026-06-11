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

## Testing / verification
- `npx tsc --noEmit` — type check before claiming a fix is complete
- `npx next lint` — lint check; pre-existing warnings are acceptable, new errors are not
- `npx next build` — production build verification for significant changes
