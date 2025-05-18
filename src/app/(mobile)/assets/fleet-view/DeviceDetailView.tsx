
'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { readBleCharacteristic, writeBleCharacteristic } from '../../../utils';
import { Toaster, toast } from 'react-hot-toast';
import { ArrowLeft, Share2, RefreshCw } from 'lucide-react';
import { AsciiStringModal, NumericModal } from '../../../modals';
import { Clipboard } from 'lucide-react';
import HeartbeatView from '@/components/HeartbeatView';

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
  handlePublish?: (attributeList: any, serviceType: string) => void;
}

const DeviceDetailView: React.FC<DeviceDetailProps> = ({
  device,
  attributeList,
  onBack,
  onRequestServiceData,
  isLoadingService,
  serviceLoadingProgress = 0,
  handlePublish,
}) => {
  const router = useRouter();
  const [updatedValues, setUpdatedValues] = useState<{ [key: string]: any }>({});
  const [loadingStates, setLoadingStates] = useState<{ [key: string]: boolean }>({});
  const [asciiModalOpen, setAsciiModalOpen] = useState(false);
  const [numericModalOpen, setNumericModalOpen] = useState(false);
  const [activeCharacteristic, setActiveCharacteristic] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('CMD');
  const [pubkValue, setPubkValue] = useState<string | null>(null);

  // Persist initial data load and heartbeat sent state across HeartbeatView mounts
  const initialDataLoadedRef = useRef<boolean>(false);
  const heartbeatSentRef = useRef<boolean>(false);

  const fixedTabs = [
    { id: 'ATT', label: 'ATT', serviceNameEnum: 'ATT_SERVICE' },
    { id: 'CMD', label: 'CMD', serviceNameEnum: 'CMD_SERVICE' },
    { id: 'STS', label: 'STS', serviceNameEnum: 'STS_SERVICE' },
    { id: 'DTA', label: 'DTA', serviceNameEnum: 'DTA_SERVICE' },
    { id: 'DIA', label: 'DIA', serviceNameEnum: 'DIA_SERVICE' },
    { id: 'HEARTBEAT', label: 'HB', serviceNameEnum: null },
  ];

  /* ------------------------------------------------------------------ */
  /*               Memoised lookup for CMD_SERVICE & pubk               */
  /* ------------------------------------------------------------------ */
  const { cmdService, pubkCharacteristic } = useMemo(() => {
    const foundCmd = attributeList.find(
      (service) => service.serviceNameEnum === 'CMD_SERVICE'
    );
    const pubkChar =
      foundCmd?.characteristicList?.find(
        (c: any) => c.name.toLowerCase() === 'pubk'
      ) ?? null;

    return { cmdService: foundCmd ?? null, pubkCharacteristic: pubkChar };
  }, [attributeList]);

  /* ------------------------------------------------------------------ */
  /*                    One-time fetch for CMD + STS                    */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (onRequestServiceData) {
      onRequestServiceData('CMD');
      onRequestServiceData('STS');
    }
  }, []);

  /* ------------------------------------------------------------------ */
  /*          When loading completes, extract the initial pubk          */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (
      isLoadingService === null &&
      !loadingStates['CMD'] &&
      !loadingStates['STS'] &&
      pubkCharacteristic
    ) {
      setPubkValue(pubkCharacteristic.realVal);
    }
  }, [isLoadingService, loadingStates, pubkCharacteristic]);

  /* ------------------------------------------------------------------ */
  /*                         Helper functions                           */
  /* ------------------------------------------------------------------ */
  const isServiceLoaded = (serviceNameEnum: string) =>
    attributeList.some((s) => s.serviceNameEnum === serviceNameEnum);

  const handleBack = () => (onBack ? onBack() : router.back());

  const formatValue = (characteristic: any) => {
    if (typeof characteristic.realVal === 'number') {
      switch (characteristic.valType) {
        case 1:
          return `${characteristic.realVal} mA`;
        case 2:
          return `${characteristic.realVal} mV`;
        default:
          return characteristic.realVal;
      }
    }
    return characteristic.realVal ?? 'N/A';
  };

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    const tab = fixedTabs.find((t) => t.id === tabId);
    if (!tab?.serviceNameEnum || tabId === 'HEARTBEAT') return;

    if (!isServiceLoaded(tab.serviceNameEnum) && onRequestServiceData) {
      onRequestServiceData(tabId);
    }
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
          toast.success(`${name} read successfully`);
          setUpdatedValues((prev) => ({ ...prev, [characteristicUuid]: data.realVal }));
        } else {
          toast.error(`Failed to read ${name}`);
        }
      }
    );
  };

  // const handleWriteClick = (characteristic: any) => {
  //   setActiveCharacteristic(characteristic);

  //   characteristic.name.toLowerCase().includes('pubk')
  //     ? setAsciiModalOpen(true)
  //     : setNumericModalOpen(true);
  // };

    const handleWriteClick = (characteristic: any) => {
    setActiveCharacteristic(characteristic);

    // Determine which modal to open based on characteristic name
    if (characteristic.name.toLowerCase().includes('pubk')) {
      setAsciiModalOpen(true);
    } else {
      setNumericModalOpen(true);
    }
  };

  const handleWrite = (value: string | number) => {
    if (!activeCharacteristic || !cmdService) return;

    writeBleCharacteristic(
      cmdService.uuid,
      activeCharacteristic.uuid,
      value,
      device.macAddress,
      () => {
        toast.success(`Value written to ${activeCharacteristic.name}`);
        // Refresh value after write
        setTimeout(
          () => handleRead(cmdService.uuid, activeCharacteristic.uuid, device.name),
          1000
        );
      }
    );
  };

  const handleRefreshService = () => {
    if (activeTab && onRequestServiceData) onRequestServiceData(activeTab);
  };

  /* ------------------------------------------------------------------ */
  /*                              Render                                */
  /* ------------------------------------------------------------------ */
  return (
    <div className="max-w-md mx-auto bg-gradient-to-b from-[#24272C] to-[#0C0C0E] min-h-screen text-white">
      <Toaster />

      {/* ---------- Modals ---------- */}
      <AsciiStringModal
        isOpen={asciiModalOpen}
        onClose={() => setAsciiModalOpen(false)}
        onSubmit={handleWrite}
        title={activeCharacteristic?.name || 'Public Key / Last Code'}
      />
      <NumericModal
        isOpen={numericModalOpen}
        onClose={() => setNumericModalOpen(false)}
        onSubmit={handleWrite}
        title={activeCharacteristic?.name || 'Write'}
      />

      {/* ---------- Pubk block ---------- */}
      {cmdService && pubkCharacteristic && (
        <div className="p-4">
          <h3 className="text-lg font-medium">Public Key (pubk)</h3>
          <p className="text-sm font-mono break-all">
            {updatedValues[pubkCharacteristic.uuid] ?? formatValue(pubkCharacteristic)}
          </p>

          <div className="flex gap-2 mt-2">
            <button
              onClick={() => handleWriteClick(pubkCharacteristic)}
              className="bg-blue-600 px-4 py-2 rounded-md"
            >
              Write
            </button>
            {/* <button
              onClick={() =>
                handleRead(cmdService.uuid, pubkCharacteristic.uuid, 'pubk')
              }
              className="bg-gray-700 px-4 py-2 rounded-md"
            >
              Read
            </button> */}
          </div>
        </div>
      )}

      {/* ---------- Whatever else you were rendering ---------- */}
      {/* Example: tabs, other characteristics, heartbeat view, etc. */}
    </div>
  );
};

export default DeviceDetailView;
