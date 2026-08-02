/**
 * Dev-only harness for testing the Charger Control applet in a desktop browser.
 *
 * Two things are missing outside the Android shell, and this file fakes both:
 *
 *   1. `window.WebViewJavascriptBridge` — the native BLE bridge. Simulated here
 *      as a charger that advertises, connects, exposes a CMD service, and
 *      acknowledges writes.
 *   2. The backends. Charger Control now bills a subscription plan before it
 *      dispenses, so the flow also talks to ABS GraphQL (identify / plan
 *      template / serviceTopup) and Odoo REST (subscription status, plan
 *      catalog). Those are intercepted at `fetch`.
 *
 * USAGE — the bridge lives on `window`, so a page load wipes it. Paste this
 * file into the DevTools console ONCE to seed the session, then again on
 * /charger after the app has loaded. (Pasting once and reloading does NOT
 * work: the reload destroys the bridge you just installed.)
 *
 *   MOCK.failWrite()   — make the next BLE write fail (billed-but-not-dispensed)
 *   MOCK.failBilling() — make the next serviceTopup be rejected
 *   MOCK.ambiguous()   — advertise a charger whose GATT names collide
 *   MOCK.reset()       — back to the all-happy-path defaults
 *
 * This file is NOT imported by the app — it is a manual dev utility only.
 */
