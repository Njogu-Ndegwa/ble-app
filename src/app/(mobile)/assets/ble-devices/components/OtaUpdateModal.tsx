"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { X, UploadCloud, FileText, AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { useI18n } from "@/i18n";
import apolloClient from "@/lib/apollo-client";
import {
  GET_ALL_ITEM_FIRMWARES,
  GET_FILE_OBJECTS_FOR_FIRMWARE_VERSION,
  ItemFirmware,
  S3FileObject,
  OTA_SECRET_KEY,
} from "@/lib/graphql/firmware";
import { useOtaUpdate, OTA_ERROR_KEYS } from "@/lib/hooks/ble/useOtaUpdate";

interface OtaUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  device: { macAddress: string; name: string };
  /** Current fwv from the ATT service, if loaded */
  currentFirmware?: string | null;
  /** Called after a successful update is acknowledged (device rebooted; needs reconnect) */
  onSuccess?: () => void;
  /** Auto-select this cloud version on open (from the update-available prompt) */
  preselectVersion?: string | null;
}

type Step = "pick" | "confirm" | "updating";

interface SelectedFirmware {
  label: string; // version or local file name
  fileName: string;
  hexContent: string;
  source: "cloud" | "local";
}

const isHexFileName = (name: string) =>
  /\.(hex|hex16|txt)$/i.test(name.trim());

