import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { ArrowLeft, Share2, Clipboard} from 'lucide-react';
import { readBleCharacteristic, writeBleCharacteristic } from '../../../utils';
import { AsciiStringModal, NumericModal } from '../../../modals';
import { useI18n } from '@/i18n';

const START_SENTINEL = '*';
const END_SENTINEL = '#';
const REQUIRED_DIGIT_COUNT = 21;

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
  const inputRef = useRef<HTMLInputElement>(null);
  
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
    setLoadingStates((prev) => ({ ...prev, [characteristicUuid]: true }));
    readBleCharacteristic(
      serviceUuid,
      characteristicUuid,
      device.macAddress,
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

    const connectedMac = sessionStorage.getItem("connectedDeviceMac");
    if (!connectedMac || connectedMac !== device.macAddress) {
      toast.error(t("Device not connected. Please reconnect and try again."));
      return;
    }

    setLoadingStates((prev) => ({ ...prev, [char.uuid]: true }));

    writeBleCharacteristic(cmdService.uuid, char.uuid, value, device.macAddress, (responseData: any) => {
      setLoadingStates((prev) => ({ ...prev, [char.uuid]: false }));
      console.info({ writeResponse: responseData });

      let writeSuccess = false;
      let errorMessage: string | null = null;

      try {
        let response: any;

        if (typeof responseData === "string") {
          try {
            response = JSON.parse(responseData);
          } catch (_parseErr) {
            if (
              responseData.toLowerCase() === "success" ||
              responseData.toLowerCase() === "ok"
            ) {
              writeSuccess = true;
            } else {
              errorMessage = responseData;
            }
          }
        } else {
          response = responseData;
        }

        if (response) {
          if (response.respCode === "200" || response.respCode === 200) {
            writeSuccess = true;
          } else if (response.respData === true || response.respData === "success") {
            writeSuccess = true;
          } else if (response.success === true) {
            writeSuccess = true;
          } else if (response.respDesc) {
            errorMessage = response.respDesc;
          } else if (response.error) {
            errorMessage = response.error;
          } else if (response.message) {
            errorMessage = response.message;
          }
        }
      } catch (err) {
        console.error("Error parsing write response:", err);
        errorMessage = "Unknown write response format";
      }

      if (writeSuccess) {
        // toast.success(t("Value written to {name}", { name: char.name }));
        toast.success(t("Success"));
        setTimeout(() => {
          const stillConnected = sessionStorage.getItem("connectedDeviceMac");
          if (stillConnected === device.macAddress) {
            afterWrite?.();
          } else {
            toast.error(t("Device disconnected. Please reconnect."));
          }
        }, 2000);
      } else {
        console.error("Write failed:", errorMessage || "Unknown error");
        // toast.error(
        //   t("Failed to write {name}: {error}", {
        //     name: char.name,
        //     error: errorMessage || t("Write operation failed"),
        //   })
        // );
        toast.error(
          t("Failed")
        );
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
      // toast.success('Code pasted successfully');
    } catch (error) {
      console.error('Failed to paste:', error);
      toast.error(t('Failed to paste code. Please check clipboard permissions.'));
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
    writeCharacteristic(pubkCharacteristic, formatInputCode(rawCode), () => {
      setTimeout(() =>
        handleRead(cmdService!.uuid, pubkCharacteristic.uuid, pubkCharacteristic.name),
      1000);
    });
    setDigitInput('');
  };

  const focusInput = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  /* ------------------------------------------------------------------ */
  /* Render */
  /* ------------------------------------------------------------------ */
  const header = (
    <div className="p-4 flex items-center" style={{ borderBottom: '1px solid var(--border)' }}>
      <button 
        onClick={onBack} 
        className="mr-4 transition-colors" 
        aria-label="Back"
        style={{ color: 'var(--text-secondary)' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
      >
        <ArrowLeft className="w-6 h-6" />
      </button>
      <h1 className="text-lg font-semibold flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
        {getDisplayValue(opidCharacteristic) ?? device.name ?? t('Device')}
      </h1>
      <Share2 className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
    </div>
  );

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
                // toast.success(t('Value copied'));
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
        <button
          onClick={async () => {
            try {
              await handlePaste();
            } catch (error) {
              toast.error(t('Clipboard access denied. Please paste manually.'));
            }
          }}
          className="flex items-center text-xs transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          {/* <Clipboard size={14} className="mr-1" /> Paste */}
        </button>
      </div>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={formattedInputCode}
          onPaste={handlePaste}
          onChange={(e) => {
            e.preventDefault();
          }}
          onClick={focusInput}
          placeholder="(*...#)"
          className="font-mono h-8 mt-1 truncate p-1 rounded w-full pr-10"
          style={{
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
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
            onClick={clearInput}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
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
    <div className="flex-1 overflow-y-auto" style={{ position: 'relative', zIndex: 1 }}>
      <Toaster />
      {/* ---------- header ---------- */}
      {header}
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
      <div className="p-4 space-y-6 max-w-md mx-auto">
        {credentialsCards}
        {inputDisplay}
        {keypadGrid}
      </div>
    </div>
  );
};

export default DeviceDetailView;

