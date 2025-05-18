
'use client'

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { readBleCharacteristic, writeBleCharacteristic } from '../../../utils';
import { Toaster, toast } from 'react-hot-toast';
import { AsciiStringModal, NumericModal } from '../../../modals';

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
  const [updatedValues, setUpdatedValues] = useState<Record<string, any>>({});
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const [asciiModalOpen, setAsciiModalOpen] = useState(false);
  const [numericModalOpen, setNumericModalOpen] = useState(false);
  const [activeCharacteristic, setActiveCharacteristic] = useState<any>(null);
  const [pubkValue, setPubkValue] = useState<string | null>(null);
  const [rcrdValue, setRcrdValue] = useState<string | null>(null);


  /* ------------------------------------------------------------------ */
  /*        Memoised lookup for CMD_SERVICE/pubk & STS_SERVICE/rcrd      */
  /* ------------------------------------------------------------------ */
  const {
    cmdService,
    pubkCharacteristic,
    stsService,
    rcrdCharacteristic,
  } = useMemo(() => {
    const foundCmd = attributeList.find(
      (service) => service.serviceNameEnum === 'CMD_SERVICE'
    );

    const foundSts = attributeList.find(
      (service) => service.serviceNameEnum === 'STS_SERVICE'
    );

    const pubkChar =
      foundCmd?.characteristicList?.find((c: any) => c.name.toLowerCase() === 'pubk') ??
      null;

    const rcrdChar =
      foundSts?.characteristicList?.find((c: any) => c.name.toLowerCase() === 'rcrd') ??
      null;

    return {
      cmdService: foundCmd ?? null,
      pubkCharacteristic: pubkChar,
      stsService: foundSts ?? null,
      rcrdCharacteristic: rcrdChar,
    };
  }, [attributeList]);


  useEffect(() => {
    if (onRequestServiceData) {
      onRequestServiceData('CMD');
      onRequestServiceData('STS');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    const servicesDone = isLoadingService === null && !loadingStates['CMD'] && !loadingStates['STS'];

    if (servicesDone) {
      if (pubkCharacteristic) setPubkValue(pubkCharacteristic.realVal);
      if (rcrdCharacteristic) setRcrdValue(rcrdCharacteristic.realVal);
    }
  }, [isLoadingService, loadingStates, pubkCharacteristic, rcrdCharacteristic]);


  const formatValue = (characteristic: any) => {
    if (typeof characteristic?.realVal === 'number') {
      switch (characteristic.valType) {
        case 1:
          return `${characteristic.realVal} mA`;
        case 2:
          return `${characteristic.realVal} mV`;
        default:
          return characteristic.realVal;
      }
    }
    return characteristic?.realVal ?? 'N/A';
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
          toast.error(`Failed to read ${name}`);
        }
      }
    );
  };

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
        // setTimeout(() =>
        //   handleRead(cmdService.uuid, activeCharacteristic.uuid, device.name)
        //   handleRead(stsService.uuid, rcrdCharacteristic.uuid, device.name)
        // 1000);
        setTimeout(() => {
          handleRead(cmdService.uuid, activeCharacteristic.uuid, device.name);
          handleRead(stsService.uuid, rcrdCharacteristic.uuid, device.name);
        }, 1000);
      }
    );
  };


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

      {/* ---------- Credentials block ---------- */}
      {(pubkCharacteristic || rcrdCharacteristic) && (
        <div className="p-4">
          <h3 className="text-lg font-medium mb-2">Device Credentials</h3>
          <div className="grid grid-cols-2 gap-4 text-sm font-mono break-all">
            {pubkCharacteristic && (
              <div>
                <span className="font-semibold">pubk: </span>
                {updatedValues[pubkCharacteristic.uuid] ?? formatValue(pubkCharacteristic)}
              </div>
            )}
            {rcrdCharacteristic && (
              <div>
                <span className="font-semibold">rcrd: </span>
                {updatedValues[rcrdCharacteristic.uuid] ?? formatValue(rcrdCharacteristic)}
              </div>
            )}
          </div>

          {/* Optional write / read buttons for pubk (rcrd is read‑only) */}
          {pubkCharacteristic && (
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => handleWriteClick(pubkCharacteristic)}
                className="bg-blue-600 px-4 py-2 rounded-md"
              >
                Write pubk
              </button>
            </div>
          )}
        </div>
      )}

      {/* ---------- Rest of the component: tabs, characteristics, etc. ---------- */}
      {/* ... existing rendering for tabs, HeartbeatView, other characteristics ... */}
    </div>
  );
};

export default DeviceDetailView;
