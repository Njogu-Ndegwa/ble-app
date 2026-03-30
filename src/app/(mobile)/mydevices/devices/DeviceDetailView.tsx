'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { readBleCharacteristic, writeBleCharacteristic, disconnBleByMacAddress } from '../../../utils';
import { toast } from 'react-hot-toast';
import {
  ArrowLeft, Share2, Clipboard, RefreshCw, Power, Calendar,
  Unlock, RotateCcw, Clock, CheckCircle, AlertCircle, Loader2, Download,
} from 'lucide-react';
import { AsciiStringModal } from '../../../modals';
import { apiUrl } from '@/lib/apollo-client';
import { useI18n } from '@/i18n';

type CodeType = 'days' | 'free' | 'reset' | 'retrieve';
type ResultStatus = 'idle' | 'generating' | 'generated' | 'writing' | 'written' | 'writeFailed' | 'error';

interface ResultState {
  status: ResultStatus;
  codeType: CodeType | null;
  codeDec: string | null;
  error: string | null;
}

const INITIAL_RESULT: ResultState = { status: 'idle', codeType: null, codeDec: null, error: null };

interface DeviceDetailProps {
  device: {
    macAddress: string;
    name: string;
    rssi: string;
    imageUrl?: string;
  };
  attributeList: any[];
  onBack?: () => void;
  onRequestServiceData?: (serviceName: string) => void;
  isLoadingService?: string | null;
  serviceLoadingProgress?: number;
}

