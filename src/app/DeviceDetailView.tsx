'use client'
 
import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { readBleCharacteristic, writeBleCharacteristic } from './utils';
import { Toaster, toast } from 'react-hot-toast';
import { ArrowLeft, Share2, RefreshCw, Clipboard } from 'lucide-react';
import { AsciiStringModal, NumericModal } from './modals';
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
  userRole: string;
 
}
 
const DeviceDetailView: React.FC<DeviceDetailProps> = ({
  device,
  attributeList,
  onBack,
  onRequestServiceData,
  isLoadingService,
  serviceLoadingProgress = 0,
  handlePublish,
  userRole
}) => {
  const router = useRouter();
  const [updatedValues, setUpdatedValues] = useState<{ [key: string]: any }>({});
  const [loadingStates, setLoadingStates] = useState<{ [key: string]: boolean }>({});
  const [asciiModalOpen, setAsciiModalOpen] = useState(false);
  const [numericModalOpen, setNumericModalOpen] = useState(false);
  const [activeCharacteristic, setActiveCharacteristic] = useState<any>(null);
  const [activeTab, setActiveTab] = useState(userRole === 'Distributor' ? 'ATT' : 'CMD');
  const [inputCode, setInputCode] = useState('');
  const isDistributor = false; // Replace with actual logic to determine user type (e.g., from props or context)

 
  const initialDataLoadedRef = useRef<boolean>(false);
  const heartbeatSentRef = useRef<boolean>(false);
 
  const fixedTabs = userRole === 'Distributor'
    ? [
      { id: 'ATT', label: 'ATT', serviceNameEnum: 'ATT_SERVICE' },
      { id: 'CMD', label: 'CMD', serviceNameEnum: 'CMD_SERVICE' },
      { id: 'STS', label: 'STS', serviceNameEnum: 'STS_SERVICE' },
      { id: 'DTA', label: 'DTA', serviceNameEnum: 'DTA_SERVICE' },
      { id: 'DIA', label: 'DIA', serviceNameEnum: 'DIA_SERVICE' },
      { id: 'HEARTBEAT', label: 'HB', serviceNameEnum: null },
    ]
    : [];
   
  const cmdService = attributeList.find((service) => service.serviceNameEnum === 'CMD_SERVICE');
  const stsService = attributeList.find((service) => service.serviceNameEnum === 'STS_SERVICE');
  const activeService = userRole === 'Distributor'
    ? attributeList.find((service) =>
      fixedTabs.find((tab) => tab.id === activeTab && tab.serviceNameEnum === service.serviceNameEnum)
    )
    : null;
 
  const isServiceLoaded = (serviceNameEnum: string) => {
    const loaded = attributeList.some((service) => service.serviceNameEnum === serviceNameEnum);
    console.log(`Is ${serviceNameEnum} loaded?`, loaded);
    return loaded;
  };
  useEffect(() => {
    if (cmdService && !isDistributor) {
      const pubkChar = cmdService.characteristicList.find(
        (char: any) => char.name.toLowerCase() === 'pubk'
      );
      if (pubkChar) {
        console.log('Setting activeCharacteristic to pubk for non-distributor');
        setActiveCharacteristic(pubkChar);
      } else {
        console.error('pubk characteristic not found in cmdService');
        toast.error('Public key characteristic not found on load');
      }
    }
  }, [cmdService, isDistributor]);
 
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
      console.log(`Loading ${tabId} service due to tab change`);
      onRequestServiceData(tabId);
    }
  };
 
  const handleRead = (serviceUuid: string, characteristicUuid: string, name: string) => {
    setLoadingStates((prev) => ({ ...prev, [characteristicUuid]: true }));
    readBleCharacteristic(serviceUuid, characteristicUuid, device.macAddress, (data: any, error: any) => {
      setLoadingStates((prev) => ({ ...prev, [characteristicUuid]: false }));
      if (data) {
        console.log(`${name} read successfully:`, data.realVal);
        toast.success(`${name} read successfully`);
        setUpdatedValues((prev) => ({
          ...prev,
          [characteristicUuid]: data.realVal,
        }));
      } else {
        console.error('Error reading characteristic:', name, error);
        toast.error(`Failed to read ${name}`);
      }
    });
  };
 
  const handleWriteClick = (characteristic: any) => {
    setActiveCharacteristic(characteristic);
    if (characteristic.name.toLowerCase().includes('pubk') && userRole === 'Distributor') {
      setAsciiModalOpen(true);
    } else {
      setNumericModalOpen(true);
    }
  };
 
  const handleWrite = (value: string | number) => {
    if (!activeCharacteristic || !cmdService) return;
    console.info({
      action: 'write',
      serviceUuid: cmdService.uuid,
      characteristicUuid: activeCharacteristic.uuid,
      macAddress: device.macAddress,
      name: device.name,
      value: value,
    });
    writeBleCharacteristic(
      cmdService.uuid,
      activeCharacteristic.uuid,
      value,
      device.macAddress,
      (data: any, error: any) => {
        console.info({ data: data, error: error });
        if (data) {
          console.info(data, 'Is Data 123');
          toast.success(`Value written to ${activeCharacteristic.name}`);
          setTimeout(() => {
            handleRead(cmdService.uuid, activeCharacteristic.uuid, device.name);
          }, 1000);
        } else {
          toast.error(`Failed to write to ${activeCharacteristic.name}`);
        }
      }
    );
  };
 
  const keypad = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['*', '0', '#']
  ];

  const formatInputCode = (code: string) => {
    // Remove any existing spaces for consistent processing
    const rawCode = code.replace(/\s/g, '');
    if (!rawCode) return '';
  
    // Split into segments: first 4, then 3s, then last 4
    const segments = [];
    if (rawCode.length > 0) segments.push(rawCode.slice(0, 4)); // First 4 chars (e.g., *030)
    if (rawCode.length > 4) segments.push(rawCode.slice(4, 7)); // Next 3 chars
    if (rawCode.length > 7) segments.push(rawCode.slice(7, 10));
    if (rawCode.length > 10) segments.push(rawCode.slice(10, 13));
    if (rawCode.length > 13) segments.push(rawCode.slice(13, 16));
    if (rawCode.length > 16) segments.push(rawCode.slice(16, 19));
    if (rawCode.length > 19) segments.push(rawCode.slice(19, 23)); // Last 4 chars (e.g., 957#)
  
    // Join with spaces
    return segments.join(' ');
  };
  const submitInput = () => {
    if (isLoadingService) {
      toast.error("Service is loading, please wait");
      return;
    }
    if (!inputCode) {
      toast.error("Input code is empty");
      return;
    }
    if (!cmdService) {
      toast.error("CMD service not loaded. Please refresh CMD service.");
      return;
    }
  
    // Validate raw input length (should be 23 characters)
    const rawCode = inputCode.replace(/\s/g, '');
    if (rawCode.length !== 23) {
      toast.error("Input code must be exactly 23 characters (e.g., *0307561888551305839957#)");
      return;
    }
  
    // Format the input code
    const formattedCode = formatInputCode(inputCode);
    toast.success(`Characteristic  set with value: ${formattedCode}`, {
      duration: 2000,
      icon: "✅",
    });
  
    // Use formatted code as the value
    const value = formattedCode; // Always a string due to spaces and *#
    console.log("Submitting value:", value, typeof value);
    toast.success(`Value is ${value}`, {
      duration: 3000,
    });
  
    handleWrite(value);
    setInputCode('');
};
  const handleNumpadClick = (key: string) => {
    setInputCode((prev) => {
      const rawCode = prev.replace(/\s/g, ''); // Work with raw code (no spaces)
  
      // Handle backspace
      if (key === 'backspace') {
        return prev.slice(0, -1);
      }
  
      // Prevent adding more characters if max length (23) is reached
      if (rawCode.length >= 23) {
        return prev;
      }
  
      // Validate input
      if (
        (rawCode.length === 0 && key !== '*') || // First character must be *
        (rawCode.length >= 1 && rawCode.length < 22 && !/^[0-9]$/.test(key)) || // Middle characters must be digits
        (rawCode.length === 22 && key !== '#') // Last character must be #
      ) {
        return prev; // Ignore invalid input
      }
  
      // Add the new key
      return prev + key;
    });
  };
  
  const clearInput = () => {
    setInputCode((prev) => prev.slice(0, -1));
};

 
 
  const handleCopyToClipboard = (value: string) => {
    navigator.clipboard.writeText(String(value));
    toast.success('Value copied to clipboard');
  };
 
  const handleRefreshService = (serviceName: string) => {
    if (!onRequestServiceData) return;
    console.log(`Refreshing service: ${serviceName}`);
    onRequestServiceData(serviceName);
  };
 
  const renderCharacteristicCard = (service: any, char: any, showWriteButton: boolean) => (
    <div key={char.uuid} className="border border-gray-700 rounded-lg overflow-hidden">
      <div className="flex justify-between items-center bg-gray-800 px-4 py-2">
        <span className="text-sm font-medium">{char.name}</span>
        <div className="flex space-x-2">
          <button
            className={`text-xs ${loadingStates[char.uuid] ? 'bg-gray-500' : 'bg-gray-700 hover:bg-gray-600'
              } px-3 py-1 rounded transition-colors`}
            onClick={() => handleRead(service.uuid, char.uuid, char.name)}
            disabled={loadingStates[char.uuid]}
          >
            {loadingStates[char.uuid] ? 'Reading...' : 'Read'}
          </button>
          {showWriteButton && (
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
  );
 
 
  const pubkValue = cmdService?.characteristicList
    ?.find((char: any) => char.name.toLowerCase() === 'pubk')
    ?.realVal || 'N/A';
 
  const rcrdValue = stsService?.characteristicList
    ?.find((char: any) => char.name.toLowerCase() === 'rcrd')
    ?.realVal ?? 'N/A'; 
    return (
      <div className="max-w-md mx-auto bg-gradient-to-b from-gray-800 to-gray-900 min-h-screen text-white">
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
        {userRole === 'Distributor' && (
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
        )}
        {userRole === 'Distributor' && (
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
        )}
        <div className="p-4">
          {userRole === 'Distributor' ? (
            <>
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
                      onClick={() => handleRefreshService(activeTab)}
                      className="flex items-center space-x-1 bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded-md text-sm transition-colors"
                      disabled={isLoadingService !== null}
                    >
                      <RefreshCw size={14} className={isLoadingService ? 'animate-spin' : ''} />
                      <span>Refresh</span>
                    </button>
                  </div>
                  {activeService ? (
                    <div className="space-y-4">
                      {activeService.characteristicList.map((char: any) => (
                        renderCharacteristicCard(activeService, char, activeTab === 'CMD')
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
            </>
          ) : (
            <div className="p-4">
            <div className="space-y-6">
              {/* Key Values Section - FIXED */}
              <div className="flex space-x-4 mb-6">
                {/* PUBK - Made wider and more readable */}
                <div className="border border-gray-700 rounded-lg p-4 bg-gray-800 w-3/4">
                  <div className="text-sm text-gray-400 mb-2">Current PUBK Value</div>
                  {cmdService ? (
                    <div className="min-h-8 flex items-center">
                      <div className="font-mono text-sm overflow-hidden overflow-ellipsis w-5/6">
                        {pubkValue}
                      </div>
                      <button
                        onClick={() => handleCopyToClipboard(pubkValue)}
                        className="ml-1 p-1 text-gray-400 hover:text-blue-500"
                      >
                        <Clipboard size={16} />
                      </button>
                    </div>
                  ) : (
                    onRequestServiceData && (
                      <button
                        onClick={() => onRequestServiceData('CMD')}
                        className="w-full bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-md text-white text-sm transition-colors"
                      >
                        Load
                      </button>
                    )
                  )}
                </div>
               
                {/* Days - Better visibility */}
                <div className="border border-gray-700 rounded-lg p-4 bg-gray-800 w-1/4 flex flex-col">
                  <div className="text-sm text-gray-400 mb-2 text-center">Days</div>
                  <div className="flex items-center justify-center min-h-8">
                    {stsService ? (
                      <span className="text-xl font-medium">{rcrdValue}</span>
                    ) : (
                      onRequestServiceData && (
                        <button
                          onClick={() => onRequestServiceData('STS')}
                          className="w-full bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded-md text-white text-sm transition-colors"
                        >
                          Load
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
             
              <div className="border border-gray-700 rounded-lg p-3 bg-gray-800 mb-4">
                <p className="text-sm text-gray-400 mb-1">Input Code:</p>
                <p
                  className="font-mono h-8 mt-1 truncate p-1 bg-gray-900 rounded"
                  style={{
                    fontSize: inputCode.length > 20 ? '0.75rem' : inputCode.length > 15 ? '0.875rem' : '1rem',
                    maxWidth: '100%',
                  }}
                >
                 {formatInputCode(inputCode)}
                </p>
              </div>
              <div className="space-y-2">
                {/* Numpad Grid */}
                <div className="grid grid-cols-3 gap-2">
                  {keypad.map((row, rowIndex) =>
                    row.map((key, keyIndex) => (
                      <button
                        key={`${rowIndex}-${keyIndex}`}
                        className="bg-gray-700 hover:bg-gray-600 text-white text-xl font-semibold rounded-lg py-3"
                        onClick={() => handleNumpadClick(key)}
                      >
                        {key}
                      </button>
                    ))
                  )}
                </div>
                {/* Backspace and OK Buttons */}
                <div className="flex space-x-4">
                  <div
                    className="h-14 flex-1 flex items-center justify-center rounded bg-gray-600 text-white text-xl cursor-pointer active:bg-gray-500"
                    onClick={clearInput}
                  >
                    ←
                  </div>
                  <div
                    className="h-14 flex-1 flex items-center justify-center rounded bg-blue-600 text-white text-xl cursor-pointer active:bg-blue-500"
                    onClick={submitInput}
                  >
                    {isLoadingService ? 'Loading...' : 'OK'}
                  </div>
                </div>
              </div>
             
              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => handleRefreshService('CMD')}
                  className="flex-1 flex items-center justify-center space-x-1 bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-md text-sm transition-colors"
                  disabled={isLoadingService !== null}
                >
                  <RefreshCw size={14} className={isLoadingService ? 'animate-spin' : ''} />
                  <span>Refresh CMD</span>
                </button>
                <button
                  onClick={() => handleRefreshService('STS')}
                  className="flex-1 flex items-center justify-center space-x-1 bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-md text-sm transition-colors"
                  disabled={isLoadingService !== null}
                >
                  <RefreshCw size={14} className={isLoadingService ? 'animate-spin' : ''} />
                  <span>Refresh STS</span>
                </button>
              </div>
              
            </div>
          </div>
        )}
      </div>
    </div>
)
};
 
export default DeviceDetailView;
// 'use client'

// import React, { useState, useRef, useEffect } from 'react';
// import { useRouter } from 'next/navigation';
// import { readBleCharacteristic, writeBleCharacteristic } from './utils';
// import { Toaster, toast } from 'react-hot-toast';
// import { ArrowLeft, Share2, RefreshCw } from 'lucide-react';
// import { AsciiStringModal, NumericModal } from './modals';
// import { CustomKeypadModal } from './CustomKeypadModal';
// import { Clipboard } from 'lucide-react';
// import HeartbeatView from '@/components/HeartbeatView';

// interface DeviceDetailProps {
//   device: {
//     macAddress: string;
//     name: string;
//     rssi: string;
//     imageUrl?: string;
//   };
//   attributeList: any[];
//   onBack?: () => void;
//   onRequestServiceData?: (serviceName: string) => void;
//   isLoadingService?: string | null;
//   serviceLoadingProgress?: number;
//   handlePublish?: (attributeList: any, serviceType: string) => void;
//   userRole: string;
// }

// const DeviceDetailView: React.FC<DeviceDetailProps> = ({
//   device,
//   attributeList,
//   onBack,
//   onRequestServiceData,
//   isLoadingService,
//   serviceLoadingProgress = 0,
//   handlePublish,
//   userRole
// }) => {
//   const router = useRouter();
//   const [updatedValues, setUpdatedValues] = useState<{ [key: string]: any }>({});
//   const [loadingStates, setLoadingStates] = useState<{ [key: string]: boolean }>({});
//   const [asciiModalOpen, setAsciiModalOpen] = useState(false);
//   const [numericModalOpen, setNumericModalOpen] = useState(false);
//   const [customKeypadModalOpen, setCustomKeypadModalOpen] = useState(false);
//   const [activeCharacteristic, setActiveCharacteristic] = useState<any>(null);
//   const [activeTab, setActiveTab] = useState(userRole === 'Distributor' ? 'ATT' : 'CMD');
//   const initialDataLoadedRef = useRef<boolean>(false);
//   const heartbeatSentRef = useRef<boolean>(false);

//   const fixedTabs = userRole === 'Distributor'
//     ? [
//       { id: 'ATT', label: 'ATT', serviceNameEnum: 'ATT_SERVICE' },
//       { id: 'CMD', label: 'CMD', serviceNameEnum: 'CMD_SERVICE' },
//       { id: 'STS', label: 'STS', serviceNameEnum: 'STS_SERVICE' },
//       { id: 'DTA', label: 'DTA', serviceNameEnum: 'DTA_SERVICE' },
//       { id: 'DIA', label: 'DIA', serviceNameEnum: 'DIA_SERVICE' },
//       { id: 'HEARTBEAT', label: 'HB', serviceNameEnum: null },
//     ]
//     : [];

//   const cmdService = attributeList.find((service) => service.serviceNameEnum === 'CMD_SERVICE');
//   const stsService = attributeList.find((service) => service.serviceNameEnum === 'STS_SERVICE');
//   const activeService = userRole === 'Distributor'
//     ? attributeList.find((service) =>
//       fixedTabs.find((tab) => tab.id === activeTab && tab.serviceNameEnum === service.serviceNameEnum)
//     )
//     : null;

//   const isServiceLoaded = (serviceNameEnum: string) => {
//     const loaded = attributeList.some((service) => service.serviceNameEnum === serviceNameEnum);
//     console.log(`Is ${serviceNameEnum} loaded?`, loaded);
//     return loaded;
//   };

 

//   const handleBack = () => (onBack ? onBack() : router.back());

//   const formatValue = (characteristic: any) => {
//     if (typeof characteristic.realVal === 'number') {
//       switch (characteristic.valType) {
//         case 0:
//           return characteristic.realVal;
//         case 1:
//           return `${characteristic.realVal} mA`;
//         case 2:
//           return `${characteristic.realVal} mV`;
//         default:
//           return characteristic.realVal;
//       }
//     }
//     return characteristic.realVal || 'N/A';
//   };

//   const handleTabChange = (tabId: string) => {
//     setActiveTab(tabId);
//     const tab = fixedTabs.find((t) => t.id === tabId);
//     if (!tab || !tab.serviceNameEnum || tabId === 'HEARTBEAT') return;
//     const serviceNameEnum = tab.serviceNameEnum;
//     if (!isServiceLoaded(serviceNameEnum) && onRequestServiceData) {
//       console.log(`Loading ${tabId} service due to tab change`);
//       onRequestServiceData(tabId);
//     }
//   };

//   const handleRead = (serviceUuid: string, characteristicUuid: string, name: string) => {
//     setLoadingStates((prev) => ({ ...prev, [characteristicUuid]: true }));
//     readBleCharacteristic(serviceUuid, characteristicUuid, device.macAddress, (data: any, error: any) => {
//       setLoadingStates((prev) => ({ ...prev, [characteristicUuid]: false }));
//       if (data) {
//         console.log(`${name} read successfully:`, data.realVal);
//         toast.success(`${name} read successfully`);
//         setUpdatedValues((prev) => ({
//           ...prev,
//           [characteristicUuid]: data.realVal,
//         }));
//       } else {
//         console.error('Error reading characteristic:', name, error);
//         toast.error(`Failed to read ${name}`);
//       }
//     });
//   };

//   const handleWriteClick = (characteristic: any) => {
//     setActiveCharacteristic(characteristic);

//     // Determine which modal to show based on user role and characteristic name
//     if (characteristic.name.toLowerCase().includes('pubk')) {
//       // For PUBK characteristics, show different modals based on user role
//       if (userRole === 'Distributor') {
//         setAsciiModalOpen(true);
//       } else {
//         // For non-distributors, show custom keypad modal for PUBK
//         setCustomKeypadModalOpen(true);
//       }
//     } else {
//       // For other characteristics, show the numeric modal
//       setNumericModalOpen(true);
//     }
//   };

//   const handleWrite = (value: string | number) => {
//     if (!activeCharacteristic || !cmdService) return;
//     console.info({
//       action: 'write',
//       serviceUuid: cmdService.uuid,
//       characteristicUuid: activeCharacteristic.uuid,
//       macAddress: device.macAddress,
//       name: device.name,
//       value: value,
//     });
//     writeBleCharacteristic(
//       cmdService.uuid,
//       activeCharacteristic.uuid,
//       value,
//       device.macAddress,
//       (data: any, error: any) => {
//         console.info({ data: data, error: error });
//         if (data) {
//           console.info(data, 'Is Data 123');
//         }
//       }
//     );
//     toast.success(`Value written to ${activeCharacteristic.name}`);
//     setTimeout(() => {
//       handleRead(cmdService.uuid, activeCharacteristic.uuid, device.name);
//     }, 1000);
//   };

//   const handleRefreshService = (serviceName: string) => {
//     if (!onRequestServiceData) return;
//     console.log(`Refreshing service: ${serviceName}`);
//     onRequestServiceData(serviceName);
//   };

//   const renderCharacteristicCard = (service: any, char: any, showWriteButton: boolean) => (
//     <div key={char.uuid} className="border border-gray-700 rounded-lg overflow-hidden">
//       <div className="flex justify-between items-center bg-gray-800 px-4 py-2">
//         <span className="text-sm font-medium">{char.name}</span>
//         <div className="flex space-x-2">
//           <button
//             className={`text-xs ${loadingStates[char.uuid] ? 'bg-gray-500' : 'bg-gray-700 hover:bg-gray-600'
//               } px-3 py-1 rounded transition-colors`}
//             onClick={() => handleRead(service.uuid, char.uuid, char.name)}
//             disabled={loadingStates[char.uuid]}
//           >
//             {loadingStates[char.uuid] ? 'Reading...' : 'Read'}
//           </button>
//           {showWriteButton && (
//             <button
//               className="text-xs bg-blue-700 px-3 py-1 rounded hover:bg-blue-600 transition-colors"
//               onClick={() => handleWriteClick(char)}
//             >
//               Write
//             </button>
//           )}
//         </div>
//       </div>
//       <div className="p-4 space-y-2">
//         <div>
//           <p className="text-xs text-gray-400">Description</p>
//           <p className="text-sm">{char.desc}</p>
//         </div>
//         <div className="flex items-center justify-between group">
//           <div className="flex-grow">
//             <p className="text-xs text-gray-400">Current Value</p>
//             <p className="text-sm font-mono">
//               {updatedValues[char.uuid] !== undefined
//                 ? updatedValues[char.uuid]
//                 : formatValue(char)}
//             </p>
//           </div>
//           <button
//             className="p-2 text-gray-400 hover:text-blue-500 focus:text-blue-500 transition-colors"
//             onClick={() => {
//               const valueToCopy =
//                 updatedValues[char.uuid] !== undefined
//                   ? updatedValues[char.uuid]
//                   : formatValue(char);
//               navigator.clipboard.writeText(String(valueToCopy));
//               toast.success('Value copied to clipboard');
//             }}
//             aria-label="Copy to clipboard"
//           >
//             <Clipboard size={16} />
//           </button>
//         </div>
//       </div>
//     </div>
//   );

//   return (
//     <div className="max-w-md mx-auto bg-gradient-to-b from-[#24272C] to-[#0C0C0E] min-h-screen text-white">
//       <Toaster />
//       {/* ASCII Modal for distributors */}
//       <AsciiStringModal
//         isOpen={asciiModalOpen}
//         onClose={() => setAsciiModalOpen(false)}
//         onSubmit={(value) => handleWrite(value)}
//         title={activeCharacteristic?.name || 'Public Key / Last Code'}
//       />
//       {/* Numeric Modal for non-PUBK characteristics */}
//       <NumericModal
//         isOpen={numericModalOpen}
//         onClose={() => setNumericModalOpen(false)}
//         onSubmit={(value) => handleWrite(value)}
//         title={activeCharacteristic?.name || 'Read'}
//       />
//       {/* Custom Keypad Modal for non-distributors with PUBK */}
//       <CustomKeypadModal
//         isOpen={customKeypadModalOpen}
//         onClose={() => setCustomKeypadModalOpen(false)}
//         onSubmit={(value) => handleWrite(value)}
//         title={activeCharacteristic?.name || 'Access Code'}
//       />
//       <div className="p-4 flex items-center">
//         <button onClick={handleBack} className="mr-4">
//           <ArrowLeft className="w-6 h-6 text-gray-400" />
//         </button>
//         <h1 className="text-lg font-semibold flex-1">Device Details</h1>
//         <Share2 className="w-5 h-5 text-gray-400" />
//       </div>
//       <div className="flex flex-col items-center p-6 pb-2">
//         <img
//           src={device.imageUrl}
//           alt={device.name || 'Device'}
//           className="w-40 h-40 object-contain mb-4"
//         />
//         <h2 className="text-xl font-semibold">{device.name || 'Unknown Device'}</h2>
//         <p className="text-sm text-gray-400 mt-1">{device.macAddress || 'Unknown MAC'}</p>
//         <p className="text-sm text-gray-400 mt-1">{device.rssi || 'Unknown RSSI'}</p>
//       </div>
//       {userRole === 'Distributor' && (
//         <div className="border-b border-gray-800">
//           <div className="flex justify-between px-1">
//             {fixedTabs.map((tab) => {
//               const serviceLoaded = tab.serviceNameEnum ? isServiceLoaded(tab.serviceNameEnum) : true;
//               return (
//                 <button
//                   key={tab.id}
//                   className={`py-3 px-3 text-sm font-medium relative ${activeTab === tab.id ? 'text-blue-500' : 'text-gray-400'
//                     } ${isLoadingService === tab.id ? 'animate-pulse' : ''}`}
//                   onClick={() => handleTabChange(tab.id)}
//                 >
//                   {tab.label}
//                   {activeTab === tab.id && (
//                     <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500" />
//                   )}
//                   {!serviceLoaded && tab.id === activeTab && tab.id !== 'HEARTBEAT' && (
//                     <div className="absolute top-1 right-0 w-2 h-2 bg-yellow-500 rounded-full"></div>
//                   )}
//                 </button>
//               );
//             })}
//           </div>
//         </div>
//       )}
//       <div className="p-4">
//         {userRole === 'Distributor' ? (
//           <>
//             {isLoadingService === activeTab && (
//               <div className="w-full bg-gray-800 h-1 mb-4 rounded-full overflow-hidden">
//                 <div
//                   className="bg-blue-500 h-full transition-all duration-300 ease-in-out"
//                   style={{ width: `${serviceLoadingProgress}%` }}
//                 ></div>
//               </div>
//             )}
//             {activeTab === 'HEARTBEAT' ? (
//               <HeartbeatView
//                 attributeList={attributeList}
//                 onRequestServiceData={onRequestServiceData || (() => { })}
//                 isLoading={isLoadingService !== null}
//                 handlePublish={handlePublish}
//                 initialDataLoadedRef={initialDataLoadedRef}
//                 heartbeatSentRef={heartbeatSentRef}
//               />
//             ) : (
//               <>
//                 <div className="flex justify-between items-center mb-4">
//                   <h3 className="text-lg font-medium text-white">{activeTab} Service</h3>
//                   <button
//                     onClick={() => handleRefreshService(activeTab)}
//                     className="flex items-center space-x-1 bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded-md text-sm transition-colors"
//                     disabled={isLoadingService !== null}
//                   >
//                     <RefreshCw size={14} className={isLoadingService ? 'animate-spin' : ''} />
//                     <span>Refresh</span>
//                   </button>
//                 </div>
//                 {activeService ? (
//                   <div className="space-y-4">
//                     {activeService.characteristicList.map((char: any) => (
//                       renderCharacteristicCard(activeService, char, activeTab === 'CMD')
//                     ))}
//                   </div>
//                 ) : (
//                   <div className="p-6 text-center text-gray-400">
//                     {isLoadingService === activeTab ? (
//                       <p>Loading {activeTab} service data...</p>
//                     ) : (
//                       <div>
//                         <p>No data available for this service</p>
//                         {onRequestServiceData && (
//                           <button
//                             onClick={() => onRequestServiceData(activeTab)}
//                             className="mt-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-md text-white text-sm transition-colors"
//                           >
//                             Load {activeTab} Service Data
//                           </button>
//                         )}
//                       </div>
//                     )}
//                   </div>
//                 )}
//               </>
//             )}
//           </>
//         ) : (
//           <div className="space-y-6">
//             <div>
//               <div className="flex justify-between items-center mb-4">
//                 <h3 className="text-lg font-medium text-white">CMD</h3>
//                 <button
//                   onClick={() => handleRefreshService('CMD')}
//                   className="flex items-center space-x-1 bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded-md text-sm transition-colors"
//                   disabled={isLoadingService === 'CMD'}
//                 >
//                   <RefreshCw size={14} className={isLoadingService === 'CMD' ? 'animate-spin' : ''} />
//                   <span>Refresh</span>
//                 </button>
//               </div>
//               {isLoadingService === 'CMD' && (
//                 <div className="w-full bg-gray-800 h-1 mb-4 rounded-full overflow-hidden">
//                   <div
//                     className="bg-blue-500 h-full transition-all duration-300 ease-in-out"
//                     style={{ width: `${serviceLoadingProgress}%` }}
//                   ></div>
//                 </div>
//               )}
//               {isLoadingService === 'CMD' ? (
//                 <div className="p-6 text-center text-gray-400">
//                   <p>Loading CMD service data...</p>
//                 </div>
//               ) : cmdService ? (
//                 cmdService.characteristicList
//                   .filter((char: any) => char.name.toLowerCase() === 'pubk')
//                   .map((char: any) => renderCharacteristicCard(cmdService, char, true))
//               ) : (
//                 <div className="p-6 text-center text-gray-400">
//                   {/* <p>No data available for CMD service</p> */}
//                   {onRequestServiceData && (
//                     <button
//                       onClick={() => onRequestServiceData('CMD')}
//                       className="mt-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-md text-white text-sm transition-colors"
//                     >
//                       Load CMD Service Data
//                     </button>
//                   )}
//                 </div>
//               )}
//             </div>
//             <div>
//               <div className="flex justify-between items-center mb-4">
//                 <h3 className="text-lg font-medium text-white">STS</h3>
//                 <button
//                   onClick={() => handleRefreshService('STS')}
//                   className="flex items-center space-x-1 bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded-md text-sm transition-colors"
//                   disabled={isLoadingService === 'STS'}
//                 >
//                   <RefreshCw size={14} className={isLoadingService === 'STS' ? 'animate-spin' : ''} />
//                   <span>Refresh</span>
//                 </button>
//               </div>
//               {isLoadingService === 'STS' && (
//                 <div className="w-full bg-gray-800 h-1 mb-4 rounded-full overflow-hidden">
//                   <div
//                     className="bg-blue-500 h-full transition-all duration-300 ease-in-out"
//                     style={{ width: `${serviceLoadingProgress}%` }}
//                   ></div>
//                 </div>
//               )}
//               {isLoadingService === 'STS' ? (
//                 <div className="p-6 text-center text-gray-400">
//                   <p>Loading STS service data...</p>
//                 </div>
//               ) : stsService ? (
//                 stsService.characteristicList
//                   .filter((char: any) => char.name.toLowerCase() === 'rcrd')
//                   .map((char: any) => renderCharacteristicCard(stsService, char, false))
//               ) : (
//                 <div className="p-6 text-center text-gray-400">
//                   {/* <p>No data available for STS service</p> */}
//                   {onRequestServiceData && (
//                     <button
//                       onClick={() => onRequestServiceData('STS')}
//                       className="mt-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-md text-white text-sm transition-colors"
//                     >
//                       Load STS Service Data
//                     </button>
//                   )}
//                 </div>
//               )}
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };

// export default DeviceDetailView;