(() => {
  // ---- 0. Tunable failure switches --------------------------------------
  const state = {
    failWrite: false,
    failBilling: false,
    ambiguousGatt: false,
  };

  const SUB_CODE = 'SUB-8847-KE';
  const ENERGY_SERVICE_ID = 'service-energy-access-001';
  const TEMPLATE_ID = 'B30-STANDARD';

  // ---- 1. Seed a test-company staff session -----------------------------
  // The applet now requires a signed-in sales-role employee (for the Odoo plan
  // catalog) and a selected Service Account whose name matches /test/i so the
  // testCompanyOnly tile is visible.
  //
  // The token must be a structurally valid JWT with a future `exp`: the auth
  // layer decodes it and clears the session outright if there is no exp claim.
  const b64url = (obj) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const exp = Math.floor(Date.now() / 1000) + 12 * 60 * 60;
  const token = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: '1', name: 'Local Tester', exp })}.mocksig`;
  const expiresAt = new Date(exp * 1000).toISOString();

  const employee = {
    id: 1, name: 'Local Tester', email: 'dev@example.com',
    phone: '', userType: 'sales', accessToken: token, tokenExpiresAt: expiresAt,
  };

  // ov-auth (drives the role grid + the testCompanyOnly tile)
  localStorage.setItem('ov-employee-token', token);
  localStorage.setItem('ov-employee-data', JSON.stringify(employee));
  localStorage.setItem('ov-employee-token-expires', expiresAt);

  // attendant-auth, "sales" role (drives the applet's own sign-in gate)
  localStorage.setItem('oves-sales-data', JSON.stringify(employee));
  localStorage.setItem('oves-sales-token', token);
  localStorage.setItem('oves-sales-token-expires', expiresAt);
  localStorage.setItem('oves-sales-email', employee.email);

  const testSA = { id: 99, name: 'OVES Test Company', my_role: 'admin', applets: ['keypad', 'assets'] };
  localStorage.setItem('ov-service-accounts', JSON.stringify([testSA]));
  localStorage.setItem('ov_sa_applets_99', JSON.stringify(['keypad', 'assets']));
  localStorage.setItem('ov-selected-sa-id', '99');

  // sa-auth, "sales" scope (drives the select-SA screen)
  localStorage.setItem('oves-sales-sa-id', '99');
  localStorage.setItem('oves-sales-sa-data', JSON.stringify(testSA));

  // ---- 2. Mock the native BLE bridge ------------------------------------
  const registry = {};
  let scanTimer = null;

  const fakeDevices = [
    { macAddress: 'C8:2E:18:11:22:33', name: 'OVES CHGR-3KW A1B2C3', rssi: '-48' },
    { macAddress: 'C8:2E:18:44:55:66', name: 'OVES CHGR-3KW D4E5F6', rssi: '-67' },
  ];

  // Mirrors the battery GATT layout: same service enums, charger-specific
  // characteristic names. Swap these for the real ones once the charger GATT
  // table is available.
  const cleanCharacteristics = [
    { name: 'opid', uuid: '0000fff1-0000-1000-8000-00805f9b34fb', realVal: 'OP-000123' },
    { name: 'chgtmr', uuid: '0000fff2-0000-1000-8000-00805f9b34fb', realVal: 0 },
    { name: 'chgengy', uuid: '0000fff3-0000-1000-8000-00805f9b34fb', realVal: 0 },
    { name: 'outsw', uuid: '0000fff4-0000-1000-8000-00805f9b34fb', realVal: 1 },
    { name: 'rst', uuid: '0000fff5-0000-1000-8000-00805f9b34fb', realVal: 0 },
  ];

  // A plausible firmware layout where a limit register ALSO matches the
  // provisional name heuristics. Use MOCK.ambiguous() to check the applet
  // refuses to auto-pick and makes the operator choose.
  const ambiguousCharacteristics = [
    { name: 'vminlim', uuid: '0000fffa-0000-1000-8000-00805f9b34fb', realVal: 48 },
    { name: 'pwrcap', uuid: '0000fffb-0000-1000-8000-00805f9b34fb', realVal: 3000 },
    ...cleanCharacteristics,
  ];

  const cmdService = () => ({
    serviceNameEnum: 'CMD_SERVICE',
    uuid: '0000fff0-0000-1000-8000-00805f9b34fb',
    characteristicList: state.ambiguousGatt ? ambiguousCharacteristics : cleanCharacteristics,
  });

  const fire = (name, payload) => {
    const handler = registry[name];
    if (handler) {
      handler(typeof payload === 'string' ? payload : JSON.stringify(payload), () => {});
    }
  };

  window.__mockWrites = [];
  window.__mockTopups = [];

  window.WebViewJavascriptBridge = {
    init(cb) { if (cb) cb({}, () => {}); },
    registerHandler(name, fn) { registry[name] = fn; },
    callHandler(name, data, cb) {
      switch (name) {
        case 'startBleScan':
          if (scanTimer) clearInterval(scanTimer);
          scanTimer = setInterval(() => {
            fakeDevices.forEach((d) =>
              fire('findBleDeviceCallBack', {
                ...d,
                rssi: String(Number(d.rssi) + Math.round(Math.random() * 4 - 2)),
              })
            );
          }, 350);
          if (cb) cb('');
          break;

        case 'stopBleScan':
          if (scanTimer) { clearInterval(scanTimer); scanTimer = null; }
          if (cb) cb('');
          break;

        case 'connBleByMacAddress': {
          const mac = typeof data === 'string' ? data : data.macAddress;
          setTimeout(() => {
            const handler = registry['bleConnectSuccessCallBack'];
            if (handler) handler(mac, () => {});
          }, 900);
          if (cb) cb('');
          break;
        }

        case 'initServiceBleData': {
          let progress = 0;
          const timer = setInterval(() => {
            progress += 25;
            fire('bleInitServiceDataOnProgressCallBack', { progress, total: 100 });
            if (progress >= 100) {
              clearInterval(timer);
              fire('bleInitServiceDataOnCompleteCallBack', cmdService());
            }
          }, 220);
          if (cb) cb('');
          break;
        }

        case 'writeBleCharacteristic':
          window.__mockWrites.push(data);
          console.info('[mock-ble] write', data);
          setTimeout(() => {
            if (!cb) return;
            if (state.failWrite) {
              state.failWrite = false;
              cb(JSON.stringify({ respCode: '11', respDesc: 'device busy' }));
            } else {
              cb(JSON.stringify({ respCode: '200', respData: true }));
            }
          }, 600);
          break;

        case 'disconnBleByMacAddress':
        case 'disconnectBle':
          if (cb) cb(JSON.stringify({ respCode: '200', respData: true }));
          break;

        default:
          if (cb) cb(JSON.stringify({ respCode: '200' }));
      }
    },
  };

  // ---- 3. Mock the backends ---------------------------------------------
  const json = (body) => new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

  const identifyMetadata = {
    customer_id: 'customer-303025',
    identification_method: 'manual',
    correlation_id: 'mock-correlation',
    service_plan_data: {
      servicePlanId: SUB_CODE,
      customerId: 'customer-303025',
      status: 'active',
      serviceState: 'BATTERY_ISSUED',
      paymentState: 'CURRENT',
      templateId: TEMPLATE_ID,
      templateVersion: '1',
      currency: 'KES',
      quotaUsed: 12,
      quotaLimit: 30,
      serviceStates: [
        { service_id: ENERGY_SERVICE_ID, used: 12, quota: 30, current_asset: null },
        { service_id: 'service-asset-assignment-access-001', used: 0, quota: 1, current_asset: 'BIKE-0042' },
      ],
    },
    service_bundle: {
      bundleId: 'bundle-1', name: 'Standard', description: '', version: '1', status: 'active',
      services: [{
        serviceId: ENERGY_SERVICE_ID, name: 'Energy', assetType: 'battery',
        usageMetric: 'kwh', usageUnit: 'kWh', usageUnitPrice: 25,
      }],
    },
    common_terms: {
      termsId: 'terms-1', serviceName: 'Standard', serviceDurationDays: 30,
      billingCycle: 'monthly', billingCurrency: 'KES', monthlyFee: 1500, depositAmount: 0,
      monthlyQuota: 30, cancellationNoticeDays: 0, earlyTerminationFee: 0, refundPolicy: '',
      liabilityLimit: 0, insuranceRequired: false, damageDeposit: 0, governingLaw: 'KE',
      disputeResolution: '',
    },
  };

  // Each plan carries its OWN service-plan template — that is what makes the
  // per-plan quota lookup meaningful. (Plans sharing one template id would all
  // resolve to the same kWh, which is worth knowing if the real catalog does
  // that.) Names stay B30-prefixed so the package→plan filter still matches.
  const plans = [
    { id: 4101, name: 'B30 Energy 1kWh', default_code: 'B30-1', list_price: 120, x_template_id: 'B30-1KWH', description: 'Top-up 1 kWh' },
    { id: 4102, name: 'B30 Energy 3kWh', default_code: 'B30-3', list_price: 330, x_template_id: 'B30-3KWH', description: 'Top-up 3 kWh' },
    { id: 4103, name: 'B30 Energy 5kWh', default_code: 'B30-5', list_price: 520, x_template_id: 'B30-5KWH', description: 'Top-up 5 kWh' },
  ];
  const templateKwh = { 'B30-1KWH': 1, 'B30-3KWH': 3, 'B30-5KWH': 5 };
  const templateKwhFor = (lookupId) => {
    if (templateKwh[lookupId] != null) return templateKwh[lookupId];
    const byName = plans.find((p) => p.name === lookupId);
    return byName ? templateKwh[byName.x_template_id] : 3;
  };

  let quotaRemaining = 18; // 30 quota - 12 used

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : (input && input.url) || '';

    // ---- ABS GraphQL ----
    if (url.includes('abs-platform') || url.includes('federated-graphql-api')) {
      let body = {};
      try { body = JSON.parse((init && init.body) || '{}'); } catch { /* ignore */ }
      const op = body.operationName || '';
      const vars = body.variables || {};

      if (op === 'IdentifyCustomer') {
        return json({
          data: {
            identifyCustomer: {
              customer_identified: true,
              identification_method: 'manual',
              signals: ['CUSTOMER_IDENTIFIED_SUCCESS'],
              metadata: JSON.stringify(identifyMetadata),
            },
          },
        });
      }

      if (op === 'ServicePlanTemplate') {
        window.__mockLastPlanLookup = vars.id;
        return json({
          data: {
            servicePlanTemplate: {
              templateId: TEMPLATE_ID,
              name: String(vars.id || TEMPLATE_ID),
              billingCurrency: 'KES',
              serviceConfigurations: [{
                serviceId: ENERGY_SERVICE_ID,
                initialQuota: templateKwhFor(vars.id),
                maxQuota: 100, rateLimitPerDay: 0, autoRenewal: false,
                overageAllowed: false, overageRate: null,
              }],
            },
          },
        });
      }

      if (op === 'ServiceTopup') {
        const input = vars.input || {};
        window.__mockTopups.push(input);
        console.info('[mock-abs] serviceTopup', input);
        if (state.failBilling) {
          state.failBilling = false;
          return json({
            data: {
              serviceTopup: {
                service_id: ENERGY_SERVICE_ID,
                additional_quota: 0,
                quota_before: quotaRemaining,
                quota_after: quotaRemaining,
                quota_calculation: 'rejected',
                signals: ['PAYMENT_REJECTED'],
                metadata: JSON.stringify({ reason: 'Mock rejection: insufficient funds' }),
              },
            },
          });
        }
        const credited = Math.round((input.payment_amount / input.unit_price) * 10000) / 10000;
        const before = quotaRemaining;
        quotaRemaining = Math.round((quotaRemaining + credited) * 100) / 100;
        return json({
          data: {
            serviceTopup: {
              service_id: ENERGY_SERVICE_ID,
              additional_quota: credited,
              quota_before: before,
              quota_after: quotaRemaining,
              quota_calculation: `${input.payment_amount} / ${input.unit_price}`,
              signals: ['SERVICE_QUOTA_UPDATED'],
              metadata: '{}',
            },
          },
        });
      }

      return json({ data: {} });
    }

    // ---- Odoo REST ----
    if (url.includes('odoo.com')) {
      if (url.includes('/api/subscription/status/')) {
        return json({
          success: true,
          data: { subscription: { product_name: 'B30 Standard', status: 'active', code: SUB_CODE } },
        });
      }
      if (url.includes('/api/products/subscription')) {
        // Odoo returns the catalog split by category; getSubscriptionProducts
        // reads `categories.service` as the subscription plan list.
        return json({
          success: true,
          categories: { physical: [], service: plans, contract: [] },
          pagination: { current_page: 1, per_page: 50, total_records: plans.length, total_pages: 1 },
        });
      }
      if (url.includes('/dashboard')) {
        return json({ success: true, customer: { id: 303025, name: 'Mock Rider' } });
      }
      if (url.includes('/api/me/service-accounts') || url.includes('service-accounts')) {
        return json({ service_accounts: [testSA], auto_selected: true });
      }
      return json({ success: true, data: {} });
    }

    // ---- Service-account lookup (whatever host it lives on) ----
    if (url.includes('service-accounts')) {
      return json({ service_accounts: [testSA], auto_selected: true });
    }

    return originalFetch(input, init);
  };

  // ---- 4. Console controls ----------------------------------------------
  window.MOCK = {
    failWrite() { state.failWrite = true; console.info('[mock] next BLE write will FAIL'); },
    failBilling() { state.failBilling = true; console.info('[mock] next serviceTopup will be REJECTED'); },
    ambiguous() { state.ambiguousGatt = true; console.info('[mock] charger will expose colliding characteristic names'); },
    reset() {
      state.failWrite = false; state.failBilling = false; state.ambiguousGatt = false;
      console.info('[mock] back to happy-path defaults');
    },
    get state() { return { ...state, quotaRemaining }; },
    writes: () => window.__mockWrites,
    topups: () => window.__mockTopups,
  };

  document.dispatchEvent(new Event('WebViewJavascriptBridgeReady'));
  console.info(
    `[mock] bridge + backends installed. Subscription: ${SUB_CODE}. `
    + 'Go to /charger. Controls: MOCK.failWrite() / MOCK.failBilling() / MOCK.ambiguous() / MOCK.reset()'
  );
})();