/** Cheap sanity check that content looks like Intel HEX before shipping it over the bridge */
const looksLikeIntelHex = (content: string) => {
  const firstLine = content.split(/\r?\n/, 1)[0]?.trim() ?? "";
  return firstLine.startsWith(":") && firstLine.length >= 11;
};

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const OtaUpdateModal: React.FC<OtaUpdateModalProps> = ({
  isOpen,
  onClose,
  device,
  currentFirmware,
  onSuccess,
  preselectVersion,
}) => {
  const { t } = useI18n();
  const { state, startOta, cancelOta, reset } = useOtaUpdate(device.macAddress);

  const [step, setStep] = useState<Step>("pick");
  const [firmwares, setFirmwares] = useState<ItemFirmware[]>([]);
  const [firmwaresLoading, setFirmwaresLoading] = useState(false);
  const [firmwaresError, setFirmwaresError] = useState<string | null>(null);
  const [fetchingVersion, setFetchingVersion] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelectedFirmware | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoPickedRef = useRef(false);

  // Load cloud firmware list each time the modal opens
  useEffect(() => {
    if (!isOpen) return;
    setStep("pick");
    setSelected(null);
    setPickError(null);
    autoPickedRef.current = false;
    reset();
    setFirmwaresLoading(true);
    setFirmwaresError(null);
    apolloClient
      .query({ query: GET_ALL_ITEM_FIRMWARES, variables: { first: 100 }, fetchPolicy: "network-only" })
      .then((res) => {
        const edges = res.data?.getAllItemFirmwares?.page?.edges ?? [];
        const nodes: ItemFirmware[] = edges.map((e: any) => e.node).filter(Boolean);
        // Newest first so recently-uploaded firmware (the one the user is most
        // likely reaching for) is at the top, not buried at the end of the list.
        nodes.sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
        setFirmwares(nodes);
      })
      .catch((err) => {
        setFirmwaresError(err?.message ?? String(err));
        setFirmwares([]);
      })
      .finally(() => setFirmwaresLoading(false));
  }, [isOpen, reset]);

  const pickCloudVersion = useCallback(
    async (fw: ItemFirmware) => {
      setPickError(null);
      setFetchingVersion(fw.version);
      try {
        const res = await apolloClient.query({
          query: GET_FILE_OBJECTS_FOR_FIRMWARE_VERSION,
          variables: { version: fw.version },
          fetchPolicy: "network-only",
        });
        const files: S3FileObject[] = res.data?.getFileObjectsForFirmwareVersion ?? [];
        const hexFile = files.find((f) => isHexFileName(f.filename)) ?? files[0];
        if (!hexFile) {
          setPickError(t("ble.ota.noFilesForVersion"));
          return;
        }
        // S3 presigned HTTPS URL (WebView cannot fetch ftp://)
        const resp = await fetch(hexFile.downloadUrl);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const content = await resp.text();
        if (!looksLikeIntelHex(content)) {
          setPickError(t("ble.ota.notIntelHex"));
          return;
        }
        setSelected({
          label: fw.version,
          fileName: hexFile.filename,
          hexContent: content,
          source: "cloud",
        });
        setStep("confirm");
      } catch (err: any) {
        setPickError(t("ble.ota.downloadFailed", { error: err?.message ?? String(err) }));
      } finally {
        setFetchingVersion(null);
      }
    },
    [t]
  );

  // When opened from the "update available" prompt, jump straight to that version
  useEffect(() => {
    if (!isOpen || !preselectVersion || autoPickedRef.current || firmwaresLoading) return;
    const fw = firmwares.find((f) => f.version === preselectVersion);
    if (fw) {
      autoPickedRef.current = true;
      pickCloudVersion(fw);
    }
  }, [isOpen, preselectVersion, firmwares, firmwaresLoading, pickCloudVersion]);

  const pickLocalFile = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setPickError(null);
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      if (!isHexFileName(file.name)) {
        setPickError(t("ble.ota.notIntelHex"));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const content = String(reader.result ?? "");
        if (!looksLikeIntelHex(content)) {
          setPickError(t("ble.ota.notIntelHex"));
          return;
        }
        setSelected({
          label: file.name,
          fileName: file.name,
          hexContent: content,
          source: "local",
        });
        setStep("confirm");
      };
      reader.onerror = () => setPickError(t("ble.ota.fileReadFailed"));
      reader.readAsText(file);
    },
    [t]
  );

  const handleStart = useCallback(() => {
    if (!selected) return;
    setStep("updating");
    startOta(selected.fileName, selected.hexContent, OTA_SECRET_KEY);
  }, [selected, startOta]);

  const updating =
    step === "updating" &&
    (state.phase === "starting" || state.phase === "transferring" || state.phase === "rebooting");

  const handleClose = useCallback(() => {
    if (updating) return; // no accidental dismissal mid-transfer
    reset();
    onClose();
  }, [updating, reset, onClose]);

  const handleCancelUpdate = useCallback(() => {
    cancelOta();
    setStep("confirm");
  }, [cancelOta]);

  if (!isOpen) return null;

  const errorMessage =
    state.errorDetail ??
    (state.errorCode != null
      ? t(OTA_ERROR_KEYS[state.errorCode] ?? "ble.ota.error.generic")
      : t("ble.ota.error.generic"));

  const phaseLabel =
    state.phase === "starting"
      ? t("ble.ota.phase.starting")
      : state.phase === "rebooting"
      ? t("ble.ota.phase.rebooting")
      : t("ble.ota.phase.transferring");

  return (
    <div
      className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      style={{ background: "rgba(0, 0, 0, 0.75)" }}
    >
      <div
        className="rounded-lg w-full max-w-md shadow-xl max-h-[85vh] overflow-y-auto"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
      >
        <div className="flex justify-between items-center px-4 pt-3">
          <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            {t("ble.ota.title")}
          </h3>
          <button
            onClick={handleClose}
            className="rounded-full p-1 transition-colors"
            style={{
              color: "var(--text-secondary)",
              background: "var(--bg-tertiary)",
              opacity: updating ? 0.4 : 1,
              cursor: updating ? "not-allowed" : "pointer",
            }}
            aria-label={t("Close")}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 pb-4 pt-2 space-y-4">
          <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
            <p>{device.name} · {device.macAddress}</p>
            <p>
              {t("ble.ota.currentVersion")}:{" "}
              <span className="font-mono" style={{ color: "var(--text-primary)" }}>
                {currentFirmware || t("N/A")}
              </span>
            </p>
          </div>

          {step === "pick" && (
            <>
              <div>
                <p className="text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>
                  {t("ble.ota.chooseCloud")}
                </p>
                {firmwaresLoading ? (
                  <div className="flex items-center gap-2 text-sm py-3" style={{ color: "var(--text-secondary)" }}>
                    <Loader2 size={14} className="animate-spin" /> {t("ble.ota.loadingVersions")}
                  </div>
                ) : firmwaresError ? (
                  <p className="text-sm py-2" style={{ color: "var(--error)" }}>
                    {t("ble.ota.versionsFailed")}
                  </p>
                ) : firmwares.length === 0 ? (
                  <p className="text-sm py-2" style={{ color: "var(--text-secondary)" }}>
                    {t("ble.ota.noVersions")}
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {firmwares.map((fw) => (
                      <button
                        key={fw._id}
                        className="w-full text-left rounded-lg px-3 py-2"
                        style={{ border: "1px solid var(--border)", background: "var(--bg-tertiary)" }}
                        disabled={fetchingVersion !== null}
                        onClick={() => pickCloudVersion(fw)}
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-mono" style={{ color: "var(--text-primary)" }}>
                            {fw.version}
                          </span>
                          {fetchingVersion === fw.version ? (
                            <Loader2 size={14} className="animate-spin" style={{ color: "var(--accent)" }} />
                          ) : (
                            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                              {fw.codeSystem}
                            </span>
                          )}
                        </div>
                        {fw.description && (
                          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                            {fw.description}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{t("ble.ota.or")}</span>
                <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
              </div>

              <button
                className="w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm"
                style={{ border: "1px dashed var(--border)", color: "var(--text-primary)", background: "transparent" }}
                onClick={() => fileInputRef.current?.click()}
              >
                <FileText size={16} /> {t("ble.ota.chooseLocal")}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".hex,.hex16,.txt"
                className="hidden"
                onChange={pickLocalFile}
              />

              {pickError && (
                <p className="text-sm" style={{ color: "var(--error)" }}>{pickError}</p>
              )}
            </>
          )}

          {step === "confirm" && selected && (
            <>
              <div
                className="rounded-lg px-3 py-2 text-sm"
                style={{ border: "1px solid var(--border)", background: "var(--bg-tertiary)" }}
              >
                <p style={{ color: "var(--text-primary)" }}>
                  <span className="font-medium">{t("ble.ota.selectedFirmware")}: </span>
                  <span className="font-mono">{selected.label}</span>
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                  {selected.fileName} · {formatSize(selected.hexContent.length)}
                </p>
              </div>
              {state.phase === "error" && (
                <div className="flex items-start gap-2 text-sm" style={{ color: "var(--error)" }}>
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
              <div
                className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
                style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
              >
                <AlertTriangle size={14} className="mt-0.5 shrink-0" style={{ color: "var(--warning)" }} />
                <span>{t("ble.ota.warning")}</span>
              </div>
              <div className="flex gap-2">
                <button className="btn btn-secondary flex-1" onClick={() => { reset(); setStep("pick"); }}>
                  {t("Back")}
                </button>
                <button className="btn btn-primary flex-1" onClick={handleStart}>
                  {t("ble.ota.startUpdate")}
                </button>
              </div>
            </>
          )}

          {step === "updating" && state.phase !== "success" && state.phase !== "error" && (
            <>
              <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-primary)" }}>
                <Loader2 size={16} className="animate-spin" style={{ color: "var(--accent)" }} />
                {phaseLabel}
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-tertiary)" }}>
                <div
                  className="h-full transition-all duration-300 ease-in-out"
                  style={{ width: `${state.progress}%`, background: "var(--accent)" }}
                />
              </div>
              <p className="text-xs text-center font-mono" style={{ color: "var(--text-secondary)" }}>
                {state.progress.toFixed(0)}%
              </p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {t("ble.ota.keepClose")}
              </p>
              <button className="btn btn-secondary w-full" onClick={handleCancelUpdate}>
                {t("Cancel")}
              </button>
            </>
          )}

          {step === "updating" && state.phase === "success" && (
            <>
              <div className="flex flex-col items-center gap-2 py-2">
                <CheckCircle2 size={40} style={{ color: "var(--success)" }} />
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {t("ble.ota.successTitle")}
                </p>
                <p className="text-xs text-center" style={{ color: "var(--text-secondary)" }}>
                  {t("ble.ota.successBody")}
                </p>
              </div>
              <button
                className="btn btn-primary w-full flex items-center justify-center gap-2"
                onClick={() => {
                  reset();
                  onClose();
                  onSuccess?.();
                }}
              >
                <RefreshCw size={14} /> {t("ble.ota.backToDevices")}
              </button>
            </>
          )}

          {step === "updating" && state.phase === "error" && (
            <>
              <div className="flex items-start gap-2 text-sm" style={{ color: "var(--error)" }}>
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
              <div className="flex gap-2">
                <button className="btn btn-secondary flex-1" onClick={() => { reset(); setStep("pick"); }}>
                  {t("Back")}
                </button>
                <button className="btn btn-primary flex-1" onClick={handleStart}>
                  {t("ble.ota.retry")}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default OtaUpdateModal;
