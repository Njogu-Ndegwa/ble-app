'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { readBleCharacteristic, writeBleCharacteristic } from '../../../utils';
import { toast } from 'react-hot-toast';
import { AlertCircle, Loader2 } from 'lucide-react';
import { AsciiStringModal, ConfirmModal } from '../../../modals';
import { apiUrl } from '@/lib/apollo-client';
import { useI18n } from '@/i18n';
import { cleanBatteryId } from '@/lib/hooks/ble/energyUtils';
import StatusCard from './components/StatusCard';
import AddDaysCard from './components/AddDaysCard';
import ResultZone from './components/ResultZone';
import OtherCodes from './components/OtherCodes';
import AdvancedPanel from './components/AdvancedPanel';
import type { CodeType, ResultState, LastCode } from './components/types';

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
  const [identifyError, setIdentifyError] = useState<string | null>(null);
  const [isIdentifying, setIsIdentifying] = useState(false);

  const [result, setResult] = useState<ResultState>(INITIAL_RESULT);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isBusy = result.status === 'generating' || result.status === 'writing';

  const fetchItemId = useCallback(async () => {
    const attService = attributeList.find((service) => service.serviceNameEnum === 'ATT_SERVICE');
    if (!attService) {
      return;
    }

    const getCharValue = (name: string) => {
      const char = attService.characteristicList.find(
        (c: any) => c.name?.toLowerCase() === name.toLowerCase()
      );
      const val = char?.realVal;
      return (val !== null && val !== undefined && String(val).trim() !== '') ? String(val).trim() : null;
    };

    const rawOpid = getCharValue('opid');
    const rawPpid = getCharValue('ppid');
    const rawValue = rawOpid || rawPpid;
    if (!rawValue) {
      console.info('[DeviceDetail] No opid/ppid value found in ATT_SERVICE (values may still be loading)',
        { opid: rawOpid, ppid: rawPpid });
      return;
    }

    // Clean arrow characters ("<", ">") that BLE ppid/opid values sometimes contain
    const oemItemId = cleanBatteryId(rawValue);

    setIsIdentifying(true);
    setIdentifyError(null);

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
      if (data.errors) {
        const errMsg = data.errors.map((e: { message: string }) => e.message).join(', ');
        if (errMsg.includes('Cannot return null') || errMsg.includes('non-nullable')) {
          throw new Error(t('Device not found in system for OEM ID: ') + oemItemId);
        }
        throw new Error(errMsg);
      }

      const fetchedItemId = data.data?.getItembyOemItemId?._id;
      if (fetchedItemId) {
        setItemId(fetchedItemId);
        setIdentifyError(null);
      } else {
        const msg = t('Device not found in system for OEM ID: ') + oemItemId;
        setIdentifyError(msg);
        console.error('[DeviceDetail] getItembyOemItemId returned null for oemItemId:', oemItemId);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      setIdentifyError(msg);
      console.error('[DeviceDetail] Error fetching item ID:', error);
    } finally {
      setIsIdentifying(false);
    }
  }, [attributeList, router, t]);

  useEffect(() => {
    if (!itemId) {
      fetchItemId();
    }
  }, [fetchItemId, itemId]);

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

  // Promisified single-characteristic read. Resolves null on timeout so a
  // missing native callback can't hang the post-write verify loop.
  const readCharValue = useCallback((serviceUuid: string, charUuid: string, mac: string) =>
    new Promise<string | null>((resolve) => {
      let settled = false;
      const settle = (val: string | null) => {
        if (!settled) { settled = true; resolve(val); }
      };
      const timer = setTimeout(() => settle(null), 4000);
      try {
        readBleCharacteristic(serviceUuid, charUuid, mac, (data: any) => {
          clearTimeout(timer);
          settle(data?.realVal !== null && data?.realVal !== undefined ? String(data.realVal) : null);
        });
      } catch {
        clearTimeout(timer);
        settle(null);
      }
    }), []);

  // Guards against overlapping verify loops when the user writes twice quickly.
  const verifyRunIdRef = useRef(0);

  // After a successful write, read pubk/rcrd back from the device until the
  // values change (= device applied the code) or attempts run out. The device
  // applies a valid code as soon as the BLE write is acknowledged, so the
  // first read at 1 s usually succeeds; the retries cover slower firmware.
  const verifyWriteApplied = useCallback(async (params: {
    mac: string;
    cmdServiceUuid: string;
    pubkUuid: string;
    stsServiceUuid: string | null;
    rcrdUuid: string | null;
    writtenCode: string;
    prevPubk: string | null;
    prevRcrd: string | null;
  }) => {
    const runId = ++verifyRunIdRef.current;
    const { mac, cmdServiceUuid, pubkUuid, stsServiceUuid, rcrdUuid, writtenCode, prevPubk, prevRcrd } = params;
    const delays = [1000, 2000, 4000];

    for (let attempt = 0; attempt < delays.length; attempt++) {
      await new Promise((r) => setTimeout(r, delays[attempt]));
      if (verifyRunIdRef.current !== runId) return;

      const still = sessionStorage.getItem('connectedDeviceMac');
      if (still?.trim().toLowerCase() !== mac.toLowerCase()) {
        setIsRefreshing(false);
        return;
      }

      const [pubkVal, rcrdVal] = await Promise.all([
        readCharValue(cmdServiceUuid, pubkUuid, mac),
        stsServiceUuid && rcrdUuid
          ? readCharValue(stsServiceUuid, rcrdUuid, mac)
          : Promise.resolve<string | null>(null),
      ]);
      if (verifyRunIdRef.current !== runId) return;

      // Show whatever the device reported, even if unchanged
      setUpdatedValues((prev) => {
        const next = { ...prev };
        if (pubkVal !== null) next[pubkUuid] = pubkVal;
        if (rcrdUuid && rcrdVal !== null) next[rcrdUuid] = rcrdVal;
        return next;
      });
      if (pubkVal !== null) setUpdatedValue(pubkVal);

      const applied =
        (pubkVal !== null && (pubkVal === writtenCode || pubkVal !== prevPubk)) ||
        (rcrdVal !== null && rcrdVal !== prevRcrd);
      if (applied || attempt === delays.length - 1) {
        setIsRefreshing(false);
        return;
      }
    }
  }, [readCharValue]);

  const handleRead = useCallback(() => {
    if (!cmdService || !pubkCharacteristic) return;
    const mac = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('connectedDeviceMac')?.trim() : null;
    if (!mac) {
      toast.error(t('Device not connected. Please reconnect and try again.'));
      return;
    }
    setIsLoading(true);
    readBleCharacteristic(
      cmdService.uuid,
      pubkCharacteristic.uuid,
      mac,
      (data: any) => {
        setIsLoading(false);
        if (data) {
          setUpdatedValue(data.realVal);
          setUpdatedValues((prev) => ({ ...prev, [pubkCharacteristic.uuid]: data.realVal }));
        }
      }
    );
  }, [cmdService, pubkCharacteristic, device.macAddress, t]);

  const readRcrd = useCallback(() => {
    if (!stsService || !rcrdCharacteristic) return;
    const mac = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('connectedDeviceMac')?.trim() : null;
    if (!mac) return;
    readBleCharacteristic(
      stsService.uuid,
      rcrdCharacteristic.uuid,
      mac,
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

    // Capture pre-write values before the optimistic update below, so the
    // verify loop can detect when the device has actually applied the code
    const prevPubkValue = foundPubk.realVal !== null && foundPubk.realVal !== undefined
      ? String(foundPubk.realVal) : null;
    const prevRcrdValue = rcrdCharacteristic?.realVal !== null && rcrdCharacteristic?.realVal !== undefined
      ? String(rcrdCharacteristic.realVal) : null;

    setUpdatedValues((prev) => ({ ...prev, [foundPubk.uuid]: codeDec }));
    setActiveCharacteristic(foundPubk);
    setUpdatedValue(codeDec);

    const connectedMac =
      typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('connectedDeviceMac') : null;
    const targetMac = device.macAddress?.trim();
    if (
      !connectedMac ||
      !targetMac ||
      connectedMac.trim().toLowerCase() !== targetMac.toLowerCase()
    ) {
      setResult((prev) => ({ ...prev, status: 'writeFailed', error: t('Device not connected') }));
      return;
    }

    setResult((prev) => ({ ...prev, status: 'writing' }));

    writeBleCharacteristic(
      foundCmdService.uuid,
      foundPubk.uuid,
      codeDec,
      connectedMac!.trim(),
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
          // Show the updating spinner immediately, then read pubk/rcrd back
          // directly. Direct characteristic reads avoid the full service
          // re-init path, whose two concurrent CMD+STS requests raced each
          // other and could leave Remaining Days stale until reconnect.
          setIsRefreshing(true);
          verifyWriteApplied({
            mac: targetMac,
            cmdServiceUuid: foundCmdService.uuid,
            pubkUuid: foundPubk.uuid,
            stsServiceUuid: stsService?.uuid ?? null,
            rcrdUuid: rcrdCharacteristic?.uuid ?? null,
            writtenCode: codeDec,
            prevPubk: prevPubkValue,
            prevRcrd: prevRcrdValue,
          });
        } else {
          setResult((prev) => ({ ...prev, status: 'writeFailed', error: errorMessage || 'Write operation failed' }));
        }
      }
    );
  }, [attributeList, device.macAddress, stsService, rcrdCharacteristic, verifyWriteApplied, t]);

  const [customDays, setCustomDays] = useState('');
  const [selectedChip, setSelectedChip] = useState<number | 'custom' | null>(null);
  const [lastCode, setLastCode] = useState<LastCode | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [confirmFor, setConfirmFor] = useState<'free' | 'reset' | null>(null);

  const handleSelectChip = (chip: number | 'custom') => {
    setSelectedChip(chip);
    if (chip === 'custom') {
      const parsed = parseInt(customDays, 10);
      setDuration(parsed > 0 ? parsed : null);
    } else {
      setDuration(chip);
    }
  };

  const handleCustomChange = (raw: string) => {
    const val = raw.replace(/\D/g, '');
    setCustomDays(val);
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

  // Trigger write only after React has re-rendered with the latest attributeList.
  // Calling writeCodeToDevice directly inside the async runCodeOperation captures a
  // stale closure: if CMD_SERVICE data finishes loading while the API call is in-flight,
  // the captured writeCodeToDevice still sees the old attributeList and fails to find
  // CMD_SERVICE, producing an intermittent "CMD service not available" writeFailed.
  useEffect(() => {
    if (result.status === 'generated' && result.codeDec) {
      writeCodeToDevice(result.codeDec);
    }
  // writeCodeToDevice is a useCallback that depends on attributeList, so this
  // always uses the freshest service data available at render time.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.status, result.codeDec]);

  // After a confirmed write, remember the code and let the result card settle
  // into the compact "last code" row after a short dwell.
  useEffect(() => {
    if (result.status === 'written' && result.codeDec && result.codeType) {
      setLastCode({ codeDec: result.codeDec, codeType: result.codeType, at: Date.now() });
      const id = setTimeout(() => setResult(INITIAL_RESULT), 10_000);
      return () => clearTimeout(id);
    }
  }, [result.status, result.codeDec, result.codeType]);

  const runCodeOperation = async (codeType: CodeType, apiCall: () => Promise<string>) => {
    setResult({ status: 'generating', codeType, codeDec: null, error: null });
    try {
      const codeDec = await apiCall();
      // Setting 'generated' triggers the useEffect above to call writeCodeToDevice
      // with the latest attributeList, avoiding the stale-closure race condition.
      setResult({ status: 'generated', codeType, codeDec, error: null });
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
      if (identifyError) {
        setResult({ status: 'error', codeType: 'days', codeDec: null, error: identifyError });
      } else if (isIdentifying) {
        toast.loading(t('Identifying device, please wait...'), { duration: 2000 });
      } else {
        fetchItemId();
        setResult({ status: 'error', codeType: 'days', codeDec: null, error: t('Device identification in progress. Please try again in a moment.') });
      }
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
      if (identifyError) {
        setResult({ status: 'error', codeType: 'free', codeDec: null, error: identifyError });
      } else if (isIdentifying) {
        toast.loading(t('Identifying device, please wait...'), { duration: 2000 });
      } else {
        fetchItemId();
        setResult({ status: 'error', codeType: 'free', codeDec: null, error: t('Device identification in progress. Please try again in a moment.') });
      }
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
      if (identifyError) {
        setResult({ status: 'error', codeType: 'reset', codeDec: null, error: identifyError });
      } else if (isIdentifying) {
        toast.loading(t('Identifying device, please wait...'), { duration: 2000 });
      } else {
        fetchItemId();
        setResult({ status: 'error', codeType: 'reset', codeDec: null, error: t('Device identification in progress. Please try again in a moment.') });
      }
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
      if (identifyError) {
        setResult({ status: 'error', codeType: 'retrieve', codeDec: null, error: identifyError });
      } else if (isIdentifying) {
        toast.loading(t('Identifying device, please wait...'), { duration: 2000 });
      } else {
        fetchItemId();
        setResult({ status: 'error', codeType: 'retrieve', codeDec: null, error: t('Device identification in progress. Please try again in a moment.') });
      }
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

  const handleConfirmOtherCode = () => {
    if (confirmFor === 'free') handleGenerateFreeCode();
    else if (confirmFor === 'reset') handleGenerateResetCode();
  };

  const handleTryAgain = () => {
    if (result.codeType === 'days') handleGenerateDaysCode();
    else if (result.codeType === 'free') handleGenerateFreeCode();
    else if (result.codeType === 'reset') handleGenerateResetCode();
    else if (result.codeType === 'retrieve') handleRetrieveCodes();
  };

  // Re-write the last known code through the normal generated→write pathway
  const handleResend = () => {
    if (!lastCode || isBusy) return;
    setResult({ status: 'generated', codeType: lastCode.codeType, codeDec: lastCode.codeDec, error: null });
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(t('Code copied to clipboard'));
  };

  const handleWriteClick = () => {
    if (!pubkCharacteristic) return;
    setActiveCharacteristic(pubkCharacteristic);
    setAsciiModalOpen(true);
  };

  const handleWrite = (value: string) => {
    if (!activeCharacteristic || !cmdService) return;
    const connectedMac =
      typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('connectedDeviceMac') : null;
    const targetMac = device.macAddress?.trim();
    if (
      !connectedMac ||
      !targetMac ||
      connectedMac.trim().toLowerCase() !== targetMac.toLowerCase()
    ) {
      toast.error(t('Device not connected. Please reconnect and try again.'));
      return;
    }
    writeBleCharacteristic(
      cmdService.uuid,
      activeCharacteristic.uuid,
      value,
      connectedMac!.trim(),
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
      <ConfirmModal
        isOpen={confirmFor !== null}
        onClose={() => setConfirmFor(null)}
        onConfirm={handleConfirmOtherCode}
        title={confirmFor === 'free' ? t('Generate Free Code?') : t('Generate Reset Code?')}
        message={confirmFor === 'free'
          ? t('A Free Code unlocks the device permanently, removing all payment restrictions. Continue?')
          : t('A Reset Code restores the device to its default locked state. Continue?')}
        confirmLabel={t('Generate')}
      />


      {/* Device Info */}
      <div className="flex flex-col items-center p-6 pb-3">
        <img src={device.imageUrl} alt={device.name || 'Device'} className="w-32 h-32 object-contain mb-3" />
        <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{device.name || t('Unknown Device')}</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{device.macAddress || t('Unknown MAC')}</p>
      </div>

      <div className="p-4 max-w-md mx-auto">
        <StatusCard
          hasRcrd={!!rcrdCharacteristic}
          remainingDays={remainingDays != null ? String(remainingDays) : null}
          hasPubk={!!pubkCharacteristic}
          pubkValue={pubkValue != null ? String(pubkValue) : null}
          isRefreshing={isRefreshing}
          onCopy={handleCopyCode}
        />

        {/* Device Identification Status */}
        {!itemId && (
          <div
            className="rounded-xl p-3 mb-4 flex items-center gap-3"
            style={{
              background: identifyError ? 'var(--color-error-soft, rgba(239,68,68,0.08))' : 'var(--bg-secondary)',
              border: `1px solid ${identifyError ? 'var(--color-error)' : 'var(--border)'}`,
            }}
          >
            {isIdentifying ? (
              <>
                <Loader2 size={16} className="animate-spin" style={{ color: 'var(--accent)' }} />
                <span className="text-xs flex-1" style={{ color: 'var(--text-secondary)' }}>{t('Identifying device...')}</span>
              </>
            ) : identifyError ? (
              <>
                <AlertCircle size={16} style={{ color: 'var(--color-error)' }} />
                <span className="text-xs flex-1" style={{ color: 'var(--color-error)' }}>{identifyError}</span>
                <button
                  className="text-xs font-semibold px-3 py-1 rounded-lg flex-shrink-0"
                  style={{ color: 'var(--accent)', background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
                  onClick={fetchItemId}
                >
                  {t('Retry')}
                </button>
              </>
            ) : (
              <>
                <AlertCircle size={16} style={{ color: 'var(--text-muted)' }} />
                <span className="text-xs flex-1" style={{ color: 'var(--text-muted)' }}>{t('Waiting for device identification...')}</span>
              </>
            )}
          </div>
        )}

        <AddDaysCard
          selectedChip={selectedChip}
          customDays={customDays}
          duration={duration}
          isBusy={isBusy}
          busyActive={isBusy && result.codeType === 'days'}
          onSelectChip={handleSelectChip}
          onCustomChange={handleCustomChange}
          onGenerate={handleGenerateDaysCode}
        />

        <ResultZone
          result={result}
          lastCode={lastCode}
          remainingDays={remainingDays != null ? String(remainingDays) : null}
          isRefreshing={isRefreshing}
          onRetrieve={handleRetrieveCodes}
          onRetryWrite={handleRetryWrite}
          onTryAgain={handleTryAgain}
          onResend={handleResend}
          onCopy={handleCopyCode}
        />

        <OtherCodes
          isBusy={isBusy}
          busyType={isBusy ? result.codeType : null}
          onRequest={setConfirmFor}
        />

        <AdvancedPanel
          open={advancedOpen}
          onToggle={() => setAdvancedOpen((v) => !v)}
          cmdService={cmdService}
          pubkCharacteristic={pubkCharacteristic}
          pubkValue={pubkValue != null ? String(pubkValue) : null}
          isLoadingService={isLoadingService ?? null}
          serviceLoadingProgress={serviceLoadingProgress}
          isReading={isLoading}
          onRead={handleRead}
          onWrite={handleWriteClick}
          onRefreshService={handleRefreshService}
          translateDescription={translateDescription}
        />

      </div>
    </div>
  );
};

export default DeviceDetailView;
