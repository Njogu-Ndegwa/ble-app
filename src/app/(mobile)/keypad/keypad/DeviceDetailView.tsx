import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { Clipboard } from 'lucide-react';
import { readBleCharacteristic, writeBleCharacteristic } from '../../../utils';
import { AsciiStringModal, NumericModal } from '../../../modals';
import { useI18n } from '@/i18n';
import { keypadLog, keypadWarn } from './keypadLog';
const START_SENTINEL = '*';
const END_SENTINEL = '#';
const REQUIRED_DIGIT_COUNT = 21;

function redactDigitToken(digits: string): string {
  if (!digits) return '(empty)';
  if (digits.length <= 8) return `(len=${digits.length})`;
  return `${digits.slice(0, 4)}…${digits.slice(-4)} (len=${digits.length})`;
}

interface DeviceDetailProps {
  device: {
    macAddress: string;
    name: string;
    rssi?: string;
    imageUrl?: string;
  };
  attributeList: any[];
  onBack?: () => void;
  onRequestServiceData?: (serviceName: string) => void;
  isLoadingService?: string | null;
  serviceLoadingProgress?: number;
  handlePublish?: (attributeList: any, serviceType: string) => void;
}

/* ------------------------------------------------------------------ */
/* Main component implementation */
/* ------------------------------------------------------------------ */
const DeviceDetailView: React.FC<DeviceDetailProps> = ({
  device,
  attributeList,
  onBack,
  onRequestServiceData,
  isLoadingService,
}) => {
  const { t } = useI18n();
  /* ----------------------------- state ----------------------------- */
  const [updatedValues, setUpdatedValues] = useState<Record<string, any>>({});
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const [asciiModalOpen, setAsciiModalOpen] = useState(false);
  const [numericModalOpen, setNumericModalOpen] = useState(false);
  const [activeCharacteristic, setActiveCharacteristic] = useState<any>(null);
  const [digitInput, setDigitInput] = useState('');
  
  /* Values we may want to display although they have their own cards */
  const [pubkValue, setPubkValue] = useState<string | null>(null);
  const [rcrdValue, setRcrdValue] = useState<string | null>(null);

  /* ---------------------- locate services/chars -------------------- */
  /* ---------------------- locate services/chars -------------------- */
const {
  cmdService,
  pubkCharacteristic,
  stsService,
  rcrdCharacteristic,
  attService,
  opidCharacteristic,
} = useMemo(() => {
  const foundCmd = attributeList.find(
    (service) => service.serviceNameEnum === 'CMD_SERVICE'
  );
  const foundSts = attributeList.find(
    (service) => service.serviceNameEnum === 'STS_SERVICE'
  );
  const foundAtt = attributeList.find(
    (service) => service.serviceNameEnum === 'ATT_SERVICE'
  );
  const pubkChar =
    foundCmd?.characteristicList?.find(
      (c: any) => c.name.toLowerCase() === 'pubk'
    ) ?? null;
  const rcrdChar =
    foundSts?.characteristicList?.find(
      (c: any) => c.name.toLowerCase() === 'rcrd'
    ) ?? null;
  const opidChar =
    foundAtt?.characteristicList?.find(
      (c: any) => c.name.toLowerCase() === 'opid'
    ) ?? null;
  return {
    cmdService: foundCmd ?? null,
    pubkCharacteristic: pubkChar,
    stsService: foundSts ?? null,
    rcrdCharacteristic: rcrdChar,
    attService: foundAtt ?? null,
    opidCharacteristic: opidChar,
  };
}, [attributeList]); // Only depends on attributeList

useEffect(() => {
  if (!attributeList?.length) {
    keypadLog('detail: attributeList empty (waiting for BLE services)');
    return;
  }
  keypadLog('detail: services snapshot', {
    mac: device.macAddress,
    deviceName: device.name,
    services: attributeList.map((s: any) => ({
      serviceNameEnum: s.serviceNameEnum,
      uuid: typeof s.uuid === 'string' ? `${s.uuid.slice(0, 8)}…` : s.uuid,
      characteristics: (s.characteristicList ?? []).map((c: any) => ({
        name: c.name,
        hasValue: c.realVal !== null && c.realVal !== undefined,
      })),
    })),
  });
}, [attributeList, device.macAddress, device.name]);

/* ------------------ ensure CMD, STS & ATT are fetched ----------------- */
useEffect(() => {
  if (onRequestServiceData) {
    if (!cmdService) onRequestServiceData('CMD');
    if (!stsService) onRequestServiceData('STS');
    if (!attService) onRequestServiceData('ATT');
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []); // ← FIXED: Empty array - runs only once on mount



  /* ----------------- hydrate initial pubk / rcrd ------------------- */
  useEffect(() => {
    // Fixed: removed ATT from loadingStates check since it's not being set in loadingStates
    const done =
      isLoadingService === null && 
      !loadingStates['CMD'] && 
      !loadingStates['STS'];
      
    if (!done) return;
    
    if (pubkCharacteristic) setPubkValue(pubkCharacteristic.realVal);
    if (rcrdCharacteristic) setRcrdValue(rcrdCharacteristic.realVal);
  }, [isLoadingService, loadingStates, pubkCharacteristic, rcrdCharacteristic]);

  /* ------------------------------------------------------------------ */
  /* Helper / util functions */
  /* ------------------------------------------------------------------ */
  const formatValue = (characteristic: any) => {
    if (!characteristic) return t('N/A');
    if (typeof characteristic.realVal === 'number') {
      switch (characteristic.valType) {
        case 1:
          return t('{value} mA', { value: String(characteristic.realVal) });
        case 2:
          return t('{value} mV', { value: String(characteristic.realVal) });
        default:
          return characteristic.realVal;
      }
    }
    return characteristic.realVal ?? t('N/A');
  };

  const getDisplayValue = (char: any) => {
    if (!char) return t('N/A');
    return updatedValues[char.uuid] !== undefined
      ? updatedValues[char.uuid]
      : formatValue(char);
  };

  const handleRead = (
    serviceUuid: string,
    characteristicUuid: string,
    name: string
  ) => {
    if (!device.macAddress?.trim()) {
      toast.error(t('Device not connected. Please reconnect and try again.'));
      return;
    }
    setLoadingStates((prev) => ({ ...prev, [characteristicUuid]: true }));
    readBleCharacteristic(
      serviceUuid,
      characteristicUuid,
      device.macAddress.trim(),
      (data: any, error: any) => {
        setLoadingStates((prev) => ({ ...prev, [characteristicUuid]: false }));
        if (data) {
          setUpdatedValues((prev) => ({ ...prev, [characteristicUuid]: data.realVal }));
        } else {
          toast.error(t('Failed to read {name}', { name }));
        }
      }
    );
  };

  const writeCharacteristic = (
    char: any,
    value: string | number,
    afterWrite?: () => void
  ) => {
    if (!char || !cmdService) return;

    const connectedRaw =
      typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('connectedDeviceMac') : null;
    const targetMac = device.macAddress?.trim();
    console.info(targetMac, "Target Mac")
    console.info(connectedRaw, "Connected Raw")
    if (!targetMac) {
      keypadWarn('write: blocked — no device MAC');
      toast.error(t("Device not connected. Please reconnect and try again."));
      return;
    }

    const sessionMatches =
      !!connectedRaw &&
      connectedRaw.trim().toLowerCase() === targetMac.toLowerCase();
    if (!sessionMatches) {
      keypadWarn('write: blocked — session MAC mismatch or missing', {
        sessionMac: connectedRaw,
        targetMac,
      });
      toast.error(t("Device not connected. Please reconnect and try again."));
      return;
    }

    const valueStr = String(value);
    keypadLog('write: request', {
      characteristic: char.name,
      charUuid: char.uuid,
      cmdServiceUuid: cmdService.uuid,
      targetMac,
      valueLength: valueStr.length,
      valueHasSentinels: valueStr.includes(START_SENTINEL) && valueStr.includes(END_SENTINEL),
    });

    setLoadingStates((prev) => ({ ...prev, [char.uuid]: true }));

    writeBleCharacteristic(cmdService.uuid, char.uuid, value, targetMac, (responseData: any) => {
      setLoadingStates((prev) => ({ ...prev, [char.uuid]: false }));

      const rawLog =
        typeof responseData === "string"
          ? responseData
          : (() => {
              try {
                return JSON.stringify(responseData);
              } catch {
                return String(responseData);
              }
            })();
      keypadLog('write: native callback (raw)', rawLog);

      if (responseData === undefined || responseData === null || responseData === '') {
        keypadWarn('write: empty response from native bridge');
      }

      let writeSuccess = false;
      let errorMessage: string | null = null;
      let parsePath: string = "none";

      try {
        let response: any;

        if (typeof responseData === "string") {
          try {
            response = JSON.parse(responseData);
            parsePath = "json-string";
          } catch (_parseErr) {
            const lower = responseData.toLowerCase();
            if (lower === "success" || lower === "ok") {
              writeSuccess = true;
              parsePath = "plain-success-string";
            } else {
              errorMessage = responseData;
              parsePath = "plain-error-string";
            }
          }
        } else if (responseData != null) {
          response = responseData;
          parsePath = "object";
        }

        if (response) {
          if (response.respCode === "200" || response.respCode === 200) {
            writeSuccess = true;
            parsePath += "+respCode200";
          } else if (response.respData === true || response.respData === "success") {
            writeSuccess = true;
            parsePath += "+respDataSuccess";
          } else if (response.success === true) {
            writeSuccess = true;
            parsePath += "+successTrue";
          } else if (response.respDesc) {
            errorMessage = String(response.respDesc);
            parsePath += "+respDesc";
          } else if (response.error) {
            errorMessage = String(response.error);
            parsePath += "+errorField";
          } else if (response.message) {
            errorMessage = String(response.message);
            parsePath += "+messageField";
          }
        }
      } catch (err) {
        keypadWarn('write: exception parsing bridge response', err);
        errorMessage = "Unknown write response format";
        parsePath = "exception";
      }

      keypadLog('write: result', {
        success: writeSuccess,
        errorMessage: errorMessage ?? (writeSuccess ? null : 'No success flag matched — inspect raw log'),
        parsePath,
        looksInvalid:
          ((errorMessage ?? "").toLowerCase().includes("invalid") ||
          rawLog.toLowerCase().includes("invalid")),
      });

      if (writeSuccess) {
        toast.success(t("Success"));
        setTimeout(() => {
          const still = sessionStorage.getItem("connectedDeviceMac");
          if (still?.trim().toLowerCase() === targetMac.toLowerCase()) {
            keypadLog('write: success — scheduling afterWrite refresh');
            afterWrite?.();
          } else {
            keypadWarn('write: after success, session MAC changed or cleared');
            toast.error(t("Device disconnected. Please reconnect."));
          }
        }, 2000);
      } else {
        keypadWarn('write: failed', errorMessage || 'unknown');
        toast.error(errorMessage?.trim() ? errorMessage : t('Failed'));
      }
    });
  };

  const handleWrite = (value: string | number) => {
    if (!activeCharacteristic || !cmdService) return;

    writeCharacteristic(activeCharacteristic, value, () => {
      handleRead(cmdService.uuid, pubkCharacteristic.uuid, device.name);
      handleRead(stsService.uuid, rcrdCharacteristic.uuid, device.name);
    });
  };

  /* ------------------------------------------------------------------ */
  /* Keypad / input logic */
  /* ------------------------------------------------------------------ */
  const keypad: (string | null)[][] = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    [null, '0', null],
  ];

  const buildRawCode = (digits: string) =>
    `${START_SENTINEL}${digits}${digits.length === REQUIRED_DIGIT_COUNT ? END_SENTINEL : ''}`;

  const formatInputCode = (code: string) => {
    const raw = code.replace(/\s/g, '');
    if (!raw) return '';
    const segs: string[] = [];
    if (raw.length > 0) segs.push(raw.slice(0, 4));
    if (raw.length > 4) segs.push(raw.slice(4, 7));
    if (raw.length > 7) segs.push(raw.slice(7, 10));
    if (raw.length > 10) segs.push(raw.slice(10, 13));
    if (raw.length > 13) segs.push(raw.slice(13, 16));
    if (raw.length > 16) segs.push(raw.slice(16, 19));
    if (raw.length > 19) segs.push(raw.slice(19, 23));
    return segs.join(' ');
  };

  const rawInputCode = buildRawCode(digitInput);
  const formattedInputCode = formatInputCode(rawInputCode);
  const isCodeComplete = digitInput.length === REQUIRED_DIGIT_COUNT;

  const handleNumpadClick = (key: string | null) => {
    if (!key || !/^\d$/.test(key)) return;
    setDigitInput((prev) => {
      if (prev.length >= REQUIRED_DIGIT_COUNT) return prev;
      return prev + key;
    });
  };

  const handlePaste = async (e?: React.ClipboardEvent<HTMLInputElement>) => {
    try {
      let pastedText = '';
     
      if (e) {
        e.preventDefault();
        pastedText = e.clipboardData.getData('text').trim();
      } else {
        // Handle programmatic paste from button click
        const clipboardText = await navigator.clipboard.readText();
        pastedText = clipboardText.trim();
      }
      let rawText = pastedText.replace(/\s/g, '');
      if (rawText.startsWith(START_SENTINEL)) rawText = rawText.slice(1);
      if (rawText.endsWith(END_SENTINEL)) rawText = rawText.slice(0, -1);

      if (rawText.length !== REQUIRED_DIGIT_COUNT) {
        toast.error(t('Code must contain exactly 21 digits'));
        return;
      }
      if (!/^\d+$/.test(rawText)) {
        toast.error(t('Code can only include digits between the markers'));
        return;
      }
      setDigitInput(rawText);
      toast.success(t('Code pasted successfully'));
    } catch (error) {
      console.error('Failed to paste:', error);
      toast.error(t('Failed to paste code. Please check clipboard permissions.'));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/[^\d]/g, '');
    if (digits.length <= REQUIRED_DIGIT_COUNT) {
      setDigitInput(digits);
    }
  };

  const clearInput = () => {
    setDigitInput((prev) => prev.slice(0, -1));
  };

  const submitInput = () => {
    if (isLoadingService) return toast.error(t('Service is loading, please wait'));
    if (!isCodeComplete) return toast.error(t('Code must contain 21 digits'));
    if (!pubkCharacteristic) return toast.error(t('Public key characteristic not found'));
    const rawCode = buildRawCode(digitInput);
    const payloadFormatted = formatInputCode(rawCode);
    keypadLog('submit: pubk code', {
      digitsFingerprint: redactDigitToken(digitInput),
      rawSkeleton: `${START_SENTINEL}${redactDigitToken(digitInput)}${END_SENTINEL}`,
      formattedLength: payloadFormatted.length,
      isLoadingService,
      hasPubk: !!pubkCharacteristic,
      hasCmd: !!cmdService,
      hasSts: !!stsService,
    });
    writeCharacteristic(pubkCharacteristic, payloadFormatted, () => {
      // Refresh both Last Code and Days - delay gives device time to process the write
      setTimeout(() => {
        handleRead(cmdService!.uuid, pubkCharacteristic.uuid, pubkCharacteristic.name);
        if (stsService && rcrdCharacteristic) {
          handleRead(stsService.uuid, rcrdCharacteristic.uuid, rcrdCharacteristic.name);
        }
      }, 1500);
    });
    setDigitInput('');
  };


  /* ------------------------------------------------------------------ */
  /* Render */
  /* ------------------------------------------------------------------ */

  const credentialsCards = (
    <div className="flex space-x-4">
      {/* pubk card */}
      <div className="rounded-lg p-4 w-3/4" style={{ border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
        <div className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>{t('Last Code')}</div>
        {pubkCharacteristic ? (
          <div className="min-h-8 flex items-center">
            <div className="font-mono text-sm overflow-hidden overflow-ellipsis w-5/6 whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
              {getDisplayValue(pubkCharacteristic)}
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(String(getDisplayValue(pubkCharacteristic)));
                toast.success(t('Value copied'));
              }}
              className="ml-1 p-1 transition-colors"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              <Clipboard size={16} />
            </button>
          </div>
        ) : (
          <div className="w-full flex justify-center py-2 animate-pulse text-sm" style={{ color: 'var(--text-muted)' }}>
            {t('Loading...')}
          </div>
        )}
      </div>
      {/* rcrd days card */}
      <div className="rounded-lg p-4 w-1/4 flex flex-col" style={{ border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
        <div className="text-sm mb-2 text-center" style={{ color: 'var(--text-secondary)' }}>{t('Days')}</div>
        <div className="flex items-center justify-center min-h-8">
          {rcrdCharacteristic ? (
            <span className="text-xl font-medium" style={{ color: 'var(--text-primary)' }}>{getDisplayValue(rcrdCharacteristic)}</span>
          ) : (
            <div className="w-full flex justify-center py-2 animate-pulse text-sm" style={{ color: 'var(--text-muted)' }}>
              {t('Loading...')}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const inputDisplay = (
    <div className="rounded-lg p-3" style={{ border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
      <div className="flex justify-between items-center mb-1">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('New Code:')}</p>
      </div>
      <div className="relative">
        <input
          type="text"
          inputMode="none"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          value={formattedInputCode}
          placeholder="(*...#)"
          onPaste={handlePaste}
          onChange={handleInputChange}
          onContextMenu={(e) => {
            // Allow native context menu (paste) on long-press where supported
            e.stopPropagation();
          }}
          className="font-mono h-8 mt-1 truncate p-1 rounded w-full pr-10 focus:outline-none focus:ring-0"
          style={{
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            outline: 'none',
            WebkitTapHighlightColor: 'transparent',
            fontSize:
              formattedInputCode.length > 20
                ? '0.75rem'
                : formattedInputCode.length > 15
                ? '0.875rem'
                : '1rem',
          }}
        />
        {digitInput.length > 0 && (
          <button
            onPointerDown={(e) => { e.preventDefault(); clearInput(); }}
            className="absolute right-0 top-0 bottom-0 flex items-center justify-center transition-colors"
            style={{
              color: 'var(--text-secondary)',
              width: '2.5rem',
              fontSize: '1.25rem',
            }}
            aria-label={t('Clear last digit')}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );

  const okDisabled = Boolean(isLoadingService) || !isCodeComplete;

  const keypadGrid = (
    <>
      <div className="grid grid-cols-3 gap-2">
        {keypad.map((row, i) =>
          row.map((key, j) =>
            key ? (
              <button
                key={`${i}-${j}`}
                className="text-xl font-semibold rounded-lg py-3 transition-colors"
                style={{
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-elevated)';
                  e.currentTarget.style.borderColor = 'var(--accent)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--bg-tertiary)';
                  e.currentTarget.style.borderColor = 'var(--border)';
                }}
                onClick={() => handleNumpadClick(key)}
              >
                {key}
              </button>
            ) : (
              <div key={`${i}-${j}`} />
            )
          )
        )}
      </div>
      <div className="flex space-x-4 mt-2">
        <button
          className="h-14 flex-1 flex items-center justify-center rounded text-xl transition-colors"
          style={{
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-elevated)';
            e.currentTarget.style.borderColor = 'var(--accent)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--bg-tertiary)';
            e.currentTarget.style.borderColor = 'var(--border)';
          }}
          onClick={clearInput}
        >
          ←
        </button>
        <button
          className={`h-14 flex-1 flex items-center justify-center rounded text-xl transition-colors ${
            okDisabled ? 'cursor-not-allowed' : 'cursor-pointer'
          }`}
          style={{
            background: okDisabled 
              ? 'var(--bg-tertiary)' 
              : 'linear-gradient(135deg, var(--accent) 0%, #00a0a0 100%)',
            color: '#ffffff',
            opacity: okDisabled ? 0.5 : 1,
            border: okDisabled ? '1px solid var(--border)' : 'none',
          }}
          onMouseEnter={(e) => {
            if (!okDisabled) {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 24px -8px var(--accent-glow)';
            }
          }}
          onMouseLeave={(e) => {
            if (!okDisabled) {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }
          }}
          onClick={() => {
            if (!okDisabled) submitInput();
          }}
          disabled={okDisabled}
        >
          {t('Submit')}
        </button>
      </div>
    </>
  );

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      {/* ---------- modals ---------- */}
      <AsciiStringModal
        isOpen={asciiModalOpen}
        onClose={() => setAsciiModalOpen(false)}
        onSubmit={handleWrite}
        title={activeCharacteristic?.name || t('Public Key / Last Code')}
      />
      <NumericModal
        isOpen={numericModalOpen}
        onClose={() => setNumericModalOpen(false)}
        onSubmit={handleWrite}
        title={activeCharacteristic?.name || t('Write')}
      />
      {/* ---------- main content ---------- */}
      <div className="p-4 space-y-4 max-w-md mx-auto">
        {credentialsCards}
        {inputDisplay}
        {keypadGrid}
      </div>
    </div>
  );
};

export default DeviceDetailView;
