

// 'use client'

// import React, { useState } from 'react';
// import { ArrowLeft, Share2 } from 'lucide-react';
// import { useRouter } from 'next/navigation';

// interface DeviceDetailProps {
//   device: {
//     macAddress: string;
//     name: string;
//     rssi: string;
//     imageUrl? : string;
//     firmwareVersion?: string;
//     deviceId?: string;
//   };
//   attributeList: any[];
//   onBack?: () => void;
// }

// const DeviceDetailView: React.FC<DeviceDetailProps> = ({ device, attributeList, onBack }) => {
//   const router = useRouter();

//   // Dynamically generate tabs from attributeList
//   const fixedTabs = [
//     { id: 'ATT', label: 'ATT', serviceNameEnum: 'ATT_SERVICE' },
//     { id: 'CMD', label: 'CMD', serviceNameEnum: 'CMD_SERVICE' },
//     { id: 'SVC', label: 'SVC', serviceNameEnum: 'STS_SERVICE' }, // SVC maps to STS_SERVICE
//     { id: 'DTA', label: 'DTA', serviceNameEnum: 'DTA_SERVICE' },
//     { id: 'DIA', label: 'DIA', serviceNameEnum: 'DIA_SERVICE' },
//   ];

//   // Filter tabs to only include those with matching services in attributeList
//   const availableTabs = fixedTabs.filter((tab) =>
//     attributeList.some((service) => service.serviceNameEnum === tab.serviceNameEnum)
//   );

//   // Set the initial active tab to the first available tab, or 'ATT' if none are available
//   const [activeTab, setActiveTab] = useState(availableTabs[0]?.id || 'ATT');
//   const [characteristicValues, setCharacteristicValues] = useState<Record<string, string>>({});

//   // Function to derive a display name from the characteristic UUID
//   const getCharacteristicName = (uuid: string) => {
//     const id = uuid.slice(4, 8); // Extracts the unique part (e.g., '1001' from '9b071001-...')
//     return `Characteristic ${id}`;
//   };

//   // Mock function to simulate reading characteristic value
//   const readCharacteristic = async (serviceUuid: string, characteristicUuid: string) => {
//     return new Promise<string>((resolve) => {
//       setTimeout(() => {
//         resolve(`Value for ${characteristicUuid}`);
//       }, 1000); // Simulate delay
//     });
//   };

//   // Handle reading the characteristic value
//   const handleRead = async (serviceUuid: string, characteristicUuid: string) => {
//     try {
//       const value = await readCharacteristic(serviceUuid, characteristicUuid);
//       setCharacteristicValues((prev) => ({ ...prev, [characteristicUuid]: value }));
//     } catch (error) {
//       console.error(`Failed to read characteristic ${characteristicUuid}:`, error);
//       setCharacteristicValues((prev) => ({ ...prev, [characteristicUuid]: 'Error reading value' }));
//     }
//   };

//   const handleBack = () => {
//     if (onBack) {
//       onBack();
//     } else {
//       router.back();
//     }
//   };

//   // Find the active service based on the active tab
//   const activeService = attributeList.find((service) =>
//     fixedTabs.some((tab) => tab.id === activeTab && tab.serviceNameEnum === service.serviceNameEnum)
//   );

//   return (
//     <div className="max-w-md mx-auto bg-gradient-to-b from-[#24272C] to-[#0C0C0E] min-h-screen text-white">
//       {/* Header */}
//       <div className="p-4 flex items-center">
//         <button onClick={handleBack} className="mr-4">
//           <ArrowLeft className="w-6 h-6 text-gray-400" />
//         </button>
//         <h1 className="text-lg font-semibold flex-1">Device Details</h1>
//         <Share2 className="w-5 h-5 text-gray-400" />
//       </div>

//       {/* Device Image and Basic Info */}
//       <div className="flex flex-col items-center p-6 pb-2">
//         <div className="relative mb-4">
//           <img
//             src={device.imageUrl}
//             alt={device.name}
//             className="w-40 h-40 object-contain"
//           />
//         </div>
//         <h2 className="text-xl font-semibold">{device.name}</h2>
//         <p className="text-sm text-gray-400 mt-1">{device.macAddress}</p>
//         <p className="text-sm text-gray-400 mt-1">{device.rssi}</p>
//       </div>

//       {/* Tabs */}
//       <div className="border-b border-gray-800">
//         <div className="flex justify-between px-4">
//           {fixedTabs.map((tab) => (
//             <button
//               key={tab.id}
//               className={`py-3 px-4 text-sm font-medium relative ${
//                 activeTab === tab.id ? 'text-blue-500' : 'text-gray-400'
//               }`}
//               onClick={() => setActiveTab(tab.id)}
//             >
//               {tab.label}
//               {activeTab === tab.id && (
//                 <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500"></div>
//               )}
//             </button>
//           ))}
//         </div>
//       </div>

