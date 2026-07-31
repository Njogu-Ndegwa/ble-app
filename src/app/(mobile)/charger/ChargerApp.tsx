"use client";

/**
 * Charger Control — MVP applet.
 *
 * Connects to a fixed BLE charger device and writes a numeric value to one of
 * two characteristics to start a charging session:
 *   • Time mode   → write N  → charger charges the vehicle for N minutes
 *   • Energy mode → write N  → charger delivers N kWh
 *
 * The charger firmware exposes the same GATT service structure as the
 * batteries (ATT/CMD/STS/DTA/DIA) but with different characteristic fields.
 * Until the official GATT table is shared, the target characteristics are
 * auto-matched by name heuristics with a manual override picker, so the MVP
 * can be tested against real charger firmware without a code change.
 *
 * Out of scope for this MVP (planned follow-ups): billing, subscription-plan
 * checks, and backend session recording.
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Toaster, toast } from "react-hot-toast";
import {
  BatteryCharging,
  Bluetooth,
  Clock,
  Loader2,
  RefreshCw,
  Zap,
} from "lucide-react";

import {
  connBleByMacAddress,
  disconnBleByMacAddress,
  initServiceBleData,
  writeBleCharacteristic,
} from "../../utils";
import { useBridge } from "@/app/context/bridgeContext";
import { useI18n } from "@/i18n";

const EMA_ALPHA = 0.3;
const CONNECT_TIMEOUT_MS = 30_000;

/**
 * Only devices whose advertised name contains this string are listed.
 * TODO: narrow to the charger's real name prefix once hardware is available.
 */
const DEVICE_NAME_FILTER = "OVES";

/** Service holding the charge-control characteristics (per Esther: same
 *  ATT/CMD/STS/DTA/DIA structure as batteries — control lives in CMD). */
const CONTROL_SERVICE = "CMD";

/** Name heuristics used to auto-match the write targets until the official
 *  charger GATT table is provided. */
const TIME_CHAR_PATTERN = /time|tmr|dur|min/i;
const ENERGY_CHAR_PATTERN = /engy|energy|kwh|elec|pwr/i;

type ChargeMode = "time" | "energy";

interface ChargerDevice {
  macAddress: string;
  name: string;
  rawRssi: number;
  smoothedRssi: number;
}

interface GattCharacteristic {
  name: string;
  uuid: string;
  realVal?: unknown;
}

interface GattService {
  serviceNameEnum?: string;
  uuid: string;
  characteristicList?: GattCharacteristic[];
}

const MODE_PRESETS: Record<ChargeMode, number[]> = {
  time: [10, 30, 60],
  energy: [1, 3, 5],
};

const ChargerApp: React.FC = () => {
  const { t } = useI18n();
  const { bridge } = useBridge();

  const [devices, setDevices] = useState<ChargerDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [connectingMac, setConnectingMac] = useState<string | null>(null);
  const [connectedMac, setConnectedMac] = useState<string | null>(null);
  const [serviceProgress, setServiceProgress] = useState(0);
  const [controlService, setControlService] = useState<GattService | null>(null);

  const [mode, setMode] = useState<ChargeMode>("time");
  const [amount, setAmount] = useState<string>("");
  const [isWriting, setIsWriting] = useState(false);
  const [lastCommand, setLastCommand] = useState<{
    mode: ChargeMode;
    value: number;
    charName: string;
    at: number;
  } | null>(null);
  // Manual characteristic override (uuid) per mode, when auto-match is wrong.
  const [charOverride, setCharOverride] = useState<Partial<Record<ChargeMode, string>>>({});

  const devicesRef = useRef<ChargerDevice[]>([]);
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectedMacRef = useRef<string | null>(null);

  useEffect(() => {
    connectedMacRef.current = connectedMac;
  }, [connectedMac]);

  const flushDeviceBatch = useCallback(() => {
    batchTimerRef.current = null;
    setDevices(devicesRef.current);
  }, []);

  const scheduleDeviceBatch = useCallback(() => {
    if (!batchTimerRef.current) {
      batchTimerRef.current = setTimeout(flushDeviceBatch, 300);
    }
  }, [flushDeviceBatch]);

  const connectedDevice = connectedMac
    ? devices.find((d) => d.macAddress === connectedMac)
    : undefined;

  const characteristics: GattCharacteristic[] =
    controlService?.characteristicList ?? [];

  const autoMatch = useCallback(
    (m: ChargeMode): GattCharacteristic | undefined => {
      const pattern = m === "time" ? TIME_CHAR_PATTERN : ENERGY_CHAR_PATTERN;
      return characteristics.find((c) => pattern.test(c.name));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [controlService]
  );

  const activeCharacteristic: GattCharacteristic | undefined = (() => {
    const overrideUuid = charOverride[mode];
    if (overrideUuid) {
      const c = characteristics.find((ch) => ch.uuid === overrideUuid);
      if (c) return c;
    }
    return autoMatch(mode);
  })();

  // ---------------------------------------------------------------
  // Bridge wiring
  // ---------------------------------------------------------------
  const setupBridge = useCallback(
    (b: NonNullable<ReturnType<typeof useBridge>["bridge"]>) => {
      const noop = () => {};
      const reg = (name: string, handler: any) => {
        b.registerHandler(name, handler);
        return () => b.registerHandler(name, noop);
      };

      const offFind = reg(
        "findBleDeviceCallBack",
        (data: string, resp: (r: { success: boolean; error?: string }) => void) => {
          try {
            const d = JSON.parse(data);
            if (
              d.macAddress &&
              d.name &&
              d.rssi != null &&
              String(d.name).includes(DEVICE_NAME_FILTER)
            ) {
              const mac = String(d.macAddress).trim().toUpperCase();
              const raw = Number(d.rssi);
              const prev = devicesRef.current;
              const existing = prev.find((p) => p.macAddress === mac);
              const smoothedRssi = existing
                ? EMA_ALPHA * raw + (1 - EMA_ALPHA) * existing.smoothedRssi
                : raw;
              const next = existing
                ? prev.map((p) =>
                    p.macAddress === mac ? { ...p, rawRssi: raw, smoothedRssi } : p
                  )
                : [...prev, { macAddress: mac, name: d.name, rawRssi: raw, smoothedRssi }];
              devicesRef.current = [...next].sort(
                (a, z) => z.smoothedRssi - a.smoothedRssi
              );
              scheduleDeviceBatch();
              resp({ success: true });
            } else {
              resp({ success: false, error: "filtered" });
            }
          } catch (err: any) {
            resp({ success: false, error: err?.message });
          }
        }
      );

      const offConnectFail = reg("bleConnectFailCallBack", (data: string, resp: any) => {
        if (connectTimeoutRef.current) {
          clearTimeout(connectTimeoutRef.current);
          connectTimeoutRef.current = null;
        }
        setConnectingMac(null);
        toast.error(t("Connection failed! Please try reconnecting again."), {
          id: "charger-connect",
        });
        resp(data);
      });

      const offConnectSuccess = reg(
        "bleConnectSuccessCallBack",
        (macAddress: string, resp: any) => {
          if (connectTimeoutRef.current) {
            clearTimeout(connectTimeoutRef.current);
            connectTimeoutRef.current = null;
          }
          const mac = macAddress.trim().toUpperCase();
          sessionStorage.setItem("connectedDeviceMac", mac);
          setConnectedMac(mac);
          setIsScanning(false);
          setServiceProgress(0);
          initServiceBleData({ serviceName: CONTROL_SERVICE, macAddress: mac });
          resp(macAddress);
        }
      );

      const offSvcProgress = reg(
        "bleInitServiceDataOnProgressCallBack",
        (data: string) => {
          try {
            const p = JSON.parse(data);
            setServiceProgress(Math.round((p.progress / p.total) * 100));
          } catch {
            /* ignore */
          }
        }
      );

      const offSvcComplete = reg(
        "bleInitServiceDataOnCompleteCallBack",
        (data: string, resp: any) => {
          try {
            const parsed: GattService = JSON.parse(data);
            setControlService(parsed);
            setConnectingMac(null);
            setServiceProgress(100);
          } catch {
            toast.error(t("Failed to load charger data"));
          }
          resp(data);
        }
      );

      const offSvcFail = reg("bleInitServiceDataFailureCallBack", (data: string, resp: any) => {
        setConnectingMac(null);
        toast.error(t("Failed to load charger data"));
        resp(data);
      });

      return () => {
        offFind();
        offConnectFail();
        offConnectSuccess();
        offSvcProgress();
        offSvcComplete();
        offSvcFail();
        if (batchTimerRef.current) {
          clearTimeout(batchTimerRef.current);
          batchTimerRef.current = null;
        }
        if (connectedMacRef.current) {
          b.callHandler("disconnectBle", connectedMacRef.current, () => {});
        }
        b.callHandler("stopBleScan", "", () => {});
      };
    },
    [scheduleDeviceBatch, t]
  );

  useEffect(() => {
    if (!bridge) return;
    const cleanup = setupBridge(bridge);
    return cleanup;
  }, [bridge, setupBridge]);

  // Auto-start scanning once the bridge is ready (same pattern as Keypad —
  // handlers are registered in the effect above, which runs first).
  useEffect(() => {
    if (!bridge || connectedMac) return;
    const id = setTimeout(() => startBleScan(), 300);
    return () => {
      clearTimeout(id);
      stopBleScan();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge, connectedMac]);

  const startBleScan = () => {
    if (!window.WebViewJavascriptBridge) return;
    devicesRef.current = [];
    setDevices([]);
    window.WebViewJavascriptBridge.callHandler("startBleScan", "", () => {});
    setIsScanning(true);
  };

  const stopBleScan = () => {
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
      batchTimerRef.current = null;
      flushDeviceBatch();
    }
    if (window.WebViewJavascriptBridge) {
      window.WebViewJavascriptBridge.callHandler("stopBleScan", "", () => {});
    }
    setIsScanning(false);
  };

  const connectToCharger = (mac: string) => {
    if (connectingMac) return;
    stopBleScan();
    setConnectingMac(mac);
    connBleByMacAddress(mac);
    if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
    connectTimeoutRef.current = setTimeout(() => {
      connectTimeoutRef.current = null;
      setConnectingMac(null);
      toast.error(t("Connection timed out. Please try again."), {
        id: "charger-connect",
      });
    }, CONNECT_TIMEOUT_MS);
  };

  const disconnect = () => {
    const mac = connectedMacRef.current;
    if (mac) {
      disconnBleByMacAddress(mac, () => {});
    }
    sessionStorage.removeItem("connectedDeviceMac");
    setConnectedMac(null);
    setControlService(null);
    setLastCommand(null);
    setAmount("");
    setServiceProgress(0);
  };

  // ---------------------------------------------------------------
  // Write flow
  // ---------------------------------------------------------------
  const parseWriteResponse = (responseData: any): { ok: boolean; error?: string } => {
    try {
      let response: any = responseData;
      if (typeof responseData === "string") {
        try {
          response = JSON.parse(responseData);
        } catch {
          const s = responseData.toLowerCase();
          return s === "success" || s === "ok"
            ? { ok: true }
            : { ok: false, error: responseData };
        }
      }
      if (response?.respCode === "200" || response?.respCode === 200) return { ok: true };
      if (response?.respData === true || response?.respData === "success") return { ok: true };
      if (response?.success === true) return { ok: true };
      return {
        ok: false,
        error: response?.respDesc || response?.error || response?.message || undefined,
      };
    } catch {
      return { ok: false, error: "Unknown write response format" };
    }
  };

  const startCharging = () => {
    const value = Number(amount);
    if (!amount || Number.isNaN(value) || value <= 0) {
      toast.error(t("Enter a valid amount first"));
      return;
    }
    if (!controlService || !activeCharacteristic) {
      toast.error(t("No target characteristic — pick one from the list below"));
      return;
    }
    const mac = sessionStorage.getItem("connectedDeviceMac")?.trim();
    if (!mac) {
      toast.error(t("Device not connected. Please reconnect and try again."));
      return;
    }

    setIsWriting(true);
    writeBleCharacteristic(
      controlService.uuid,
      activeCharacteristic.uuid,
      value,
      mac,
      (responseData: any) => {
        setIsWriting(false);
        const { ok, error } = parseWriteResponse(responseData);
        if (ok) {
          setLastCommand({
            mode,
            value,
            charName: activeCharacteristic.name,
            at: Date.now(),
          });
          toast.success(
            mode === "time"
              ? t("Charging started: {n} minutes", { n: String(value) })
              : t("Charging started: {n} kWh", { n: String(value) })
          );
          setAmount("");
        } else {
          toast.error(error || t("Write failed. Please try again."));
        }
      }
    );
  };

  // ---------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------
  const isLoadingService =
    !!connectedMac && !controlService && serviceProgress < 100;

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", paddingBottom: 32 }}>
      <Toaster position="top-center" />

      {/* Title + MVP badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <BatteryCharging size={22} style={{ color: "var(--accent-primary, #22c55e)" }} />
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>
          {t("Charger Control")}
        </h1>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.5,
            padding: "2px 8px",
            borderRadius: 999,
            background: "rgba(234,179,8,0.15)",
            color: "#eab308",
            border: "1px solid rgba(234,179,8,0.4)",
          }}
        >
          MVP
        </span>
      </div>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
        {t("Connect to a charger, then set charging time or energy.")}
      </p>

      {!connectedMac ? (
        <>
          {/* ---------------- Scan screen ---------------- */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Bluetooth size={16} style={{ color: "var(--text-muted)" }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                {t("Nearby chargers")}
              </span>
              {isScanning && (
                <Loader2 size={14} className="animate-spin" style={{ color: "var(--text-muted)" }} />
              )}
            </div>
            <button
              className="btn btn-secondary"
              style={{ padding: "6px 12px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
              onClick={() => (isScanning ? stopBleScan() : startBleScan())}
            >
              <RefreshCw size={13} />
              {isScanning ? t("Stop") : t("Scan")}
            </button>
          </div>

          {devices.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "48px 24px",
                border: "1px dashed var(--border-primary, #333)",
                borderRadius: 12,
                color: "var(--text-muted)",
                fontSize: 14,
              }}
            >
              {isScanning
                ? t("Searching for chargers…")
                : t("No devices found. Tap Scan to search.")}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {devices.map((d) => {
                const isThisConnecting = connectingMac === d.macAddress;
                return (
                  <button
                    key={d.macAddress}
                    onClick={() => connectToCharger(d.macAddress)}
                    disabled={!!connectingMac}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "14px 16px",
                      borderRadius: 12,
                      border: "1px solid var(--border-primary, #333)",
                      background: "var(--bg-secondary, rgba(255,255,255,0.03))",
                      textAlign: "left",
                      opacity: connectingMac && !isThisConnecting ? 0.5 : 1,
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "rgba(34,197,94,0.12)",
                      }}
                    >
                      <BatteryCharging size={20} style={{ color: "#22c55e" }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: "var(--text-primary)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {d.name}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {d.macAddress} · {Math.round(d.smoothedRssi)}dB
                      </div>
                    </div>
                    {isThisConnecting ? (
                      <Loader2 size={18} className="animate-spin" style={{ color: "var(--text-muted)" }} />
                    ) : (
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#22c55e" }}>
                        {t("Connect")}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </>
      ) : isLoadingService ? (
        /* ---------------- Loading service data ---------------- */
        <div style={{ textAlign: "center", padding: "48px 24px" }}>
          <Loader2
            size={28}
            className="animate-spin"
            style={{ color: "var(--text-muted)", margin: "0 auto 16px" }}
          />
          <div style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 600 }}>
            {t("Reading charger data…")}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            {serviceProgress}%
          </div>
        </div>
      ) : (
        <>
          {/* ---------------- Control screen ---------------- */}
          {/* Connected device card */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 16px",
              borderRadius: 12,
              border: "1px solid rgba(34,197,94,0.35)",
              background: "rgba(34,197,94,0.08)",
              marginBottom: 16,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(34,197,94,0.15)",
              }}
            >
              <BatteryCharging size={20} style={{ color: "#22c55e" }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                {connectedDevice?.name || t("Charger")}
              </div>
              <div style={{ fontSize: 12, color: "#22c55e" }}>
                {t("Connected")} · {connectedMac}
              </div>
            </div>
            <button
              className="btn btn-secondary"
              style={{ padding: "6px 12px", fontSize: 12 }}
              onClick={disconnect}
            >
              {t("Disconnect")}
            </button>
          </div>

          {/* Mode selector */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            {(
              [
                { id: "time" as ChargeMode, icon: <Clock size={18} />, label: t("By Time"), unit: t("minutes") },
                { id: "energy" as ChargeMode, icon: <Zap size={18} />, label: t("By Energy"), unit: "kWh" },
              ]
            ).map((m) => {
              const active = mode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    setMode(m.id);
                    setAmount("");
                  }}
                  style={{
                    padding: "14px 12px",
                    borderRadius: 12,
                    border: active
                      ? "1.5px solid #22c55e"
                      : "1px solid var(--border-primary, #333)",
                    background: active
                      ? "rgba(34,197,94,0.1)"
                      : "var(--bg-secondary, rgba(255,255,255,0.03))",
                    color: active ? "#22c55e" : "var(--text-primary)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {m.icon}
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{m.label}</span>
                  <span style={{ fontSize: 11, opacity: 0.7 }}>{m.unit}</span>
                </button>
              );
            })}
          </div>

          {/* Amount input + presets */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text-primary)",
                marginBottom: 8,
              }}
            >
              {mode === "time" ? t("Charging time (minutes)") : t("Energy to deliver (kWh)")}
            </label>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={mode === "time" ? "10" : "3"}
              style={{
                width: "100%",
                padding: "14px 16px",
                fontSize: 18,
                fontWeight: 600,
                borderRadius: 12,
                border: "1px solid var(--border-primary, #333)",
                background: "var(--bg-secondary, rgba(255,255,255,0.03))",
                color: "var(--text-primary)",
                outline: "none",
              }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              {MODE_PRESETS[mode].map((p) => (
                <button
                  key={p}
                  onClick={() => setAmount(String(p))}
                  style={{
                    flex: 1,
                    padding: "8px 0",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    border: "1px solid var(--border-primary, #333)",
                    background:
                      amount === String(p)
                        ? "rgba(34,197,94,0.15)"
                        : "var(--bg-secondary, rgba(255,255,255,0.03))",
                    color: amount === String(p) ? "#22c55e" : "var(--text-primary)",
                  }}
                >
                  {p} {mode === "time" ? t("min") : "kWh"}
                </button>
              ))}
            </div>
          </div>

          {/* Target characteristic (auto-matched, overridable) */}
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: "block",
                fontSize: 12,
                color: "var(--text-muted)",
                marginBottom: 6,
              }}
            >
              {t("Target characteristic")}{" "}
              {activeCharacteristic && !charOverride[mode] && (
                <span style={{ color: "#22c55e" }}>({t("auto-matched")})</span>
              )}
            </label>
            <select
              value={activeCharacteristic?.uuid ?? ""}
              onChange={(e) =>
                setCharOverride((prev) => ({ ...prev, [mode]: e.target.value }))
              }
              style={{
                width: "100%",
                padding: "10px 12px",
                fontSize: 13,
                borderRadius: 10,
                border: "1px solid var(--border-primary, #333)",
                background: "var(--bg-secondary, rgba(255,255,255,0.03))",
                color: "var(--text-primary)",
              }}
            >
              <option value="" disabled>
                {characteristics.length === 0
                  ? t("No characteristics loaded")
                  : t("Select characteristic…")}
              </option>
              {characteristics.map((c) => (
                <option key={c.uuid} value={c.uuid}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Start button */}
          <button
            className="btn btn-primary"
            onClick={startCharging}
            disabled={isWriting}
            style={{
              width: "100%",
              padding: "16px 0",
              fontSize: 16,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {isWriting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                {t("Sending…")}
              </>
            ) : (
              <>
                <Zap size={18} />
                {t("Start Charging")}
              </>
            )}
          </button>

          {/* Last command summary */}
          {lastCommand && (
            <div
              style={{
                marginTop: 16,
                padding: "12px 16px",
                borderRadius: 12,
                border: "1px solid var(--border-primary, #333)",
                background: "var(--bg-secondary, rgba(255,255,255,0.03))",
                fontSize: 13,
                color: "var(--text-muted)",
              }}
            >
              <div style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>
                {t("Last command sent")}
              </div>
              {lastCommand.mode === "time"
                ? t("Charge for {n} minutes", { n: String(lastCommand.value) })
                : t("Deliver {n} kWh", { n: String(lastCommand.value) })}{" "}
              → <code>{lastCommand.charName}</code> ·{" "}
              {new Date(lastCommand.at).toLocaleTimeString()}
            </div>
          )}

          {/* MVP scope note */}
          <p style={{ marginTop: 20, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
            {t(
              "MVP build — billing, subscription plans and session recording are not yet included."
            )}
          </p>
        </>
      )}
    </div>
  );
};

export default ChargerApp;
