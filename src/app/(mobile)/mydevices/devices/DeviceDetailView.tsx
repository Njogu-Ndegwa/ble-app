'use client'

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { readBleCharacteristic, writeBleCharacteristic } from '../../../utils';
import { Toaster, toast } from 'react-hot-toast';
import { ArrowLeft, Share2, Clipboard, Check, RefreshCw } from 'lucide-react';
import { AsciiStringModal } from '../../../modals';
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
}

const DeviceDetailView: React.FC<DeviceDetailProps> = ({
  device,
  attributeList,
  onBack,
  onRequestServiceData,
  isLoadingService,
  serviceLoadingProgress = 0,
}) => {
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

  useEffect(() => {
    const fetchItemId = async () => {
      const attService = attributeList.find((service) => service.serviceNameEnum === 'ATT_SERVICE');
      if (!attService) {
        console.log('ATT_SERVICE not yet loaded, skipping fetchItemId');
        return;
      }

      const oemItemId = attService.characteristicList.find((char: any) => char.name === 'opid')?.realVal || null;
      if (!oemItemId) {
        toast.error('OEM Item ID not available', { duration: 1000 });
        return;
      }

      try {
        const authToken = localStorage.getItem('access_token');
        if (!authToken) {
          toast.error('Please sign in to fetch item data', { duration: 5000 });
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
          toast.success('Item ID fetched successfully', { duration: 1000 });
        } else {
          throw new Error('No item ID returned in response');
        }
      } catch (error) {
        console.error('Error fetching item ID:', error);
        toast.error(`Failed to fetch item data: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    };

    fetchItemId();
  }, [router, attributeList]);

  const cmdService = attributeList.find(
    (service) => service.serviceNameEnum === 'CMD_SERVICE'
  );
  const pubkCharacteristic = cmdService?.characteristicList.find(
    (char: any) => char.name.toLowerCase().includes('pubk')
  );

  const handleBack = () => (onBack ? onBack() : router.back());

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDuration(Number(e.target.value));
  };

  const handleSubmit = async () => {
    if (!itemId) {
      toast.error('Item ID not available');
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
        router.push('/signin');
        return;
      }

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

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          query,
          variables: { itemId, codeDays: duration },
        }),
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

      const { generateDaysCode } = responseData.data;
      if (!generateDaysCode) {
        throw new Error('No data returned from generateDaysCode');
      }

      const { codeDec } = generateDaysCode;
      setGeneratedCode(codeDec);
      toast.success(`Code: ${codeDec} generated successfully`, { duration: 1000 });

      console.info('attributeList:', attributeList);
      const cmdService = attributeList.find((service) => service.serviceNameEnum === 'CMD_SERVICE');
      if (cmdService) {
        console.info('cmdService:', cmdService);
        const pubkCharacteristic = cmdService.characteristicList.find(
          (char: any) => char.name.toLowerCase() === 'pubk'
        );
        console.info('pubkCharacteristic:', pubkCharacteristic?.name);
        if (pubkCharacteristic) {
          setUpdatedValues((prev) => ({
            ...prev,
            [pubkCharacteristic.uuid]: codeDec,
          }));
          setActiveCharacteristic(pubkCharacteristic);
          setUpdatedValue(codeDec);
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
    if (!itemId) {
      toast.error('Item ID not available');
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

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          query,
          variables: { itemId, distributorId, first: 1 },
        }),
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

      const codeEventsData = responseData.data?.getAllCodeEventsForSpecificItemByDistributor?.page?.edges || [];
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
            setUpdatedValues((prev) => ({
              ...prev,
              [pubkCharacteristic.uuid]: codeDec,
            }));
            setActiveCharacteristic(pubkCharacteristic);
            setUpdatedValue(codeDec);
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

  const handleRead = () => {
    if (!cmdService || !pubkCharacteristic) return;
    setIsLoading(true);
    readBleCharacteristic(
      cmdService.uuid,
      pubkCharacteristic.uuid,
      device.macAddress,
      (data: any, error: any) => {
        setIsLoading(false);
        if (data) {
          toast.success(`${pubkCharacteristic.name} read successfully`);
          setUpdatedValue(data.realVal);
          setUpdatedValues((prev) => ({
            ...prev,
            [pubkCharacteristic.uuid]: data.realVal,
          }));
        } else {
          console.error('Error Reading Characteristics');
          toast.error(`Failed to read ${pubkCharacteristic.name}`);
        }
      }
    );
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
      (data: any, error: any) => {
        if (data) {
          toast.success(`Value written to ${activeCharacteristic.name}`);
          setTimeout(() => {
            handleRead();
          }, 1000);
        } else {
          console.error('Error Writing Characteristics');
          toast.error(`Failed to write ${activeCharacteristic.name}`);
        }
      }
    );
  };

  const handleRefreshService = () => {
    if (onRequestServiceData) {
      onRequestServiceData('CMD');
    }
  };

  return (
    <div className="max-w-md mx-auto bg-gradient-to-b from-[#24272C] to-[#0C0C0E] min-h-screen text-white">
      <Toaster />
      <AsciiStringModal
        isOpen={asciiModalOpen}
        onClose={() => setAsciiModalOpen(false)}
        onSubmit={(value) => handleWrite(value)}
        title={activeCharacteristic?.name || 'Public Key'}
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
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-3">
            <label className="text-sm font-medium text-slate-300">Duration</label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: 1, label: '1 Day' },
              { value: 3, label: '3 Days' },
            ].map((option) => (
              <label
                key={option.value}
                className={`relative cursor-pointer transition-all duration-200 ${
                  duration === option.value
                    ? 'transform scale-105'
                    : 'hover:scale-102'
                }`}
              >
                <input
                  type="radio"
                  name="duration"
                  value={option.value}
                  checked={duration === option.value}
                  onChange={handleDurationChange}
                  className="sr-only"
                />
                <div
                  className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                    duration === option.value
                      ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20'
                      : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
                  }`}
                >
                  <div className="text-center">
                    <div className="font-semibold text-white">{option.label}</div>
                  </div>
                  {duration === option.value && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>
        <div className="space-y-3 mb-6">
          <button
            className={`w-full py-3 px-4 rounded-xl font-semibold transition-all duration-200 ${
              isSubmitting || !duration
                ? 'bg-gray-500 cursor-not-allowed text-slate-400'
                : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40'
            }`}
            onClick={handleSubmit}
            disabled={isSubmitting || !duration}
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Generating...</span>
              </div>
            ) : (
              'Generate Code'
            )}
          </button>
          <button
            className={`w-full py-3 px-4 rounded-xl font-semibold transition-all duration-200 ${
              isRetrieving
                ? 'bg-slate-600 cursor-not-allowed text-slate-400'
                : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40'
            }`}
            onClick={handleRetrieveCodes}
            disabled={isRetrieving}
          >
            {isRetrieving ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Retrieving...</span>
              </div>
            ) : (
              'Retrieve Last Code'
            )}
          </button>
        </div>
        {isLoadingService === 'CMD' && (
          <div className="w-full bg-gray-800 h-1 mb-4 rounded-full overflow-hidden">
            <div
              className="bg-blue-500 h-full transition-all duration-300 ease-in-out"
              style={{ width: `${serviceLoadingProgress}%` }}
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
        {cmdService && pubkCharacteristic ? (
          <div className="border border-gray-700 rounded-lg overflow-hidden">
            <div className="flex justify-between items-center bg-gray-800 px-4 py-2">
              <span className="text-sm font-medium">{pubkCharacteristic.name}</span>
              <div className="flex space-x-2">
                <button
                  className={`text-xs ${
                    isLoading ? 'bg-gray-500' : 'bg-gray-700 hover:bg-gray-600'
                  } px-3 py-1 rounded transition-colors`}
                  onClick={handleRead}
                  disabled={isLoading}
                >
                  {isLoading ? 'Reading...' : 'Read'}
                </button>
                <button
                  className="text-xs bg-blue-700 px-3 py-1 rounded hover:bg-blue-600 transition-colors"
                  onClick={handleWriteClick}
                >
                  Write
                </button>
              </div>
            </div>
            <div className="p-4 space-y-2">
              <div>
                <p className="text-xs text-gray-400">Description</p>
                <p className="text-sm">{pubkCharacteristic.desc}</p>
              </div>
              <div className="flex items-center justify-between group">
                <div className="flex-grow">
                  <p className="text-xs text-gray-400">Current Value</p>
                  <p className="text-sm font-mono">
                    {updatedValues[pubkCharacteristic.uuid] || updatedValue || pubkCharacteristic.realVal || 'N/A'}
                  </p>
                </div>
                <button
                  className="p-2 text-gray-400 hover:text-blue-500 focus:text-blue-500 transition-colors"
                  onClick={() => {
                    const valueToCopy = updatedValues[pubkCharacteristic.uuid] || updatedValue || pubkCharacteristic.realVal || 'N/A';
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
        ) : (
          <div className="p-6 text-center text-gray-400">
            {isLoadingService === 'CMD' ? (
              <p>Loading CMD service data...</p>
            ) : (
              <div>
                <p>No data available for CMD service</p>
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
//working before adding new code
// 'use client'

// import React, { useState, useEffect, useRef } from 'react';
// import { useRouter } from 'next/navigation';
// import { readBleCharacteristic, writeBleCharacteristic } from '../../../utils';
// import { Toaster, toast } from 'react-hot-toast';
// import { ArrowLeft, Share2, RefreshCw, Clipboard, Check } from 'lucide-react';
// import { apiUrl } from '@/lib/apollo-client';

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
// }

// const DeviceDetailView: React.FC<DeviceDetailProps> = ({
//   device,
//   attributeList,
//   onBack,
//   onRequestServiceData,
//   isLoadingService,
//   serviceLoadingProgress = 0,
//   handlePublish,
// }) => {
//   const router = useRouter();
//   const [updatedValues, setUpdatedValues] = useState<{ [key: string]: any }>({});
//   const [loadingStates, setLoadingStates] = useState<{ [key: string]: boolean }>({});
//   const [activeCharacteristic, setActiveCharacteristic] = useState<any>(null);
//   const [activeTab, setActiveTab] = useState('CMD');
//   const [duration, setDuration] = useState<number | null>(null);
//   const [isSubmitting, setIsSubmitting] = useState(false);
//   const [generatedCode, setGeneratedCode] = useState<string | null>(null);
//   const [codeEvents, setCodeEvents] = useState<
//     { _id: string; codeDecString: string; codeHexString: string; createdAt: string; codeDays: number }[]
//   >([]);
//   const [isRetrieving, setIsRetrieving] = useState(false);
//   const [itemId, setItemId] = useState<string | null>(null);

//   const fixedTabs = [
//     { id: 'CMD', label: 'CMD', serviceNameEnum: 'CMD_SERVICE' },
//   ];

//   useEffect(() => {
//     console.log('isLoadingService:', isLoadingService);
//     console.log('serviceLoadingProgress:', serviceLoadingProgress);
//     console.log('attributeList:', attributeList);
//     if (onRequestServiceData) {
//       if (!attributeList.some((service) => service.serviceNameEnum === 'ATT_SERVICE')) {
//         console.log('Fetching ATT service');
//         onRequestServiceData('ATT');
//       }
//       if (!attributeList.some((service) => service.serviceNameEnum === 'CMD_SERVICE')) {
//         console.log('Fetching CMD service');
//         onRequestServiceData('CMD');
//       }
//     }
//   }, [onRequestServiceData, attributeList]);

//   const activeService = attributeList.find(
//     (service) => service.serviceNameEnum === 'CMD_SERVICE'
//   );

//  useEffect(() => {
//   const fetchItemId = async () => {
//     const attService = attributeList.find((service) => service.serviceNameEnum === 'ATT_SERVICE');
//     if (!attService) {
//       console.log('ATT_SERVICE not yet loaded, skipping fetchItemId');
//       return;
//     }

//     const oemItemId = attService.characteristicList.find((char: any) => char.name === 'opid')?.realVal || null;
//       if (!oemItemId) {
//         // toast.error('OEM Item ID not available', { duration: 5000 });
//         return;
//       }

//       try {
//         const authToken = localStorage.getItem('access_token');
//         if (!authToken) {
//           // toast.error('Please sign in to fetch item data', { duration: 5000 });
//           router.push('/signin');
//           return;
//         }

//         const query = `
//           query GetItemByOemItemId($oemItemId: ID!) {
//             getItembyOemItemId(oemItemId: $oemItemId) {
//               _id
//             }
//           }
//         `;

//         const response = await fetch(apiUrl, {
//           method: 'POST',
//           headers: {
//             'Content-Type': 'application/json',
//             Authorization: `Bearer ${authToken}`,
//           },
//           body: JSON.stringify({
//             query,
//             variables: { oemItemId },
//           }),
//         });

//         const result = await response.json();

//         if (!response.ok) {
//           throw new Error(`HTTP error! Status: ${response.status}, Message: ${JSON.stringify(result)}`);
//         }

//         if (result.errors) {
//           throw new Error(`GraphQL error: ${result.errors.map((e: { message: any }) => e.message).join(', ')}`);
//         }

//         const fetchedItemId = result.data.getItembyOemItemId._id;
//         if (fetchedItemId) {
//           setItemId(fetchedItemId); // Store the _id in state
//           console.log('Item ID fetched successfully:', fetchedItemId);
//           // toast.success('Item ID fetched successfully', { duration: 1000 }); // Notify success
//         } else {
//           throw new Error('No item ID returned in response');
//         }
//       } catch (error) {
//         console.error('Error fetching item ID:', error);
//         // toast.error(`Failed to fetch item data: ${error instanceof Error ? error.message : 'Unknown error'}`);
//       }
//     };

//     fetchItemId();
// }, [router, attributeList]);
//   const isServiceLoaded = (serviceNameEnum: string) => {
//     return attributeList.some((service) => service.serviceNameEnum === serviceNameEnum);
//   };

//   const handleBack = () => {
//   if (onBack) {
//     console.warn('handleBack: Triggering onBack to navigate to MobileListView');
//     onBack();
//   } else {
//     console.warn('handleBack: onBack not provided, navigation may fail');
//   }
// };
 

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

//   const handleRead = (serviceUuid: string, characteristicUuid: string, name: string) => {
//     setLoadingStates((prev) => ({ ...prev, [characteristicUuid]: true }));
//     readBleCharacteristic(serviceUuid, characteristicUuid, device.macAddress, (data: any, error: any) => {
//       setLoadingStates((prev) => ({ ...prev, [characteristicUuid]: false }));
//       if (data) {
//         setUpdatedValues((prev) => ({
//           ...prev,
//           [characteristicUuid]: data.realVal,
//         }));
//       }
//     });
//   };

//   const handleWrite = (value: string | number) => {
//     const cmdService = attributeList.find((service) => service.serviceNameEnum === 'CMD_SERVICE');
//     if (!cmdService) {
//       toast.error('CMD service not available');
//       return;
//     }
//     const pubkCharacteristic = cmdService.characteristicList.find(
//       (char: any) => char.name.toLowerCase() === 'pubk'
//     );
//     if (!pubkCharacteristic) {
//       toast.error('pubk characteristic not found in CMD service');
//       return;
//     }
//     writeBleCharacteristic(
//       cmdService.uuid,
//       pubkCharacteristic.uuid,
//       value,
//       device.macAddress,
//       (data: any, error: any) => {
//         if (!data) {
//           toast.error(`Failed to write to ${pubkCharacteristic.name}`);
//         }
//       }
//     );

//     setTimeout(() => {
//       handleRead(cmdService.uuid, pubkCharacteristic.uuid, device.name);
//     }, 1000);
//   };

//   const handleRefreshService = () => {
//     if (onRequestServiceData) {
//       onRequestServiceData('CMD');
//     }
//   };

//   const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     setDuration(Number(e.target.value));
//   };

//   const handleSubmit = async () => {
//     if (!itemId) {
//       // toast.error('Item ID not available');
//       return;
//     }
//     if (!duration) {
//       toast.error('Please select a duration');
//       return;
//     }
//     if (!Number.isInteger(duration) || duration < 0) {
//       toast.error('Duration must be a positive integer');
//       return;
//     }

//     setIsSubmitting(true);

//     try {
//       const authToken = localStorage.getItem('access_token');
//       if (!authToken) {
//         // toast.error('Please sign in to generate a code');
//         router.push('/signin');
//         return;
//       }

//       const query = `
//         mutation GenerateDaysCode($itemId: ID!, $codeDays: Int!) {
//           generateDaysCode(generateDaysCodeInput: {
//             itemId: $itemId,
//             codeDays: $codeDays
//           }) {
//             codeType
//             codeHex
//             codeDec
//           }
//         }
//       `;

//       const response = await fetch(apiUrl, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           Authorization: `Bearer ${authToken}`,
//         },
//         body: JSON.stringify({
//           query,
//           variables: { itemId, codeDays: duration },
//         }),
//       });

//       if (!response.ok) {
//         const errorText = await response.text();
//         throw new Error(`HTTP error ${response.status}: ${errorText}`);
//       }

//       const responseData = await response.json();

//       if (responseData.errors) {
//         const errorMessages = responseData.errors
//           .map((error: { message: string }) => error.message)
//           .join(', ');
//         throw new Error(`GraphQL error: ${errorMessages}`);
//       }

//       const { generateDaysCode } = responseData.data;
//       if (!generateDaysCode) {
//         throw new Error('No data returned from generateDaysCode');
//       }

//       const { codeDec } = generateDaysCode;
//       setGeneratedCode(codeDec);
//       toast.success(`Code: ${codeDec} generated successfully`, { duration: 1000 });

//       console.info('attributeList:', attributeList);
//       const cmdService = attributeList.find((service) => service.serviceNameEnum === 'CMD_SERVICE');
//       if (cmdService) {
//         console.info('cmdService:', cmdService);
//         const pubkCharacteristic = cmdService.characteristicList.find(
//           (char: any) => char.name.toLowerCase() === 'pubk'
//         );
//         console.info('pubkCharacteristic:', pubkCharacteristic?.name);
//         if (pubkCharacteristic) {
//           setUpdatedValues((prev) => ({
//             ...prev,
//             [pubkCharacteristic.uuid]: codeDec,
//           }));
//           setActiveCharacteristic(pubkCharacteristic);
//           handleWrite(String(codeDec));
//         } else {
//           toast.error('pubk characteristic not found in CMD service');
//         }
//       } else {
//         toast.error('CMD service not available');
//       }
//     } catch (error) {
//       console.error('Error generating code:', error);
//       const message = error instanceof Error ? error.message : 'Unknown error occurred';
//       toast.error(`Failed to generate code: ${message}`);
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   const handleRetrieveCodes = async () => {
//     if (!itemId) {
//       toast.error('Item ID not available');
//       return;
//     }

//     const distributorId = localStorage.getItem('distributorId');
//     if (!distributorId) {
//       toast.error('Distributor ID not available. Please sign in.');
//       router.push('/signin');
//       return;
//     }

//     setIsRetrieving(true);

//     try {
//       const authToken = localStorage.getItem('access_token');
//       if (!authToken) {
//         toast.error('Please sign in to retrieve codes');
//         router.push('/signin');
//         return;
//       }

//       const query = `
//         query GetAllCodeEventsForSpecificItemByDistributor($itemId: ID!, $distributorId: ID!, $first: Int!) {
//           getAllCodeEventsForSpecificItemByDistributor(itemId: $itemId, distributorId: $distributorId, first: $first) {
//             page {
//               edges {
//                 node {
//                   codeDecString
//                 }
//               }
//             }
//           }
//         }
//       `;

//       const response = await fetch(apiUrl, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           Authorization: `Bearer ${authToken}`,
//         },
//         body: JSON.stringify({
//           query,
//           variables: { itemId, distributorId, first: 1 },
//         }),
//       });

//       if (!response.ok) {
//         const errorText = await response.text();
//         throw new Error(`HTTP error ${response.status}: ${errorText}`);
//       }

//       const responseData = await response.json();

//       if (responseData.errors) {
//         const errorMessages = responseData.errors
//           .map((error: { message: string }) => error.message)
//           .join(', ');
//         throw new Error(`GraphQL error: ${errorMessages}`);
//       }

//       const codeEventsData = responseData.data?.getAllCodeEventsForSpecificItemByDistributor?.page?.edges || [];
//       if (codeEventsData.length > 0) {
//         const codeDec = codeEventsData[0].node.codeDecString;
//         setGeneratedCode(codeDec);
//         toast.success(`Code: ${codeDec} retrieved successfully`, { duration: 1000 });

//         const cmdService = attributeList.find((service) => service.serviceNameEnum === 'CMD_SERVICE');
//         if (cmdService) {
//           const pubkCharacteristic = cmdService.characteristicList.find(
//             (char: any) => char.name.toLowerCase() === 'pubk'
//           );
//           if (pubkCharacteristic) {
//             setUpdatedValues((prev) => ({
//               ...prev,
//               [pubkCharacteristic.uuid]: codeDec,
//             }));
//             setActiveCharacteristic(pubkCharacteristic);
//             handleWrite(String(codeDec));
//           } else {
//             toast.error('pubk characteristic not found in CMD service');
//           }
//         } else {
//           toast.error('CMD service not available');
//         }
//       } else {
//         toast.error('No codes found for this device');
//       }
//     } catch (error) {
//       const message = error instanceof Error ? error.message : 'Unknown error occurred';
//       toast.error(`Failed to retrieve code: ${message}`);
//     } finally {
//       setIsRetrieving(false);
//     }
//   };

//   return (
//     <div className="max-w-md mx-auto bg-gradient-to-b from-[#24272C] to-[#0C0C0E] min-h-screen text-white">
//       <Toaster />
//       <div className="p-4 flex items-center">
//         <button onClick={handleBack} className="mr-4">
//           <ArrowLeft className="w-6 h-6 text-gray-400" />
//         </button>
//         <h1 className="text-lg font-semibold flex-1">Access Codes</h1>
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
//       <div className="p-4">
//         {isLoadingService === 'CMD' && (
//           <div className="w-full bg-gray-800 h-1 mb-4 rounded-full overflow-hidden">
//             <div
//               className="bg-blue-500 h-full transition-all duration-300 ease-in-out"
//               style={{ width: serviceLoadingProgress > 0 ? `${serviceLoadingProgress}%` : '100%' }}
//             ></div>
//           </div>
//         )}
//         <div className="flex justify-between items-center mb-4">
//           <button
//             onClick={handleRefreshService}
//             className="flex items-center space-x-1 bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded-md text-sm transition-colors"
//             disabled={isLoadingService !== null}
//           >
//             <RefreshCw size={14} className={isLoadingService ? 'animate-spin' : ''} />
//             <span>Refresh</span>
//           </button>
//         </div>
//         <div className="mb-6">
//           <div className="flex items-center space-x-2 mb-3">
//             <label className="text-sm font-medium text-slate-300">Duration</label>
//           </div>
//           <div className="grid grid-cols-2 gap-3">
//             {[
//               { value: 1, label: '1 Day' },
//               { value: 3, label: '3 Days' },
//             ].map((option) => (
//               <label
//                 key={option.value}
//                 className={`relative cursor-pointer transition-all duration-200 ${
//                   duration === option.value
//                     ? 'transform scale-105'
//                     : 'hover:scale-102'
//                 }`}
//               >
//                 <input
//                   type="radio"
//                   name="duration"
//                   value={option.value}
//                   checked={duration === option.value}
//                   onChange={handleDurationChange}
//                   className="sr-only"
//                 />
//                 <div
//                   className={`p-4 rounded-xl border-2 transition-all duration-200 ${
//                     duration === option.value
//                       ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20'
//                       : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
//                   }`}
//                 >
//                   <div className="text-center">
//                     <div className="font-semibold text-white">{option.label}</div>
//                   </div>
//                   {duration === option.value && (
//                     <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
//                       <Check className="w-3 h-3 text-white" />
//                     </div>
//                   )}
//                 </div>
//               </label>
//             ))}
//           </div>
//         </div>
//         <div className="space-y-3 mb-6">
//           <button
//             className={`w-full py-3 px-4 rounded-xl font-semibold transition-all duration-200 ${
//               isSubmitting || !duration
//                 ? 'bg-gray-500 cursor-not-allowed text-slate-400'
//                 : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40'
//             }`}
//             onClick={handleSubmit}
//             disabled={isSubmitting || !duration}
//           >
//             {isSubmitting ? (
//               <div className="flex items-center justify-center space-x-2">
//                 <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
//                 <span>Generating...</span>
//               </div>
//             ) : (
//               'Generate Code'
//             )}
//           </button>
//           <button
//             className={`w-full py-3 px-4 rounded-xl font-semibold transition-all duration-200 ${
//               isRetrieving
//                 ? 'bg-slate-600 cursor-not-allowed text-slate-400'
//                 : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40'
//             }`}
//             onClick={handleRetrieveCodes}
//             disabled={isRetrieving}
//           >
//             {isRetrieving ? (
//               <div className="flex items-center justify-center space-x-2">
//                 <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
//                 <span>Retrieving...</span>
//               </div>
//             ) : (
//               'Retrieve Last Code'
//             )}
//           </button>
//         </div>
//         {activeService ? (
//           <div className="space-y-4">
//             {activeService.characteristicList
//               .filter((char: any) => char.name.toLowerCase() === 'pubk')
//               .map((char: any) => (
//                 <div key={char.uuid} className="border border-gray-700 rounded-lg overflow-hidden">
//                   <div className="flex justify-between items-center bg-gray-800 px-4 py-2">
//                     <span className="text-sm font-medium">{char.name}</span>
//                     <div className="flex space-x-2"></div>
//                   </div>
//                   <div className="p-4 space-y-2">
//                     <div className="flex items-center justify-between group">
//                       <div className="flex-grow">
//                         <p className="text-xs text-gray-400">Current Value</p>
//                         <p className="text-sm font-mono">
//                           {updatedValues[char.uuid] !== undefined
//                             ? updatedValues[char.uuid]
//                             : formatValue(char)}
//                         </p>
//                       </div>
//                       <button
//                         className="p-2 text-gray-400 hover:text-blue-500 focus:text-blue-500 transition-colors"
//                         onClick={() => {
//                           const valueToCopy =
//                             updatedValues[char.uuid] !== undefined
//                               ? updatedValues[char.uuid]
//                               : formatValue(char);
//                           navigator.clipboard.writeText(String(valueToCopy));
//                           toast.success('Value copied to clipboard', { duration: 1000 });
//                         }}
//                         aria-label="Copy to clipboard"
//                       >
//                         <Clipboard size={16} />
//                       </button>
//                     </div>
//                   </div>
//                 </div>
//               ))}
//           </div>
//         ) : (
//           <div className="p-6 text-center text-gray-400">
//             {isLoadingService === 'CMD' ? (
//               <p>Loading CMD service data...</p>
//             ) : (
//               <div>
//                 <p>No data available for this service</p>
//                 {onRequestServiceData && (
//                   <button
//                     onClick={() => onRequestServiceData('CMD')}
//                     className="mt-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-md text-white text-sm transition-colors"
//                   >
//                     Load CMD Service Data
//                   </button>
//                 )}
//               </div>
//             )}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };

// export default DeviceDetailView;