//       {/* Content based on active tab */}
//       <div className="p-4">
//         {activeService ? (
//           <div className="space-y-4">
//             {activeService.characteristicList.map((char: any) => {
//               const name = getCharacteristicName(char.uuid);
//               const value = characteristicValues[char.uuid];
//               return (
//                 <div key={char.uuid} className="border border-gray-700 rounded-lg overflow-hidden">
//                   <div className="flex justify-between items-center bg-gray-800 px-4 py-2">
//                     <span className="text-sm font-medium">{name}</span>
//                     <button
//                       className="text-xs bg-gray-700 px-3 py-1 rounded"
//                       onClick={() => handleRead(activeService.uuid, char.uuid)}
//                     >
//                       Read
//                     </button>
//                   </div>
//                   <div className="p-4 space-y-2">
//                     <div>
//                       <p className="text-xs text-gray-400">Value</p>
//                       <p className="text-sm">{value || 'Not read yet'}</p>
//                     </div>
//                     <div>
//                       <p className="text-xs text-gray-400">UUID</p>
//                       <p className="text-sm">{char.uuid}</p>
//                     </div>
//                   </div>
//                 </div>
//               );
//             })}
//           </div>
//         ) : (
//           <div className="p-6 text-center text-gray-400">
//             <p>No data available for this tab</p>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };

// export default DeviceDetailView;

'use client'

import React, { useState } from 'react';
import { ArrowLeft, Share2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface DeviceDetailProps {
  device: {
    macAddress: string;
    name: string;
    rssi: string;
    imageUrl?: string;
  };
  attributeList: any[];
  onBack?: () => void;
}

const DeviceDetailView: React.FC<DeviceDetailProps> = ({ device, attributeList, onBack }) => {
  const router = useRouter();

  // Service mapping configuration
  const fixedTabs = [
    { id: 'ATT', label: 'ATT', serviceNameEnum: 'ATT_SERVICE' },
    { id: 'CMD', label: 'CMD', serviceNameEnum: 'CMD_SERVICE' },
    { id: 'SVC', label: 'SVC', serviceNameEnum: 'STS_SERVICE' },
    { id: 'DTA', label: 'DTA', serviceNameEnum: 'DTA_SERVICE' },
    { id: 'DIA', label: 'DIA', serviceNameEnum: 'DIA_SERVICE' },
  ];

  // State management
  const [activeTab, setActiveTab] = useState(fixedTabs[0].id);

  // Get active service data
  const activeService = attributeList.find(service => 
    fixedTabs.find(tab => 
      tab.id === activeTab && tab.serviceNameEnum === service.serviceNameEnum
    )
  );

  // Handle back navigation
  const handleBack = () => onBack ? onBack() : router.back();

  // Format values based on type
  const formatValue = (characteristic: any) => {
    if (typeof characteristic.realVal === 'number') {
      switch (characteristic.valType) {
        case 0: return characteristic.realVal;
        case 1: return `${characteristic.realVal} mA`;
        case 2: return `${characteristic.realVal} mV`;
        default: return characteristic.realVal;
      }
    }
    return characteristic.realVal || 'N/A';
  };


  return (
    <div className="max-w-md mx-auto bg-gradient-to-b from-[#24272C] to-[#0C0C0E] min-h-screen text-white">
      {/* Header */}
      <div className="p-4 flex items-center">
        <button onClick={handleBack} className="mr-4">
          <ArrowLeft className="w-6 h-6 text-gray-400" />
        </button>
        <h1 className="text-lg font-semibold flex-1">Device Details</h1>
        <Share2 className="w-5 h-5 text-gray-400" />
      </div>

      {/* Device Image and Info */}
      <div className="flex flex-col items-center p-6 pb-2">
        <img 
          src={device.imageUrl} 
          alt={device.name}
          className="w-40 h-40 object-contain mb-4"
        />
        <h2 className="text-xl font-semibold">{device.name}</h2>
        <p className="text-sm text-gray-400 mt-1">{device.macAddress}</p>
        <p className="text-sm text-gray-400 mt-1">{device.rssi}</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-800">
        <div className="flex justify-between px-4">
          {fixedTabs.map(tab => {
            const serviceExists = attributeList.some(s => s.serviceNameEnum === tab.serviceNameEnum);
            return (
              <button
                key={tab.id}
                className={`py-3 px-4 text-sm font-medium relative ${
                  activeTab === tab.id ? 'text-blue-500' : 'text-gray-400'
                } ${!serviceExists ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={() => serviceExists && setActiveTab(tab.id)}
                disabled={!serviceExists}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Service Content */}
      <div className="p-4">
        {activeService ? (
          <div className="space-y-4">
            {activeService.characteristicList.map((char: any) => (
              <div key={char.uuid} className="border border-gray-700 rounded-lg overflow-hidden">
                <div className="flex justify-between items-center bg-gray-800 px-4 py-2">
                  <span className="text-sm font-medium">{char.name}</span>
                  <span className="text-xs text-gray-400">{char.uuid}</span>
                </div>
                <div className="p-4 space-y-2">
                  <div>
                    <p className="text-xs text-gray-400">Description</p>
                    <p className="text-sm">{char.desc}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Current Value</p>
                    <p className="text-sm font-mono">{formatValue(char)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center text-gray-400">
            <p>No data available for this service</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeviceDetailView;