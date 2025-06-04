'use client'

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { readBleCharacteristic, writeBleCharacteristic } from '../../../utils';
import { Toaster, toast } from 'react-hot-toast';
import { ArrowLeft, Share2, RefreshCw, Clipboard } from 'lucide-react';
import { AsciiStringModal, NumericModal } from '../../../modals';
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
  const [activeTab, setActiveTab] = useState('CMD');
  const [duration, setDuration] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [codeEvents, setCodeEvents] = useState<
    { _id: string; codeDecString: string; codeHexString: string; createdAt: string; codeDays: number }[]
  >([]);
  const [isRetrieving, setIsRetrieving] = useState(false);

  const initialDataLoadedRef = useRef<boolean>(false);
  const heartbeatSentRef = useRef<boolean>(false);

  const fixedTabs = [
    { id: 'CMD', label: 'CMD', serviceNameEnum: 'CMD_SERVICE' },
  ];

  useEffect(() => {
    console.log('isLoadingService:', isLoadingService);
    console.log('serviceLoadingProgress:', serviceLoadingProgress);
    console.log('attributeList:', attributeList);
    if (onRequestServiceData) {
      if (!attributeList.some((service) => service.serviceNameEnum === 'ATT_SERVICE')) {
        console.log('Fetching ATT service');
        onRequestServiceData('ATT');
      }
      if (!attributeList.some((service) => service.serviceNameEnum === 'CMD_SERVICE')) {
        console.log('Fetching CMD service');
        onRequestServiceData('CMD');
      }
    }
  }, [onRequestServiceData, attributeList]);

  const activeService = attributeList.find(
    (service) => service.serviceNameEnum === 'CMD_SERVICE'
  );
  const getDeviceId = () => {
    const attService = attributeList.find((service) => service.serviceNameEnum === 'ATT_SERVICE');
    if (attService) {
      const opidChar = attService.characteristicList.find((char: any) => char.name === 'opid');
      return opidChar?.realVal || null;
    }
    return null;
  };
 
  const deviceId = getDeviceId();

  // const deviceId = "BATZ1901000034";

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

  const handleRead = (serviceUuid: string, characteristicUuid: string, name: string) => {
    setLoadingStates((prev) => ({ ...prev, [characteristicUuid]: true }));
    readBleCharacteristic(serviceUuid, characteristicUuid, device.macAddress, (data: any, error: any) => {
      setLoadingStates((prev) => ({ ...prev, [characteristicUuid]: false }));
      if (data) {
        // toast.success(`${name} read successfully`);
        setUpdatedValues((prev) => ({
          ...prev,
          [characteristicUuid]: data.realVal,
        }));
      } else {
        // toast.error(`Failed to read ${name}`);
      }
    });
  };

  const handleWrite = (value: string | number) => {
    const cmdService = attributeList.find((service) => service.serviceNameEnum === 'CMD_SERVICE');
    if (!cmdService) {
      toast.error('CMD service not available');
      return;
    }
    const pubkCharacteristic = cmdService.characteristicList.find(
      (char: any) => char.name.toLowerCase() === 'pubk'
    );
    if (!pubkCharacteristic) {
      toast.error('pubk characteristic not found in CMD service');
      return;
    }
    writeBleCharacteristic(
      cmdService.uuid,
      pubkCharacteristic.uuid,
      value,
      device.macAddress,
      (data: any, error: any) => {
        if (data) {
          // toast.success(`Value written to ${pubkCharacteristic.name}`);
        } else {
          // toast.error(`Failed to write to ${pubkCharacteristic.name}`);
        }
      }
    );

    setTimeout(() => {
      handleRead(cmdService.uuid, pubkCharacteristic.uuid, device.name);
    }, 1000);
  };

  const handleRefreshService = () => {
    if (onRequestServiceData) {
      onRequestServiceData('CMD');
    }
  };

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDuration(Number(e.target.value));
  };

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

    const { codeDec } = generateDaysCodeForItem;
    setGeneratedCode(codeDec);
    toast.success(`Code: ${codeDec} generated Successfully`, { duration: 1000 });

    console.info('attributeList:', attributeList);
    const cmdService = attributeList.find((service) => service.serviceNameEnum === 'CMD_SERVICE');
    if (cmdService) {
      console.info('cmdService:', cmdService);
      const pubkCharacteristic = cmdService.characteristicList.find(
        (char: any) => char.name.toLowerCase() === 'pubk'
      );
      console.info('pubkCharacteristic:', pubkCharacteristic?.name);
      if (pubkCharacteristic) {
        // Update currentValue in pubk immediately
        setUpdatedValues((prev) => ({
          ...prev,
          [pubkCharacteristic.uuid]: codeDec,
        }));
        setActiveCharacteristic(pubkCharacteristic);
        handleWrite(String(codeDec));
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
  const handleRetrieveCodes = async () => {
  if (!deviceId) {
    toast.error('Device ID not available');
    return;
  }

  const distributorId = localStorage.getItem('distributorId');
  if (!distributorId) {
    toast.error('Distributor ID not available. Please sign in.');
    router.push('/signin');
    return;
  }

  setIsRetrieving(true);

  try {
    const authToken = localStorage.getItem('access_token');
    if (!authToken) {
      toast.error('Please sign in to retrieve codes');
      router.push('/signin');
      return;
    }

    const query = `
      query GetAllCodeEventsForItem {
        getAllCodeEventsForItem(itemId: "${deviceId}", first: 1, distributorId: "${distributorId}") {
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

    const codeEventsData = responseData.data?.getAllCodeEventsForItem?.page?.edges || [];
    if (codeEventsData.length > 0) {
      const codeDec = codeEventsData[0].node.codeDecString;
      setGeneratedCode(codeDec);
      toast.success(`Code: ${codeDec} retrieved successfully`, { duration: 1000 });

      const cmdService = attributeList.find((service) => service.serviceNameEnum === 'CMD_SERVICE');
      if (cmdService) {
        const pubkCharacteristic = cmdService.characteristicList.find(
          (char: any) => char.name.toLowerCase() === 'pubk'
        );
        if (pubkCharacteristic) {
          // Update currentValue in pubk immediately
          setUpdatedValues((prev) => ({
            ...prev,
            [pubkCharacteristic.uuid]: codeDec,
          }));
          setActiveCharacteristic(pubkCharacteristic);
          handleWrite(String(codeDec));
        } else {
          toast.error('pubk characteristic not found in CMD service');
        }
      } else {
        toast.error('CMD service not available');
      }
    } else {
      toast.error('No codes found for this device');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    toast.error(`Failed to retrieve code: ${message}`);
  } finally {
    setIsRetrieving(false);
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
      </div>
      <div className="p-4">
        {isLoadingService === 'CMD' && (
          <div className="w-full bg-gray-800 h-1 mb-4 rounded-full overflow-hidden">
            <div
              className="bg-blue-500 h-full transition-all duration-300 ease-in-out animate-pulse"
              style={{ width: serviceLoadingProgress > 0 ? `${serviceLoadingProgress}%` : '100%' }}
            ></div>
          </div>
        )}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-white">CMD Service</h3>
          <button
            onClick={handleRefreshService}
            className="flex items-center space-x-1 bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded-md text-sm transition-colors"
            disabled={isLoadingService !== null}
          >
            <RefreshCw size={14} className={isLoadingService ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Select Duration
          </label>
          <div className="w-full border border-gray-700 bg-gray-800 rounded-lg overflow-hidden">
            <label
              className={`flex items-center w-full px-4 py-2 ${
                duration === 1 ? 'bg-gray-700' : ''
              }`}
            >
              <input
                type="radio"
                name="duration"
                value="1"
                checked={duration === 1}
                onChange={handleDurationChange}
                className="mr-2"
              />
              1 Day
            </label>
            <label
              className={`flex items-center w-full px-4 py-2 ${
                duration === 3 ? 'bg-gray-700' : ''
              }`}
            >
              <input
                type="radio"
                name="duration"
                value="3"
                checked={duration === 3}
                onChange={handleDurationChange}
                className="mr-2"
              />
              3 Days
            </label>
          </div>
          <button
            className={`w-full px-4 py-2 mt-2 rounded-lg text-white text-sm transition-colors ${
              isSubmitting || !duration
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
            onClick={handleSubmit}
            disabled={isSubmitting || !duration}
          >
            {isSubmitting ? 'Generating Code...' : 'Generate Code'}
          </button>
          <button
            className={`w-full px-4 py-2 mt-2 rounded-lg text-white text-sm transition-colors ${
              isRetrieving ? 'bg-gray-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
            onClick={handleRetrieveCodes}
            disabled={isRetrieving}
          >
            {isRetrieving ? 'Retrieving Codes...' : 'Retrieve Code'}
          </button>
        </div>
        {activeService ? (
          <div className="space-y-4">
            {activeService.characteristicList
              .filter((char: any) => char.name.toLowerCase() === 'pubk')
              .map((char: any) => (
                <div key={char.uuid} className="border border-gray-700 rounded-lg overflow-hidden">
                  <div className="flex justify-between items-center bg-gray-800 px-4 py-2">
                    <span className="text-sm font-medium">{char.name}</span>
                    <div className="flex space-x-2">  
                    </div>
                  </div>
                  <div className="p-4 space-y-2">
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
            {isLoadingService === 'CMD' ? (
              <p>Loading CMD service data...</p>
            ) : (
              <div>
                <p>No data available for this service</p>
                {onRequestServiceData && (
                  <button
                    onClick={() => onRequestServiceData('CMD')}
                    className="mt-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-md text-white text-sm transition-colors"
                  >
                    Load CMD Service Data
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DeviceDetailView;