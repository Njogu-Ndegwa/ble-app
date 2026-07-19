"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * OTA firmware update over the native bridge (Telink ota66_sdk2 in oves-app).
 *
 * Web → native:
 *   startOtaUpdate  JSON {macAddress, fileName, base64}  → Result {respCode "200" on started}
 *   cancelOtaUpdate ""                                   → Result
 * Native → web (registered here):
 *   otaProgressCallBack {macAddress, progress: float 0-100}
 *   otaErrorCallBack    {macAddress, code: int}   (codes: ota66_sdk2 ErrorCode)
 *   otaCompleteCallBack {macAddress}
 *
 * The native side disconnects the app's GATT before the OTA SDK takes over, so
 * a bleConnectFailCallBack/disconnect event during an update is expected — the
 * caller must reconnect + reload services after success.
 */

export type OtaPhase =
  | "idle"
  | "starting" // bridge call sent, SDK connecting to device in OTA mode
  | "transferring" // progress events arriving
  | "rebooting" // transfer done (100%), waiting for device reboot confirmation
  | "success"
  | "error";

export interface OtaState {
  phase: OtaPhase;
  /** 0–100 transfer progress */
  progress: number;
  /** ota66_sdk2 ErrorCode when phase === 'error'; -1 for bridge/start failures */
  errorCode: number | null;
  /** raw error detail for bridge-level failures */
  errorDetail: string | null;
}

const IDLE_STATE: OtaState = {
  phase: "idle",
  progress: 0,
  errorCode: null,
  errorDetail: null,
};

/** ota66_sdk2 ErrorCode → i18n key (resolved by the caller via t()) */
export const OTA_ERROR_KEYS: Record<number, string> = {
  1000: "ble.ota.error.fileParse",
  1001: "ble.ota.error.connect",
  1002: "ble.ota.error.serviceNotFound",
  1003: "ble.ota.error.serviceNotFound",
  1004: "ble.ota.error.write",
  1005: "ble.ota.error.response",
  1006: "ble.ota.error.disconnected",
  1007: "ble.ota.error.notConnected",
  1008: "ble.ota.error.notInOtaMode",
  1009: "ble.ota.error.mtu",
};

const parseBridgeJson = (raw: unknown): any => {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};

export function useOtaUpdate(macAddress: string) {
  const [state, setState] = useState<OtaState>(IDLE_STATE);
  // The device MAC this hook instance is updating; events for other MACs are ignored.
  const macRef = useRef(macAddress);
  macRef.current = macAddress;
  const activeRef = useRef(false);

  useEffect(() => {
    const bridge = (window as any).WebViewJavascriptBridge;
    if (!bridge) return;

    const matchesDevice = (payload: any) => {
      const mac = String(payload?.macAddress ?? "");
      return (
        !mac || mac.toUpperCase() === String(macRef.current).toUpperCase()
      );
    };

    bridge.registerHandler("otaProgressCallBack", (data: string, resp: any) => {
      const payload = parseBridgeJson(data);
      if (activeRef.current && matchesDevice(payload)) {
        const progress = Math.min(100, Math.max(0, Number(payload?.progress) || 0));
        setState((prev) => ({
          ...prev,
          phase: progress >= 100 ? "rebooting" : "transferring",
          progress,
        }));
      }
      if (resp) resp("ok");
    });

    bridge.registerHandler("otaErrorCallBack", (data: string, resp: any) => {
      const payload = parseBridgeJson(data);
      if (activeRef.current && matchesDevice(payload)) {
        activeRef.current = false;
        setState((prev) => ({
          ...prev,
          phase: "error",
          errorCode: Number(payload?.code ?? -1),
          errorDetail: null,
        }));
      }
      if (resp) resp("ok");
    });

    bridge.registerHandler("otaCompleteCallBack", (data: string, resp: any) => {
      const payload = parseBridgeJson(data);
      if (activeRef.current && matchesDevice(payload)) {
        activeRef.current = false;
        setState((prev) => ({ ...prev, phase: "success", progress: 100 }));
      }
      if (resp) resp("ok");
    });

    return () => {
      // jsbridge has no unregister; make stale events no-ops instead.
      activeRef.current = false;
    };
  }, []);

  const startOta = useCallback((fileName: string, hexContent: string, secretKey?: string) => {
    const bridge = (window as any).WebViewJavascriptBridge;
    if (!bridge) {
      setState({
        phase: "error",
        progress: 0,
        errorCode: -1,
        errorDetail: "WebView bridge not available",
      });
      return;
    }
    // Intel HEX is plain ASCII, so btoa is safe here.
    let base64: string;
    try {
      base64 = btoa(hexContent);
    } catch {
      setState({
        phase: "error",
        progress: 0,
        errorCode: 1000,
        errorDetail: "Firmware file is not valid Intel HEX text",
      });
      return;
    }
    activeRef.current = true;
    setState({ phase: "starting", progress: 0, errorCode: null, errorDetail: null });
    bridge.callHandler(
      "startOtaUpdate",
      // secretKey drives the Telink secure-OTA key handshake; without it a
      // secure device ignores the OTA-start command and never enters OTA mode.
      // buildStamp: deploy-verification marker (native ignores it) — remove after cache issue resolved.
      JSON.stringify({ macAddress: macRef.current, fileName, base64, secretKey: secretKey ?? "", buildStamp: "OTABUILD-KX7Q9" }),
      (responseData: string) => {
        const parsed = parseBridgeJson(responseData);
        const respCode = parsed?.respCode ?? parsed?.responseData?.respCode;
        if (respCode && String(respCode) !== "200") {
          activeRef.current = false;
          setState({
            phase: "error",
            progress: 0,
            errorCode: -1,
            errorDetail: String(parsed?.respDesc ?? "Failed to start OTA"),
          });
        }
        // respCode 200 = SDK took over; keep 'starting' until progress arrives.
      }
    );
  }, []);

  const cancelOta = useCallback(() => {
    const bridge = (window as any).WebViewJavascriptBridge;
    activeRef.current = false;
    setState(IDLE_STATE);
    if (bridge) {
      bridge.callHandler("cancelOtaUpdate", "", () => {});
    }
  }, []);

  const reset = useCallback(() => {
    activeRef.current = false;
    setState(IDLE_STATE);
  }, []);

  return { state, startOta, cancelOta, reset };
}
