'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { readBleCharacteristic, writeBleCharacteristic, disconnBleByMacAddress } from '../../../utils';
import { toast } from 'react-hot-toast';
import { ArrowLeft, Share2, Clipboard, Check, RefreshCw, Power, Calendar, Unlock, RotateCcw, Clock } from 'lucide-react';
import { AsciiStringModal } from '../../../modals';
import { apiUrl } from '@/lib/apollo-client';
import { useI18n } from '@/i18n';

type CodeMode = 'days' | 'free' | 'reset';

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
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [asciiModalOpen, setAsciiModalOpen] = useState(false);
  const [activeCharacteristic, setActiveCharacteristic] = useState<any>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRetrieving, setIsRetrieving] = useState(false);
  const [itemId, setItemId] = useState<string | null>(null);
  const [codeMode, setCodeMode] = useState<CodeMode>('days');

  useEffect(() => {
    const fetchItemId = async () => {
      const attService = attributeList.find((service) => service.serviceNameEnum === 'ATT_SERVICE');
      if (!attService) {
        console.log('ATT_SERVICE not yet loaded, skipping fetchItemId');
        return;
      }

      const oemItemId = attService.characteristicList.find((char: any) => char.name === 'opid')?.realVal || null;
      if (!oemItemId) {
        return;
      }

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
          body: JSON.stringify({
            query,
            variables: { oemItemId },
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}, Message: ${JSON.stringify(result)}`);
        }

        if (result.errors) {
          throw new Error(`GraphQL error: ${result.errors.map((e: { message: any }) => e.message).join(', ')}`);
        }

        const fetchedItemId = result.data.getItembyOemItemId._id;
        if (fetchedItemId) {
          setItemId(fetchedItemId);
          console.log('Item ID fetched successfully:', fetchedItemId);
        } else {
          throw new Error('No item ID returned in response');
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
          setTimeout(() => {
            onBack?.();
          }, 500);
        } else {
          toast.error(t('Failed to disconnect device'), { duration: 1500, id: 'disconnect-error' });
        }
      } catch (e) {
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
          toast.success(t(`${pubkCharacteristic.name} read successfully`));
          setUpdatedValue(data.realVal);
          setUpdatedValues((prev) => ({
            ...prev,
            [pubkCharacteristic.uuid]: data.realVal,
          }));
        } else {
          console.error('Error Reading Characteristics');
          toast.error(t(`Failed to read ${pubkCharacteristic.name}`));
        }
      }
    );
  }, [cmdService, pubkCharacteristic, device.macAddress, t]);

  const readRcrd = useCallback(() => {
    if (!stsService || !rcrdCharacteristic) return;
    readBleCharacteristic(
      stsService.uuid,
      rcrdCharacteristic.uuid,
      device.macAddress,
      (data: any) => {
        if (data) {
          setUpdatedValues((prev) => ({
            ...prev,
            [rcrdCharacteristic.uuid]: data.realVal,
          }));
        }
      }
    );
  }, [stsService, rcrdCharacteristic, device.macAddress]);

  const writeCodeToDevice = useCallback((codeDec: string) => {
    const foundCmdService = attributeList.find((service) => service.serviceNameEnum === 'CMD_SERVICE');
    if (!foundCmdService) {
      toast.error(t('CMD service not available'));
      return;
    }

    const foundPubk = foundCmdService.characteristicList.find(
      (char: any) => char.name.toLowerCase() === 'pubk'
    );
    if (!foundPubk) {
      toast.error(t('pubk characteristic not found in CMD service'));
      return;
    }

    setUpdatedValues((prev) => ({ ...prev, [foundPubk.uuid]: codeDec }));
    setActiveCharacteristic(foundPubk);
    setUpdatedValue(codeDec);

    const connectedMac = sessionStorage.getItem('connectedDeviceMac');
    if (!connectedMac || connectedMac !== device.macAddress) {
      toast.error(t('Device not connected. Please reconnect and try again.'), { duration: 3000 });
      return;
    }

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
            if (response.respCode === '200' || response.respCode === 200) {
              writeSuccess = true;
            } else if (response.respData === true || response.respData === 'success') {
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
        } catch (e) {
          console.error('Error parsing write response:', e);
          errorMessage = 'Unknown write response format';
        }

        if (writeSuccess) {
          toast.success(t('Code written to device successfully'), { duration: 2000 });
          setTimeout(() => {
            const stillConnected = sessionStorage.getItem('connectedDeviceMac');
            if (stillConnected === device.macAddress) {
              handleRead();
              readRcrd();
            } else {
              toast.error(t('Device disconnected. Please reconnect.'), { duration: 2000 });
            }
          }, 2000);
        } else {
          console.error('Write failed:', errorMessage || 'Unknown error');
          toast.error(t(`Failed to write code to device: ${errorMessage || 'Write operation failed'}`), { duration: 3000 });
        }
      }
    );
  }, [attributeList, device.macAddress, handleRead, readRcrd, t]);

  const [isCustomDuration, setIsCustomDuration] = useState(false);
  const [customDaysInput, setCustomDaysInput] = useState('');

  const handlePresetSelect = (days: number) => {
    setIsCustomDuration(false);
    setCustomDaysInput('');
    setDuration(days);
  };

  const handleCustomSelect = () => {
    setIsCustomDuration(true);
    const parsed = parseInt(customDaysInput, 10);
    setDuration(parsed > 0 ? parsed : null);
  };

  const handleCustomDaysChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    setCustomDaysInput(val);
    const parsed = parseInt(val, 10);
    setDuration(parsed > 0 ? parsed : null);
  };

  const getAuthToken = (): string | null => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/signin');
    }
    return token;
  };

  const executeGraphQL = async (query: string, variables: Record<string, any>) => {
    const authToken = getAuthToken();
    if (!authToken) return null;

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
      const errorMessages = responseData.errors
        .map((error: { message: string }) => error.message)
        .join(', ');
      throw new Error(`GraphQL error: ${errorMessages}`);
    }

    return responseData.data;
  };

  const handleGenerateDaysCode = async () => {
    if (!itemId) return;
    if (!duration) {
      toast.error(t('Please select a duration'));
      return;
    }
    if (!Number.isInteger(duration) || duration < 0) {
      toast.error(t('Duration must be a positive integer'));
      return;
    }

    setIsSubmitting(true);
    try {
      const query = `
        mutation GenerateDaysCode($itemId: ID!, $codeDays: Int!) {
          generateDaysCode(generateDaysCodeInput: {
            itemId: $itemId,
            codeDays: $codeDays
          }) {
            codeType
            codeHex
            codeDec
          }
        }
      `;

      const data = await executeGraphQL(query, { itemId, codeDays: duration });
      if (!data?.generateDaysCode) {
        throw new Error('No data returned from generateDaysCode');
      }

      const { codeDec } = data.generateDaysCode;
      setGeneratedCode(codeDec);
      toast.success(t(`Code: ${codeDec} generated successfully`), { duration: 1000 });
      writeCodeToDevice(codeDec);
    } catch (error) {
      console.error('Error generating days code:', error);
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(t(`Failed to generate code: ${message}`));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateFreeCode = async () => {
    if (!itemId) return;

    setIsSubmitting(true);
    try {
      const query = `
        mutation GenerateFreeCode($generateFreeCodeInput: GenerateCodeInput!) {
          generateFreeCode(generateFreeCodeInput: $generateFreeCodeInput) {
            codeType
            codeHex
            codeDec
          }
        }
      `;

      const data = await executeGraphQL(query, {
        generateFreeCodeInput: { itemId },
      });
      if (!data?.generateFreeCode) {
        throw new Error('No data returned from generateFreeCode');
      }

      const { codeDec } = data.generateFreeCode;
      setGeneratedCode(codeDec);
      toast.success(t(`Free Code: ${codeDec} generated successfully`), { duration: 1000 });
      writeCodeToDevice(codeDec);
    } catch (error) {
      console.error('Error generating free code:', error);
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(t(`Failed to generate free code: ${message}`));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateResetCode = async () => {
    if (!itemId) return;

    setIsSubmitting(true);
    try {
      const query = `
        mutation GenerateResetCode($generateResetCodeInput: GenerateCodeInput!) {
          generateResetCode(generateResetCodeInput: $generateResetCodeInput) {
            codeType
            codeHex
            codeDec
          }
        }
      `;

      const data = await executeGraphQL(query, {
        generateResetCodeInput: { itemId },
      });
      if (!data?.generateResetCode) {
        throw new Error('No data returned from generateResetCode');
      }

      const { codeDec } = data.generateResetCode;
      setGeneratedCode(codeDec);
      toast.success(t(`Reset Code: ${codeDec} generated successfully`), { duration: 1000 });
      writeCodeToDevice(codeDec);
    } catch (error) {
      console.error('Error generating reset code:', error);
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(t(`Failed to generate reset code: ${message}`));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    switch (codeMode) {
      case 'days':
        return handleGenerateDaysCode();
      case 'free':
        return handleGenerateFreeCode();
      case 'reset':
        return handleGenerateResetCode();
    }
  };

  const handleRetrieveCodes = async () => {
    if (!itemId) return;

    const distributorId = localStorage.getItem('distributorId');
    if (!distributorId) {
      toast.error(t('Distributor ID not available. Please sign in.'));
      router.push('/signin');
      return;
    }

    setIsRetrieving(true);

    try {
      const query = `
        query GetAllCodeEventsForSpecificItemByDistributor($itemId: ID!, $distributorId: ID!, $first: Int!) {
          getAllCodeEventsForSpecificItemByDistributor(itemId: $itemId, distributorId: $distributorId, first: $first) {
            page {
              edges {
                node {
                  codeDecString
                }
              }
            }
          }
        }
      `;

      const data = await executeGraphQL(query, { itemId, distributorId, first: 1 });
      const codeEventsData = data?.getAllCodeEventsForSpecificItemByDistributor?.page?.edges || [];

      if (codeEventsData.length > 0) {
        const codeDec = codeEventsData[0].node.codeDecString;
        setGeneratedCode(codeDec);
        toast.success(t(`Code: ${codeDec} retrieved successfully`), { duration: 1000 });
        writeCodeToDevice(codeDec);
      } else {
        toast.error(t('No codes found for this device'));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(t(`Failed to retrieve code: ${message}`));
    } finally {
      setIsRetrieving(false);
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
          setTimeout(() => {
            handleRead();
            readRcrd();
          }, 1000);
        } else {
          console.error('Error Writing Characteristics');
          toast.error(t(`Failed to write ${activeCharacteristic.name}`));
        }
      }
    );
  };

  const handleRefreshService = () => {
    if (onRequestServiceData) {
      onRequestServiceData('CMD');
    }
  };

  const translateDescription = (desc: string): string => {
    if (desc.includes('Public Key / Last Code')) {
      if (desc.includes('GPRS Carrier APN Name')) {
        return t('Public Key / Last Code / GPRS Carrier APN Name');
      }
      return t('Public Key / Last Code');
    }
    return t(desc);
  };

  const isGenerateDisabled = isSubmitting || (codeMode === 'days' && !duration);

  const generateButtonLabel = () => {
    if (isSubmitting) return t('Generating...');
    switch (codeMode) {
      case 'days': return t('Generate Days Code');
      case 'free': return t('Generate Free Code');
      case 'reset': return t('Generate Reset Code');
    }
  };

  const codeModes: { key: CodeMode; label: string; icon: React.ReactNode; color: string }[] = [
    { key: 'days', label: t('Days Code'), icon: <Clock size={16} />, color: 'var(--accent)' },
    { key: 'free', label: t('Free Code'), icon: <Unlock size={16} />, color: '#10b981' },
    { key: 'reset', label: t('Reset Code'), icon: <RotateCcw size={16} />, color: '#f59e0b' },
  ];

  const activeColor = codeModes.find(m => m.key === codeMode)?.color ?? 'var(--accent)';

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
      <div className="flex flex-col items-center p-6 pb-2">
        <img
          src={device.imageUrl}
          alt={device.name || 'Device'}
          className="w-40 h-40 object-contain mb-4"
        />
        <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{device.name || t('Unknown Device')}</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{device.macAddress || t('Unknown MAC')}</p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{device.rssi || t('Unknown RSSI')}</p>
      </div>

      <div className="p-4 max-w-md mx-auto">
        {/* Code Mode Selector */}
        <div
          className="mb-6 p-1 rounded-xl flex gap-1"
          style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
        >
          {codeModes.map((mode) => {
            const isActive = codeMode === mode.key;
            return (
              <button
                key={mode.key}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-sm font-semibold transition-all duration-200"
                style={{
                  background: isActive ? 'var(--bg-primary)' : 'transparent',
                  color: isActive ? mode.color : 'var(--text-secondary)',
                  boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                  border: isActive ? `1px solid ${mode.color}33` : '1px solid transparent',
                }}
                onClick={() => {
                  setCodeMode(mode.key);
                  setGeneratedCode(null);
                }}
              >
                {mode.icon}
                <span className="whitespace-nowrap">{mode.label}</span>
              </button>
            );
          })}
        </div>

        {/* Generated Code Display */}
        {generatedCode && (
          <div
            className="mb-6 p-4 rounded-xl text-center"
            style={{
              background: `${activeColor}11`,
              border: `1px solid ${activeColor}33`,
            }}
          >
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              {t('Generated Code')}
            </p>
            <div className="flex items-center justify-center gap-2">
              <p className="text-2xl font-bold font-mono tracking-wider" style={{ color: activeColor }}>
                {generatedCode}
              </p>
              <button
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = activeColor; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
                onClick={() => {
                  navigator.clipboard.writeText(generatedCode);
                  toast.success(t('Code copied to clipboard'));
                }}
              >
                <Clipboard size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Duration Picker (Days Code only) */}
        {codeMode === 'days' && (
          <div className="mb-6">
            <div className="flex items-center space-x-2 mb-3">
              <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{t('Duration')}</label>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 1, label: t('1 Day') },
                { value: 3, label: t('3 Days') },
              ].map((option) => {
                const isSelected = !isCustomDuration && duration === option.value;
                return (
                  <div
                    key={option.value}
                    className="relative cursor-pointer transition-all duration-200"
                    style={{ transform: isSelected ? 'scale(1.05)' : 'scale(1)' }}
                    onClick={() => handlePresetSelect(option.value)}
                  >
                    <div
                      className="p-3 rounded-xl transition-all duration-200 text-center"
                      style={{
                        border: isSelected ? '2px solid var(--accent)' : '2px solid var(--border)',
                        background: isSelected ? 'var(--accent-soft)' : 'var(--bg-secondary)',
                        boxShadow: isSelected ? '0 0 20px -5px var(--accent-glow)' : 'none',
                      }}
                    >
                      <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{option.label}</div>
                    </div>
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'var(--accent)' }}>
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                );
              })}
              <div
                className="relative cursor-pointer transition-all duration-200"
                style={{ transform: isCustomDuration ? 'scale(1.05)' : 'scale(1)' }}
                onClick={handleCustomSelect}
              >
                <div
                  className="p-3 rounded-xl transition-all duration-200 text-center"
                  style={{
                    border: isCustomDuration ? '2px solid var(--accent)' : '2px solid var(--border)',
                    background: isCustomDuration ? 'var(--accent-soft)' : 'var(--bg-secondary)',
                    boxShadow: isCustomDuration ? '0 0 20px -5px var(--accent-glow)' : 'none',
                  }}
                >
                  <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{t('Custom')}</div>
                </div>
                {isCustomDuration && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'var(--accent)' }}>
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
            </div>
            {isCustomDuration && (
              <div className="mt-3">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="form-input flex-1"
                    style={{ textAlign: 'center', fontSize: '15px', fontWeight: 600 }}
                    placeholder={t('Enter number of days') || 'Enter number of days'}
                    value={customDaysInput}
                    onChange={handleCustomDaysChange}
                    autoFocus
                  />
                  <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {t('Days')}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Info hint for Free/Reset code modes */}
        {codeMode === 'free' && (
          <div
            className="mb-6 p-3 rounded-xl flex items-start gap-3"
            style={{ background: '#10b98111', border: '1px solid #10b98133' }}
          >
            <Unlock size={18} style={{ color: '#10b981', flexShrink: 0, marginTop: 2 }} />
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {t('Generate a free code to unlock this device without a time limit.')}
            </p>
          </div>
        )}
        {codeMode === 'reset' && (
          <div
            className="mb-6 p-3 rounded-xl flex items-start gap-3"
            style={{ background: '#f59e0b11', border: '1px solid #f59e0b33' }}
          >
            <RotateCcw size={18} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 2 }} />
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {t('Generate a reset code to restore this device to its default state.')}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3 mb-6">
          <button
            className={`w-full py-3 px-4 rounded-xl font-semibold transition-all duration-200 ${
              isGenerateDisabled ? 'cursor-not-allowed' : 'cursor-pointer'
            }`}
            style={{
              background: isGenerateDisabled
                ? 'var(--bg-tertiary)'
                : codeMode === 'free'
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  : codeMode === 'reset'
                    ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                    : 'linear-gradient(135deg, var(--accent) 0%, #00a0a0 100%)',
              color: isGenerateDisabled ? 'var(--text-secondary)' : '#fff',
              opacity: isGenerateDisabled ? 0.5 : 1,
              border: isGenerateDisabled ? '1px solid var(--border)' : 'none',
            }}
            onMouseEnter={(e) => {
              if (!isGenerateDisabled) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = `0 8px 24px -8px ${activeColor}66`;
              }
            }}
            onMouseLeave={(e) => {
              if (!isGenerateDisabled) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
            onClick={handleSubmit}
            disabled={isGenerateDisabled}
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>{t('Generating...')}</span>
              </div>
            ) : (
              generateButtonLabel()
            )}
          </button>

          <button
            className={`w-full py-3 px-4 rounded-xl font-semibold transition-all duration-200 ${
              isRetrieving ? 'cursor-not-allowed' : 'cursor-pointer'
            }`}
            style={{
              background: isRetrieving
                ? 'var(--bg-tertiary)'
                : 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              opacity: isRetrieving ? 0.5 : 1,
              border: '1px solid var(--border)',
            }}
            onMouseEnter={(e) => {
              if (!isRetrieving) {
                e.currentTarget.style.borderColor = 'var(--accent)';
                e.currentTarget.style.background = 'var(--bg-tertiary)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isRetrieving) {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.background = 'var(--bg-secondary)';
              }
            }}
            onClick={handleRetrieveCodes}
            disabled={isRetrieving}
          >
            {isRetrieving ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>{t('Retrieving...')}</span>
              </div>
            ) : (
              t('Retrieve Last Code')
            )}
          </button>
        </div>

        {/* CMD Service Loading */}
        {isLoadingService === 'CMD' && (
          <div className="w-full h-1 mb-4 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
            <div
              className="h-full transition-all duration-300 ease-in-out"
              style={{ 
                width: `${serviceLoadingProgress}%`,
                background: 'var(--accent)',
              }}
            ></div>
          </div>
        )}

        {/* CMD Service Section */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>{t('CMD Service')}</h3>
          <div
            onClick={handleRefreshService}
            className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
              isLoadingService ? 'animate-spin' : ''
            }`}
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              cursor: isLoadingService ? 'not-allowed' : 'pointer',
              opacity: isLoadingService ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isLoadingService) {
                e.currentTarget.style.background = 'var(--bg-tertiary)';
                e.currentTarget.style.color = 'var(--accent)';
                e.currentTarget.style.borderColor = 'var(--accent)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoadingService) {
                e.currentTarget.style.background = 'var(--bg-secondary)';
                e.currentTarget.style.color = 'var(--text-secondary)';
                e.currentTarget.style.borderColor = 'var(--border)';
              }
            }}
          >
            <RefreshCw size={16} />
          </div>
        </div>
        {cmdService && pubkCharacteristic ? (
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
            <div className="flex justify-between items-center px-4 py-2" style={{ background: 'var(--bg-tertiary)' }}>
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{pubkCharacteristic.name}</span>
              <div className="flex space-x-2">
                <button
                  className="btn btn-secondary text-xs"
                  style={{ padding: '6px 12px', fontSize: '13px' }}
                  onClick={handleRead}
                  disabled={isLoading}
                >
                  {isLoading ? t('Reading...') : t('Read')}
                </button>
                <button
                  className="btn btn-primary text-xs"
                  style={{ padding: '6px 12px', fontSize: '13px' }}
                  onClick={handleWriteClick}
                >
                  {t('Write')}
                </button>
              </div>
            </div>
            <div className="p-4 space-y-2">
              <div>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('Description')}</p>
                <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{translateDescription(pubkCharacteristic.desc)}</p>
              </div>
              <div className="flex items-center justify-between group">
                <div className="flex-grow">
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('Current Value')}</p>
                  <p className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>
                    {updatedValues[pubkCharacteristic.uuid] || updatedValue || pubkCharacteristic.realVal || 'N/A'}
                  </p>
                </div>
                <button
                  className="p-2 transition-colors"
                  style={{ color: 'var(--text-secondary)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
                  onClick={() => {
                    const valueToCopy = updatedValues[pubkCharacteristic.uuid] || updatedValue || pubkCharacteristic.realVal || 'N/A';
                    navigator.clipboard.writeText(String(valueToCopy));
                    toast.success(t('Value copied to clipboard'));
                  }}
                  aria-label="Copy to clipboard"
                >
                  <Clipboard size={16} />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center" style={{ color: 'var(--text-secondary)' }}>
            {isLoadingService === 'CMD' ? (
              <p>{t('Loading CMD service data...')}</p>
            ) : (
              <p>{t('No data available for CMD service')}</p>
            )}
          </div>
        )}

        {/* Remaining Days */}
        <div
          className="mt-4 rounded-lg p-4 flex items-center justify-between"
          style={{ border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}
        >
          <div className="flex items-center gap-2">
            <Calendar size={16} style={{ color: 'var(--accent)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{t('Remaining Days')}</span>
          </div>
          {rcrdCharacteristic ? (
            <span className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              {updatedValues[rcrdCharacteristic.uuid] ?? rcrdCharacteristic.realVal ?? t('N/A')}
            </span>
          ) : (
            <span className="animate-pulse text-sm" style={{ color: 'var(--text-muted)' }}>
              {t('Loading...')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeviceDetailView;