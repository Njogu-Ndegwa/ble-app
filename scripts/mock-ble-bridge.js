/**
 * Dev-only mock of the Android WebViewJavascriptBridge.
 *
 * The BLE applets talk to the native Android shell via
 * `window.WebViewJavascriptBridge`, which does not exist in a desktop browser.
 * Paste this whole file into the browser DevTools console BEFORE navigating to
 * an applet (or paste it, then reload with the console still open) to simulate
 * a charger: fake advertisements, a connect handshake, a CMD service with
 * charge-control characteristics, and successful writes.
 *
 * It also seeds a test-company employee session so the Charger Control tile is
 * visible on the home grid.
 *
 * This file is NOT imported by the app — it is a manual dev utility only.
 */
(() => {
  // ---- 1. Seed a test-company session -----------------------------------
  localStorage.setItem('ov-employee-token', 'dev-mock-token');
  localStorage.setItem(
    'ov-employee-data',
    JSON.stringify({ id: 1, name: 'Local Tester', email: 'dev@example.com' })
  );
  localStorage.setItem(
    'ov-service-accounts',
    JSON.stringify([
      { id: 99, name: 'OVES Test Company', my_role: 'admin', applets: ['keypad', 'assets'] },
    ])
  );
  localStorage.setItem('ov_sa_applets_99', JSON.stringify(['keypad', 'assets']));
  localStorage.setItem('ov-selected-sa-id', '99');

  // ---- 2. Mock the native bridge ----------------------------------------
  const registry = {};
  let scanTimer = null;

  const fakeDevices = [
    { macAddress: 'C8:2E:18:11:22:33', name: 'OVES CHGR-3KW A1B2C3', rssi: '-48' },
    { macAddress: 'C8:2E:18:44:55:66', name: 'OVES CHGR-3KW D4E5F6', rssi: '-67' },
    { macAddress: 'C8:2E:18:77:88:99', name: 'OVES BT73 45GH01', rssi: '-74' },
  ];

  // Mirrors the battery GATT layout: same service enums, charger-specific
  // characteristic names. Swap these for the real ones once the charger GATT
  // table is available.
  const cmdService = {
    serviceNameEnum: 'CMD_SERVICE',
    uuid: '0000fff0-0000-1000-8000-00805f9b34fb',
    characteristicList: [
      { name: 'opid', uuid: '0000fff1-0000-1000-8000-00805f9b34fb', realVal: 'OP-000123' },
      { name: 'chgtmr', uuid: '0000fff2-0000-1000-8000-00805f9b34fb', realVal: 0 },
      { name: 'chgengy', uuid: '0000fff3-0000-1000-8000-00805f9b34fb', realVal: 0 },
      { name: 'outsw', uuid: '0000fff4-0000-1000-8000-00805f9b34fb', realVal: 1 },
      { name: 'rst', uuid: '0000fff5-0000-1000-8000-00805f9b34fb', realVal: 0 },
    ],
  };

  const fire = (name, payload) => {
    const handler = registry[name];
    if (handler) {
      handler(typeof payload === 'string' ? payload : JSON.stringify(payload), () => {});
    }
  };

  window.WebViewJavascriptBridge = {
    init(cb) {
      if (cb) cb({}, () => {});
    },
    registerHandler(name, fn) {
      registry[name] = fn;
    },
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
          if (scanTimer) {
            clearInterval(scanTimer);
            scanTimer = null;
          }
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
              fire('bleInitServiceDataOnCompleteCallBack', cmdService);
            }
          }, 220);
          if (cb) cb('');
          break;
        }

        case 'writeBleCharacteristic':
          console.info('[mock-ble] write', data);
          setTimeout(() => {
            if (cb) cb(JSON.stringify({ respCode: '200', respData: true }));
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

  document.dispatchEvent(new Event('WebViewJavascriptBridgeReady'));
  console.info('[mock-ble] bridge installed + test-company session seeded. Go to /charger');
})();
