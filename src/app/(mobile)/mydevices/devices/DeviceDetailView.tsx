'use client'

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { readBleCharacteristic, writeBleCharacteristic } from '../../../utils';
import { Toaster, toast } from 'react-hot-toast';
import { ArrowLeft, Share2, RefreshCw, Clipboard } from 'lucide-react';
import { AsciiStringModal, NumericModal } from '../../../modals';
import HeartbeatView from '@/components/HeartbeatView';
import { apiUrl } from '@/lib/apollo-client';

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
  const [activeTab, setActiveTab] = useState('ATT');
  const [duration, setDuration] = useState<number | null>(null); // State for selected duration
  const [isSubmitting, setIsSubmitting] = useState(false); // State for submit button loading
  const [generatedCode, setGeneratedCode] = useState<string | null>(null); // State for generated code

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

  const activeService = attributeList.find((service) =>
    fixedTabs.find((tab) => tab.id === activeTab && tab.serviceNameEnum === service.serviceNameEnum)
  );

  //   // Extract device ID (opid) from ATT_SERVICE
  const getDeviceId = () => {
    const attService = attributeList.find((service) => service.serviceNameEnum === 'ATT_SERVICE');
    if (attService) {
      const opidChar = attService.characteristicList.find((char: any) => char.name === 'opid');
      return opidChar?.realVal || null;
    }
    return null;
  };

  const deviceId = getDeviceId();
//   const deviceId = "682723d820b71f316040a137";
  // const deviceId = "682723d820b71f316040a137";

  const isServiceLoaded = (serviceNameEnum: string) => {
    return attributeList.some((service) => service.serviceNameEnum === serviceNameEnum);
  };

  const handleBack = () => (onBack ? onBack() : router.back());

  const formatValue = (characteristic: any) => {
    if (typeof characteristic.realVal === 'number') {
      switch (characteristic.valType) {
        case 0:
          return characteristic.realVal;
        case 1:
          return `${characteristic.realVal} mA`;
        case 2:
          return `${characteristic.realVal} mV`;
        default:
          return characteristic.realVal;
      }
    }
    return characteristic.realVal || 'N/A';
  };

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    const tab = fixedTabs.find((t) => t.id === tabId);
    if (!tab || !tab.serviceNameEnum || tabId === 'HEARTBEAT') return;
    const serviceNameEnum = tab.serviceNameEnum;
    if (!isServiceLoaded(serviceNameEnum) && onRequestServiceData) {
      onRequestServiceData(tabId);
    }
  };

  const handleRead = (serviceUuid: string, characteristicUuid: string, name: string) => {
    setLoadingStates((prev) => ({ ...prev, [characteristicUuid]: true }));
    readBleCharacteristic(serviceUuid, characteristicUuid, device.macAddress, (data: any, error: any) => {
      setLoadingStates((prev) => ({ ...prev, [characteristicUuid]: false }));
      if (data) {
        console.info(data.realVal, 'Value of Field');
        toast.success(`${name} read successfully`);
        setUpdatedValues((prev) => ({
          ...prev,
          [characteristicUuid]: data.realVal,
        }));
      } else {
        console.error('Error Reading Characteristics');
        toast.error(`Failed to read ${name}`);
      }
    });
  };

  const handleWriteClick = (characteristic: any) => {
    setActiveCharacteristic(characteristic);
    if (characteristic.name.toLowerCase().includes('pubk')) {
      setAsciiModalOpen(true);
    } else {
      setNumericModalOpen(true);
    }
  };

  const handleWrite = (value: string | number) => {
  const cmdService = attributeList.find((service) => service.serviceNameEnum === 'CMD_SERVICE');
  if (!cmdService) {
    console.error('CMD_SERVICE not found');
    return;
  }
  console.info('cmdService:', cmdService);

  const pubkCharacteristic = cmdService.characteristicList.find(
    (char: any) => char.name.toLowerCase() === 'pubk'
  );
  if (!pubkCharacteristic) {
    console.error('pubk characteristic not found');
    return;
  }
  console.info('pubkCharacteristic:', pubkCharacteristic.name);

  console.info({
    action: 'write',
    serviceUuid: cmdService.uuid,
    characteristicUuid: pubkCharacteristic.uuid,
    macAddress: device.macAddress,
    name: device.name,
    value: value,
  });

  writeBleCharacteristic(
    cmdService.uuid,
    pubkCharacteristic.uuid,
    value,
    device.macAddress,
    (data: any, error: any) => {
      console.info({ data: data, error: error });
      if (data) {
        console.info(data, 'Is Data 123');
      }
    }
  );

  toast.success(`Value written to ${pubkCharacteristic.name}`);
  setTimeout(() => {
    handleRead(cmdService.uuid, pubkCharacteristic.uuid, device.name);
  }, 1000);
};
  const handleRefreshService = () => {
    if (!activeTab || !onRequestServiceData) return;
    onRequestServiceData(activeTab);
  };

  // Handle duration selection
  const handleDurationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDuration(Number(e.target.value));
  };

  // Handle submit to microservice