const DeviceDetailView: React.FC<DeviceDetailProps> = ({
  device,
  attributeList,
  onBack,
  onRequestServiceData,
  isLoadingService,
  serviceLoadingProgress = 0,
}) => {
  const { t } = useI18n();
  const router = useRouter();
  const [updatedValue, setUpdatedValue] = useState<string | null>(null);
  const [updatedValues, setUpdatedValues] = useState<{ [key: string]: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [asciiModalOpen, setAsciiModalOpen] = useState(false);
  const [activeCharacteristic, setActiveCharacteristic] = useState<any>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [itemId, setItemId] = useState<string | null>(null);

  const [result, setResult] = useState<ResultState>(INITIAL_RESULT);

  const isBusy = result.status === 'generating' || result.status === 'writing';

  useEffect(() => {
    const fetchItemId = async () => {
      const attService = attributeList.find((service) => service.serviceNameEnum === 'ATT_SERVICE');
      if (!attService) return;

      const oemItemId = attService.characteristicList.find((char: any) => char.name === 'opid')?.realVal || null;
      if (!oemItemId) return;

      try {
        const authToken = localStorage.getItem('access_token');
        if (!authToken) {
          toast.error(t('Please sign in to fetch item data'), { duration: 5000 });
          router.push('/signin');
          return;
        }

        const query = `
          query GetItemByOemItemId($oemItemId: ID!) {
            getItembyOemItemId(oemItemId: $oemItemId) {
              _id
            }
          }
        `;

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ query, variables: { oemItemId } }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        if (data.errors) throw new Error(data.errors.map((e: { message: string }) => e.message).join(', '));

        const fetchedItemId = data.data.getItembyOemItemId._id;
        if (fetchedItemId) {
          setItemId(fetchedItemId);
        } else {
          throw new Error('No item ID returned');
        }
      } catch (error) {
        console.error('Error fetching item ID:', error);
      }
    };

    fetchItemId();
  }, [router, attributeList, t]);

  const { cmdService, pubkCharacteristic, stsService, rcrdCharacteristic } = useMemo(() => {
    const foundCmd = attributeList.find((s) => s.serviceNameEnum === 'CMD_SERVICE');
    const foundSts = attributeList.find((s) => s.serviceNameEnum === 'STS_SERVICE');
    return {
      cmdService: foundCmd ?? null,
      pubkCharacteristic: foundCmd?.characteristicList?.find((c: any) => c.name.toLowerCase() === 'pubk') ?? null,
      stsService: foundSts ?? null,
      rcrdCharacteristic: foundSts?.characteristicList?.find((c: any) => c.name.toLowerCase() === 'rcrd') ?? null,
    };
  }, [attributeList]);

  useEffect(() => {
    if (!onRequestServiceData) return;
    if (!cmdService) onRequestServiceData('CMD');
    if (!stsService) onRequestServiceData('STS');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBack = () => (onBack ? onBack() : router.back());

  const handleDisconnect = () => {
    if (!device?.macAddress) return;
    disconnBleByMacAddress(device.macAddress, (resp: any) => {
      try {
        const parsed = typeof resp === 'string' ? JSON.parse(resp) : resp;
        const ok = parsed?.respCode === '200' || parsed?.respData === true;
        if (ok) {
          toast.success(t('Disconnected from device'), { duration: 1500, id: 'disconnect-toast' });
          sessionStorage.removeItem("connectedDeviceMac");
          setTimeout(() => { onBack?.(); }, 500);
        } else {
          toast.error(t('Failed to disconnect device'), { duration: 1500, id: 'disconnect-error' });
        }
      } catch {
        toast.error(t('Failed to disconnect device'), { duration: 1500, id: 'disconnect-error' });
      }
    });
  };

  const handleRead = useCallback(() => {
    if (!cmdService || !pubkCharacteristic) return;
    setIsLoading(true);
    readBleCharacteristic(
      cmdService.uuid,
      pubkCharacteristic.uuid,
      device.macAddress,
      (data: any) => {
        setIsLoading(false);
        if (data) {
          setUpdatedValue(data.realVal);
          setUpdatedValues((prev) => ({ ...prev, [pubkCharacteristic.uuid]: data.realVal }));
        }
      }
    );
  }, [cmdService, pubkCharacteristic, device.macAddress]);

  const readRcrd = useCallback(() => {
    if (!stsService || !rcrdCharacteristic) return;
    readBleCharacteristic(
      stsService.uuid,
      rcrdCharacteristic.uuid,
      device.macAddress,
      (data: any) => {
        if (data) {
          setUpdatedValues((prev) => ({ ...prev, [rcrdCharacteristic.uuid]: data.realVal }));
        }
      }
    );
  }, [stsService, rcrdCharacteristic, device.macAddress]);

  const writeCodeToDevice = useCallback((codeDec: string) => {
    const foundCmdService = attributeList.find((service) => service.serviceNameEnum === 'CMD_SERVICE');
    if (!foundCmdService) {
      setResult((prev) => ({ ...prev, status: 'writeFailed', error: t('CMD service not available') }));
      return;
    }
    const foundPubk = foundCmdService.characteristicList.find(
      (char: any) => char.name.toLowerCase() === 'pubk'
    );
    if (!foundPubk) {
      setResult((prev) => ({ ...prev, status: 'writeFailed', error: t('pubk characteristic not found') }));
      return;
    }

    setUpdatedValues((prev) => ({ ...prev, [foundPubk.uuid]: codeDec }));
    setActiveCharacteristic(foundPubk);
    setUpdatedValue(codeDec);

    const connectedMac = sessionStorage.getItem('connectedDeviceMac');
    if (!connectedMac || connectedMac !== device.macAddress) {
      setResult((prev) => ({ ...prev, status: 'writeFailed', error: t('Device not connected') }));
      return;
    }

    setResult((prev) => ({ ...prev, status: 'writing' }));

    writeBleCharacteristic(
      foundCmdService.uuid,
      foundPubk.uuid,
      codeDec,
      device.macAddress,
      (responseData: any) => {
        let writeSuccess = false;
        let errorMessage: string | null = null;

        try {
          let response: any;
          if (typeof responseData === 'string') {
            try {
              response = JSON.parse(responseData);
            } catch {
              if (responseData.toLowerCase() === 'success' || responseData.toLowerCase() === 'ok') {
                writeSuccess = true;
              } else {
                errorMessage = responseData;
              }
            }
          } else {
            response = responseData;
          }

          if (response) {
            if (response.respCode === '200' || response.respCode === 200) writeSuccess = true;
            else if (response.respData === true || response.respData === 'success') writeSuccess = true;
            else if (response.success === true) writeSuccess = true;
            else if (response.respDesc) errorMessage = response.respDesc;
            else if (response.error) errorMessage = response.error;
            else if (response.message) errorMessage = response.message;
          }
        } catch (e) {
          console.error('Error parsing write response:', e);
          errorMessage = 'Unknown write response format';
        }

        if (writeSuccess) {
          setResult((prev) => ({ ...prev, status: 'written' }));
          setTimeout(() => {
            const stillConnected = sessionStorage.getItem('connectedDeviceMac');
            if (stillConnected === device.macAddress) {
              handleRead();
              readRcrd();
            }
          }, 2000);
        } else {
          setResult((prev) => ({ ...prev, status: 'writeFailed', error: errorMessage || 'Write operation failed' }));
        }
      }
    );
  }, [attributeList, device.macAddress, handleRead, readRcrd, t]);

  const [daysInput, setDaysInput] = useState('');

  const handleDaysInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    setDaysInput(val);
    const parsed = parseInt(val, 10);
    setDuration(parsed > 0 ? parsed : null);
  };

  const executeGraphQL = async (query: string, variables: Record<string, any>) => {
    const authToken = localStorage.getItem('access_token');
    if (!authToken) {
      router.push('/signin');
      return null;
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error ${response.status}: ${errorText}`);
    }

    const responseData = await response.json();
    if (responseData.errors) {
      throw new Error(responseData.errors.map((e: { message: string }) => e.message).join(', '));
    }
    return responseData.data;
  };

  const runCodeOperation = async (codeType: CodeType, apiCall: () => Promise<string>) => {
    setResult({ status: 'generating', codeType, codeDec: null, error: null });
    try {
      const codeDec = await apiCall();
      setResult({ status: 'generated', codeType, codeDec, error: null });
      writeCodeToDevice(codeDec);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      setResult({ status: 'error', codeType, codeDec: null, error: message });
    }
  };

  const handleGenerateDaysCode = () => {
    if (!duration) {
      toast.error(t('Please select a duration'));
      return;
    }
    if (!Number.isInteger(duration) || duration < 0) {
      toast.error(t('Duration must be a positive integer'));
      return;
    }
    if (!itemId) {
      setResult({ status: 'error', codeType: 'days', codeDec: null, error: t('Device not identified yet. Please wait for device data to load.') });
      return;
    }
    runCodeOperation('days', async () => {
      const query = `
        mutation GenerateDaysCode($itemId: ID!, $codeDays: Int!) {
          generateDaysCode(generateDaysCodeInput: { itemId: $itemId, codeDays: $codeDays }) {
            codeType
            codeHex
            codeDec
          }
        }
      `;
      const data = await executeGraphQL(query, { itemId, codeDays: duration });
      if (!data?.generateDaysCode) throw new Error('No data returned');
      return data.generateDaysCode.codeDec;
    });
  };

  const handleGenerateFreeCode = () => {
    if (!itemId) {
      setResult({ status: 'error', codeType: 'free', codeDec: null, error: t('Device not identified yet. Please wait for device data to load.') });
      return;
    }
    runCodeOperation('free', async () => {
      const query = `
        mutation GenerateFreeCode($generateFreeCodeInput: GenerateCodeInput!) {
          generateFreeCode(generateFreeCodeInput: $generateFreeCodeInput) {
            codeType
            codeHex
            codeDec
          }
        }
      `;
      const data = await executeGraphQL(query, { generateFreeCodeInput: { itemId } });
      if (!data?.generateFreeCode) throw new Error('No data returned');
      return data.generateFreeCode.codeDec;
    });
  };

  const handleGenerateResetCode = () => {
    if (!itemId) {
      setResult({ status: 'error', codeType: 'reset', codeDec: null, error: t('Device not identified yet. Please wait for device data to load.') });
      return;
    }
    runCodeOperation('reset', async () => {
      const query = `
        mutation GenerateResetCode($generateResetCodeInput: GenerateCodeInput!) {
          generateResetCode(generateResetCodeInput: $generateResetCodeInput) {
            codeType
            codeHex
            codeDec
          }
        }
      `;
      const data = await executeGraphQL(query, { generateResetCodeInput: { itemId } });
      if (!data?.generateResetCode) throw new Error('No data returned');
      return data.generateResetCode.codeDec;
    });
  };

  const handleRetrieveCodes = () => {
    if (!itemId) {
      setResult({ status: 'error', codeType: 'retrieve', codeDec: null, error: t('Device not identified yet. Please wait for device data to load.') });
      return;
    }
    const distributorId = localStorage.getItem('distributorId');
    if (!distributorId) {
      toast.error(t('Distributor ID not available. Please sign in.'));
      router.push('/signin');
      return;
    }
    runCodeOperation('retrieve', async () => {
      const query = `
        query GetAllCodeEventsForSpecificItemByDistributor($itemId: ID!, $distributorId: ID!, $first: Int!) {
          getAllCodeEventsForSpecificItemByDistributor(itemId: $itemId, distributorId: $distributorId, first: $first) {
            page { edges { node { codeDecString } } }
          }
        }
      `;
      const data = await executeGraphQL(query, { itemId, distributorId, first: 1 });
      const edges = data?.getAllCodeEventsForSpecificItemByDistributor?.page?.edges || [];
      if (edges.length === 0) throw new Error('No codes found for this device');
      return edges[0].node.codeDecString;
    });
  };

  const handleRetryWrite = () => {
    if (result.codeDec) {
      writeCodeToDevice(result.codeDec);
    }
  };

  const handleWriteClick = () => {
    if (!pubkCharacteristic) return;
    setActiveCharacteristic(pubkCharacteristic);
    setAsciiModalOpen(true);
  };

  const handleWrite = (value: string) => {
    if (!activeCharacteristic || !cmdService) return;
    writeBleCharacteristic(
      cmdService.uuid,
      activeCharacteristic.uuid,
      value,
      device.macAddress,
      (data: any) => {
        if (data) {
          toast.success(t(`Value written to ${activeCharacteristic.name}`));
          setTimeout(() => { handleRead(); readRcrd(); }, 1000);
        } else {
          toast.error(t(`Failed to write ${activeCharacteristic.name}`));
        }
      }
    );
  };

  const handleRefreshService = () => {
    if (onRequestServiceData) onRequestServiceData('CMD');
  };

  const translateDescription = (desc: string): string => {
    if (desc.includes('Public Key / Last Code')) {
      if (desc.includes('GPRS Carrier APN Name')) return t('Public Key / Last Code / GPRS Carrier APN Name');
      return t('Public Key / Last Code');
    }
    return t(desc);
  };

  const codeTypeLabel = (ct: CodeType | null) => {
    switch (ct) {
      case 'days': return t('Days Code');
      case 'free': return t('Free Code');
      case 'reset': return t('Reset Code');
      case 'retrieve': return t('Retrieved Code');
      default: return t('Code');
    }
  };

  const codeTypeColor = (ct: CodeType | null) => {
    switch (ct) {
      case 'free': return '#10b981';
      case 'reset': return '#f59e0b';
      default: return 'var(--accent)';
    }
  };

  const remainingDays = rcrdCharacteristic
    ? (updatedValues[rcrdCharacteristic.uuid] ?? rcrdCharacteristic.realVal ?? null)
    : null;

  const pubkValue = pubkCharacteristic
    ? (updatedValues[pubkCharacteristic.uuid] || updatedValue || pubkCharacteristic.realVal || null)
    : null;

  return (
    <div className="flex-1 overflow-y-auto" style={{ position: 'relative', zIndex: 1 }}>
      <AsciiStringModal
        isOpen={asciiModalOpen}
        onClose={() => setAsciiModalOpen(false)}
        onSubmit={(value) => handleWrite(value)}
        title={activeCharacteristic?.name || t('Public Key / Last Code / GPRS Carrier APN Name')}
      />

      {/* Header */}
      <div className="p-4 flex items-center" style={{ borderBottom: '1px solid var(--border)' }}>
        <button
          onClick={handleBack}
          className="mr-4 transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-semibold flex-1" style={{ color: 'var(--text-primary)' }}>{t('Device Details')}</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDisconnect}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--color-error)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-error-soft)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            title={t('Disconnect Device')}
          >
            <Power className="w-5 h-5" />
          </button>
          <Share2 className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
        </div>
      </div>

      {/* Device Info */}
      <div className="flex flex-col items-center p-6 pb-3">
        <img src={device.imageUrl} alt={device.name || 'Device'} className="w-32 h-32 object-contain mb-3" />
        <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{device.name || t('Unknown Device')}</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{device.macAddress || t('Unknown MAC')}</p>
      </div>

      <div className="p-4 max-w-md mx-auto">
        {/* Stat Row: Remaining Days + Current Code Value */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div
            className="rounded-xl p-3"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Calendar size={14} style={{ color: 'var(--accent)' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{t('Remaining Days')}</span>
            </div>
            {rcrdCharacteristic ? (
              <span className="text-2xl font-bold font-mono" style={{ color: 'var(--text-primary)' }}>
                {remainingDays ?? t('N/A')}
              </span>
            ) : (
              <span className="text-sm animate-pulse" style={{ color: 'var(--text-muted)' }}>{t('Loading...')}</span>
            )}
          </div>
          <div
            className="rounded-xl p-3"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Clipboard size={14} style={{ color: 'var(--accent)' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{t('Current Code')}</span>
            </div>
            {pubkCharacteristic ? (
              <span
                className="text-lg font-bold font-mono block truncate"
                style={{ color: 'var(--text-primary)' }}
                title={pubkValue || 'N/A'}
              >
                {pubkValue || t('N/A')}
              </span>
            ) : (
              <span className="text-sm animate-pulse" style={{ color: 'var(--text-muted)' }}>{t('Loading...')}</span>
            )}
          </div>
        </div>

        {/* Code Operations */}
        <div className="space-y-3 mb-4">
          {/* Days Code */}
          <div
            className="rounded-xl p-4"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent-soft)' }}>
                <Clock size={18} style={{ color: 'var(--accent)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('Days Code')}</p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('Time-limited access')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <div className="flex items-center gap-1.5 flex-1">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="form-input"
                  style={{ textAlign: 'center', fontSize: '14px', fontWeight: 600, width: '70px', flexShrink: 0 }}
                  placeholder="0"
                  value={daysInput}
                  onChange={handleDaysInputChange}
                />
                <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  {t('days')}
                </span>
              </div>
              <button
                className="py-2 px-4 rounded-lg font-semibold text-xs transition-all duration-200 flex-shrink-0"
                style={{
                  background: isBusy || !duration
                    ? 'var(--bg-tertiary)'
                    : 'linear-gradient(135deg, var(--accent) 0%, #00a0a0 100%)',
                  color: isBusy || !duration ? 'var(--text-muted)' : '#fff',
                  opacity: isBusy || !duration ? 0.5 : 1,
                  border: isBusy || !duration ? '1px solid var(--border)' : 'none',
                  cursor: isBusy || !duration ? 'not-allowed' : 'pointer',
                }}
                onClick={handleGenerateDaysCode}
                disabled={isBusy || !duration}
              >
                {isBusy && result.codeType === 'days' ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 size={14} className="animate-spin" />
                    {result.status === 'writing' ? t('Writing...') : t('Generating...')}
                  </span>
                ) : (
                  t('Generate')
                )}
              </button>
            </div>
          </div>

          {/* Free Code */}
          <div
            className="rounded-xl p-4"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#10b98118' }}>
                <Unlock size={18} style={{ color: '#10b981' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('Free Code')}</p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('Unlock without time limit')}</p>
              </div>
              <button
                className="py-2 px-4 rounded-lg font-semibold text-xs transition-all duration-200 flex-shrink-0"
                style={{
                  background: isBusy ? 'var(--bg-tertiary)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: isBusy ? 'var(--text-muted)' : '#fff',
                  opacity: isBusy ? 0.5 : 1,
                  border: isBusy ? '1px solid var(--border)' : 'none',
                  cursor: isBusy ? 'not-allowed' : 'pointer',
                }}
                onClick={handleGenerateFreeCode}
                disabled={isBusy}
              >
                {isBusy && result.codeType === 'free' ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 size={14} className="animate-spin" />
                    {result.status === 'writing' ? t('Writing...') : t('Generating...')}
                  </span>
                ) : (
                  t('Generate')
                )}
              </button>
            </div>
          </div>

          {/* Reset Code */}
          <div
            className="rounded-xl p-4"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#f59e0b18' }}>
                <RotateCcw size={18} style={{ color: '#f59e0b' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('Reset Code')}</p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('Restore to default state')}</p>
              </div>
              <button
                className="py-2 px-4 rounded-lg font-semibold text-xs transition-all duration-200 flex-shrink-0"
                style={{
                  background: isBusy ? 'var(--bg-tertiary)' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: isBusy ? 'var(--text-muted)' : '#fff',
                  opacity: isBusy ? 0.5 : 1,
                  border: isBusy ? '1px solid var(--border)' : 'none',
                  cursor: isBusy ? 'not-allowed' : 'pointer',
                }}
                onClick={handleGenerateResetCode}
                disabled={isBusy}
              >
                {isBusy && result.codeType === 'reset' ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 size={14} className="animate-spin" />
                    {result.status === 'writing' ? t('Writing...') : t('Generating...')}
                  </span>
                ) : (
                  t('Generate')
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Result Card */}
        {result.status !== 'idle' && (
          <div
            className="rounded-xl overflow-hidden mb-4 transition-all duration-300"
            style={{
              border: `1px solid ${
                result.status === 'error' ? 'var(--color-error)'
                : result.status === 'writeFailed' ? '#f59e0b'
                : result.status === 'written' ? 'var(--color-success)'
                : result.status === 'generating' ? 'var(--border)'
                : codeTypeColor(result.codeType) + '66'
              }`,
              background: result.status === 'error' ? 'var(--color-error-soft, rgba(239,68,68,0.08))'
                : result.status === 'writeFailed' ? 'rgba(245,158,11,0.08)'
                : result.status === 'written' ? 'var(--color-success-soft, rgba(16,185,129,0.08))'
                : 'var(--bg-secondary)',
            }}
          >
            {/* Generating state */}
            {result.status === 'generating' && (
              <div className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--bg-tertiary)' }}>
                  <Loader2 size={20} className="animate-spin" style={{ color: codeTypeColor(result.codeType) }} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {result.codeType === 'retrieve' ? t('Retrieving last code...') : t('Generating code...')}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{codeTypeLabel(result.codeType)}</p>
                </div>
              </div>
            )}

            {/* Generated / Writing / Written states */}
            {(result.status === 'generated' || result.status === 'writing' || result.status === 'written' || result.status === 'writeFailed') && result.codeDec && (
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-md"
                      style={{
                        background: codeTypeColor(result.codeType) + '22',
                        color: codeTypeColor(result.codeType),
                      }}
                    >
                      {codeTypeLabel(result.codeType)}
                    </span>
                  </div>
                  <button
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    onClick={() => {
                      if (result.codeDec) {
                        navigator.clipboard.writeText(result.codeDec);
                        toast.success(t('Code copied to clipboard'));
                      }
                    }}
                  >
                    <Clipboard size={16} />
                  </button>
                </div>
                <p
                  className="text-3xl font-bold font-mono tracking-wider mb-3 text-center"
                  style={{ color: codeTypeColor(result.codeType) }}
                >
                  {result.codeDec}
                </p>
                {/* Write status */}
                <div
                  className="flex items-center gap-2 rounded-lg px-3 py-2"
                  style={{ background: 'var(--bg-tertiary)' }}
                >
                  {result.status === 'writing' && (
                    <>
                      <Loader2 size={14} className="animate-spin" style={{ color: 'var(--accent)' }} />
                      <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                        {t('Writing code to device...')}
                      </span>
                    </>
                  )}
                  {result.status === 'generated' && (
                    <>
                      <CheckCircle size={14} style={{ color: 'var(--accent)' }} />
                      <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                        {t('Code generated successfully')}
                      </span>
                    </>
                  )}
                  {result.status === 'written' && (
                    <>
                      <CheckCircle size={14} style={{ color: 'var(--color-success, #10b981)' }} />
                      <span className="text-xs font-medium" style={{ color: 'var(--color-success, #10b981)' }}>
                        {t('Written to device successfully')}
                      </span>
                    </>
                  )}
                  {result.status === 'writeFailed' && (
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <AlertCircle size={14} style={{ color: '#f59e0b' }} />
                        <span className="text-xs font-medium" style={{ color: '#f59e0b' }}>
                          {result.error || t('Failed to write to device')}
                        </span>
                      </div>
                      <button
                        className="text-xs font-semibold px-2 py-1 rounded-md transition-colors"
                        style={{ color: 'var(--accent)', background: 'var(--bg-secondary)' }}
                        onClick={handleRetryWrite}
                      >
                        {t('Retry')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Error state */}
            {result.status === 'error' && (
              <div className="p-4 flex items-start gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(239,68,68,0.15)' }}>
                  <AlertCircle size={20} style={{ color: 'var(--color-error)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold mb-0.5" style={{ color: 'var(--color-error)' }}>
                    {result.codeType === 'retrieve' ? t('Failed to retrieve code') : t('Failed to generate code')}
                  </p>
                  <p className="text-xs break-words" style={{ color: 'var(--text-secondary)' }}>{result.error}</p>
                </div>
                <button
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg flex-shrink-0 transition-colors"
                  style={{
                    color: 'var(--color-error)',
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.2)',
                  }}
                  onClick={() => {
                    if (result.codeType === 'days') handleGenerateDaysCode();
                    else if (result.codeType === 'free') handleGenerateFreeCode();
                    else if (result.codeType === 'reset') handleGenerateResetCode();
                    else if (result.codeType === 'retrieve') handleRetrieveCodes();
                  }}
                >
                  {t('Try Again')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Retrieve Last Code */}
        <button
          className="w-full py-2.5 px-4 rounded-lg font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2 mb-6"
          style={{
            background: 'transparent',
            color: isBusy ? 'var(--text-muted)' : 'var(--text-secondary)',
            border: '1px dashed var(--border)',
            cursor: isBusy ? 'not-allowed' : 'pointer',
            opacity: isBusy ? 0.5 : 1,
          }}
          onMouseEnter={(e) => {
            if (!isBusy) {
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.color = 'var(--accent)';
              e.currentTarget.style.background = 'var(--bg-secondary)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isBusy) {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.background = 'transparent';
            }
          }}
          onClick={handleRetrieveCodes}
          disabled={isBusy}
        >
          {isBusy && result.codeType === 'retrieve' ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              {t('Retrieving...')}
            </>
          ) : (
            <>
              <Download size={16} />
              {t('Retrieve Last Code')}
            </>
          )}
        </button>

        {/* CMD Service */}
        {isLoadingService === 'CMD' && (
          <div className="w-full h-1 mb-4 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
            <div
              className="h-full transition-all duration-300 ease-in-out"
              style={{ width: `${serviceLoadingProgress}%`, background: 'var(--accent)' }}
            />
          </div>
        )}
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{t('CMD Service')}</h3>
          <div
            onClick={handleRefreshService}
            className={`flex items-center justify-center w-7 h-7 rounded-lg transition-all ${isLoadingService ? 'animate-spin' : ''}`}
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              cursor: isLoadingService ? 'not-allowed' : 'pointer',
              opacity: isLoadingService ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isLoadingService) {
                e.currentTarget.style.color = 'var(--accent)';
                e.currentTarget.style.borderColor = 'var(--accent)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoadingService) {
                e.currentTarget.style.color = 'var(--text-secondary)';
                e.currentTarget.style.borderColor = 'var(--border)';
              }
            }}
          >
            <RefreshCw size={14} />
          </div>
        </div>
        {cmdService && pubkCharacteristic ? (
          <div className="rounded-xl overflow-hidden mb-4" style={{ border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
            <div className="flex justify-between items-center px-4 py-2" style={{ background: 'var(--bg-tertiary)' }}>
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{pubkCharacteristic.name}</span>
              <div className="flex space-x-2">
                <button
                  className="btn btn-secondary text-xs"
                  style={{ padding: '5px 10px', fontSize: '12px' }}
                  onClick={handleRead}
                  disabled={isLoading}
                >
                  {isLoading ? t('Reading...') : t('Read')}
                </button>
                <button
                  className="btn btn-primary text-xs"
                  style={{ padding: '5px 10px', fontSize: '12px' }}
                  onClick={handleWriteClick}
                >
                  {t('Write')}
                </button>
              </div>
            </div>
            <div className="p-3 space-y-2">
              <div>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('Description')}</p>
                <p className="text-xs" style={{ color: 'var(--text-primary)' }}>{translateDescription(pubkCharacteristic.desc)}</p>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex-grow min-w-0">
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('Current Value')}</p>
                  <p className="text-sm font-mono truncate" style={{ color: 'var(--text-primary)' }}>{pubkValue || 'N/A'}</p>
                </div>
                <button
                  className="p-1.5 transition-colors flex-shrink-0"
                  style={{ color: 'var(--text-secondary)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
                  onClick={() => {
                    navigator.clipboard.writeText(String(pubkValue || 'N/A'));
                    toast.success(t('Value copied to clipboard'));
                  }}
                  aria-label="Copy to clipboard"
                >
                  <Clipboard size={14} />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 text-center mb-4" style={{ color: 'var(--text-secondary)' }}>
            {isLoadingService === 'CMD' ? (
              <p className="text-sm">{t('Loading CMD service data...')}</p>
            ) : (
              <p className="text-sm">{t('No data available for CMD service')}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DeviceDetailView;