const handleSubmit = async () => {
  if (!deviceId) {
    toast.error('Device ID not available');
    return;
  }
  if (!duration) {
    toast.error('Please select a duration');
    return;
  }
  if (!Number.isInteger(duration) || duration < 0) {
    toast.error('Duration must be a positive integer');
    return;
  }

  setIsSubmitting(true);

  try {
    const authToken = localStorage.getItem('access_token');
    if (!authToken) {
      toast.error('Please sign in to generate a code');
      router.push('/signin');
      return;
    }

    const query = `
      mutation {
        generateDaysCodeForItem(generateDaysCodeInput: {
          itemId: "${deviceId}",
          codeDays: ${duration}
        }) {
          codeType
          codeHex
          codeDec
        }
      }
    `;

    console.info('Sending GraphQL request:', { query });

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ query }),
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

    const { generateDaysCodeForItem } = responseData.data;
    if (!generateDaysCodeForItem) {
      throw new Error('No data returned from generateDaysCodeForItem');
    }

    const { codeType, codeHex, codeDec } = generateDaysCodeForItem;

    setGeneratedCode(codeDec);
    console.info('GraphQL response values:', { codeType, codeHex, codeDec });
    toast.success(`Code: ${codeDec} generated Successfully`, { duration: 1000 });
    console.info(`Code generated - Type: ${codeType}, Hex: ${codeHex}, Decimal: ${codeDec}`, {
      duration: 20000,
    });

    const valueToWrite = String(codeDec);
    console.info('attributeList:', attributeList);
    const cmdService = attributeList.find((service) => service.serviceNameEnum === 'CMD_SERVICE');
    if (cmdService) {
      console.info('cmdService:', cmdService);
      const pubkCharacteristic = cmdService.characteristicList.find(
        (char: any) => char.name.toLowerCase() === 'pubk'
      );
      console.info('pubkCharacteristic:', pubkCharacteristic?.name);
      if (pubkCharacteristic) {
        setActiveCharacteristic(pubkCharacteristic);
        handleWrite(valueToWrite);
      } else {
        toast.error('pubk characteristic not found in CMD service');
      }
    } else {
      toast.error('CMD service not available');
    }
  } catch (error) {
    console.error('Error generating code:', error);
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    toast.error(`Failed to generate code: ${message}`);
  } finally {
    setIsSubmitting(false);
  }
};
  return (
    <div className="max-w-md mx-auto bg-gradient-to-b from-[#24272C] to-[#0C0C0E] min-h-screen text-white">
      <Toaster />
      <AsciiStringModal
        isOpen={asciiModalOpen}
        onClose={() => setAsciiModalOpen(false)}
        onSubmit={(value) => handleWrite(value)}
        title={activeCharacteristic?.name || 'Public Key / Last Code'}
      />
      <NumericModal
        isOpen={numericModalOpen}
        onClose={() => setNumericModalOpen(false)}
        onSubmit={(value) => handleWrite(value)}
        title={activeCharacteristic?.name || 'Read'}
      />
      <div className="p-4 flex items-center">
        <button onClick={handleBack} className="mr-4">
          <ArrowLeft className="w-6 h-6 text-gray-400" />
        </button>
        <h1 className="text-lg font-semibold flex-1">Device Details</h1>
        <Share2 className="w-5 h-5 text-gray-400" />
      </div>
      <div className="flex flex-col items-center p-6 pb-2">
        <img
          src={device.imageUrl}
          alt={device.name || 'Device'}
          className="w-40 h-40 object-contain mb-4"
        />
        <h2 className="text-xl font-semibold">{device.name || 'Unknown Device'}</h2>
        <p className="text-sm text-gray-400 mt-1">{device.macAddress || 'Unknown MAC'}</p>
        <p className="text-sm text-gray-400 mt-1">{device.rssi || 'Unknown RSSI'}</p>
        {/* {deviceId && (
          <p className="text-sm text-gray-400 mt-1">Device ID: {deviceId}</p>
        )} */}
      </div>
      <div className="border-b border-gray-800">
        <div className="flex justify-between px-1">
          {fixedTabs.map((tab) => {
            const serviceLoaded = tab.serviceNameEnum ? isServiceLoaded(tab.serviceNameEnum) : true;
            return (
              <button
                key={tab.id}
                className={`py-3 px-3 text-sm font-medium relative ${activeTab === tab.id ? 'text-blue-500' : 'text-gray-400'
                  } ${isLoadingService === tab.id ? 'animate-pulse' : ''}`}
                onClick={() => handleTabChange(tab.id)}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500" />
                )}
                {!serviceLoaded && tab.id === activeTab && tab.id !== 'HEARTBEAT' && (
                  <div className="absolute top-1 right-0 w-2 h-2 bg-yellow-500 rounded-full"></div>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div className="p-4">
        {isLoadingService === activeTab && (
          <div className="w-full bg-gray-800 h-1 mb-4 rounded-full overflow-hidden">
            <div
              className="bg-blue-500 h-full transition-all duration-300 ease-in-out"
              style={{ width: `${serviceLoadingProgress}%` }}
            ></div>
          </div>
        )}
        {activeTab === 'HEARTBEAT' ? (
          <HeartbeatView
            attributeList={attributeList}
            onRequestServiceData={onRequestServiceData || (() => { })}
            isLoading={isLoadingService !== null}
            handlePublish={handlePublish}
            initialDataLoadedRef={initialDataLoadedRef}
            heartbeatSentRef={heartbeatSentRef}
          />
        ) : (
          <>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-white">{activeTab} Service</h3>
              <button
                onClick={handleRefreshService}
                className="flex items-center space-x-1 bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded-md text-sm transition-colors"
                disabled={isLoadingService !== null}
              >
                <RefreshCw size={14} className={isLoadingService ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>
            </div>
            {/* Duration Selection and Submit Button - Only on CMD Tab */}
            {activeTab === 'CMD' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Select Duration
                </label>
                <div className="w-full border border-gray-700 bg-gray-800 rounded-lg overflow-hidden">
                  <label className={`flex items-center w-full px-4 py-2 ${duration === 1 ? 'bg-gray-700' : ''}`}>
                    <input
                      type="radio"
                      name="duration"
                      value="1"
                      checked={duration === 1}
                      onChange={() => setDuration(1)}
                      className="mr-2"
                    />
                    1 Day
                  </label>
                  <label className={`flex items-center w-full px-4 py-2 ${duration === 3 ? 'bg-gray-700' : ''}`}>
                    <input
                      type="radio"
                      name="duration"
                      value="3"
                      checked={duration === 3}
                      onChange={() => setDuration(3)}
                      className="mr-2"
                    />
                    3 Days
                  </label>
                </div>
                <button
                  className={`w-full px-4 py-2 mt-2 rounded-lg text-white text-sm transition-colors ${isSubmitting || !duration
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  onClick={handleSubmit}
                  disabled={isSubmitting || !duration}
                >
                  {isSubmitting ? 'Generating Code...' : 'Generate Code'}
                </button>
              </div>
            )}
            {activeService ? (
              <div className="space-y-4">
                {activeService.characteristicList.map((char: any) => (
                  <div key={char.uuid} className="border border-gray-700 rounded-lg overflow-hidden">
                    <div className="flex justify-between items-center bg-gray-800 px-4 py-2">
                      <span className="text-sm font-medium">{char.name}</span>
                      <div className="flex space-x-2">
                        <button
                          className={`text-xs ${loadingStates[char.uuid] ? 'bg-gray-500' : 'bg-gray-700 hover:bg-gray-600'
                            } px-3 py-1 rounded transition-colors`}
                          onClick={() => handleRead(activeService.uuid, char.uuid, char.name)}
                          disabled={loadingStates[char.uuid]}
                        >
                          {loadingStates[char.uuid] ? 'Reading...' : 'Read'}
                        </button>
                        {activeTab === 'CMD' && (
                          <button
                            className="text-xs bg-blue-700 px-3 py-1 rounded hover:bg-blue-600 transition-colors"
                            onClick={() => handleWriteClick(char)}
                          >
                            Write
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="p-4 space-y-2">
                      <div>
                        <p className="text-xs text-gray-400">Description</p>
                        <p className="text-sm">{char.desc}</p>
                      </div>
                      <div className="flex items-center justify-between group">
                        <div className="flex-grow">
                          <p className="text-xs text-gray-400">Current Value</p>
                          <p className="text-sm font-mono">
                            {updatedValues[char.uuid] !== undefined
                              ? updatedValues[char.uuid]
                              : formatValue(char)}
                          </p>
                        </div>
                        <button
                          className="p-2 text-gray-400 hover:text-blue-500 focus:text-blue-500 transition-colors"
                          onClick={() => {
                            const valueToCopy =
                              updatedValues[char.uuid] !== undefined
                                ? updatedValues[char.uuid]
                                : formatValue(char);
                            navigator.clipboard.writeText(String(valueToCopy));
                            toast.success('Value copied to clipboard');
                          }}
                          aria-label="Copy to clipboard"
                        >
                          <Clipboard size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-gray-400">
                {isLoadingService === activeTab ? (
                  <p>Loading {activeTab} service data...</p>
                ) : (
                  <div>
                    <p>No data available for this service</p>
                    {onRequestServiceData && (
                      <button
                        onClick={() => onRequestServiceData(activeTab)}
                        className="mt-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-md text-white text-sm transition-colors"
                      >
                        Load {activeTab} Service Data
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default DeviceDetailView;