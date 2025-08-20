'use client';

import React, { useEffect, useState } from 'react';
import {
  Camera,
  RefreshCcw,
  ArrowUpDown,
  ListFilter,
  Send,
} from 'lucide-react';
import { BleDevice } from './page';

interface MobileListViewProps {
  items: BleDevice[];
  onStartConnection: (macAddress: string) => void;
  connectedDevice: string | null;
  onScanQrCode: () => void;
  onRescanBleItems: () => void;
  isScanning: boolean;
  onSubmitQrCode: (code: string) => void;
}

const DeviceItemSkeleton = () => (
  <div className="flex items-start p-3 rounded-lg bg-[#2A2F33] animate-pulse">
    <div className="w-12 h-12 rounded-full mr-3 bg-[#3A3F43]"></div>
    <div className="flex-1">
      <div className="h-4 bg-[#3A3F43] rounded w-2/3 mb-2"></div>
      <div className="h-3 bg-[#3A3F43] rounded w-1/2 mb-2"></div>
      <div className="h-3 bg-[#3A3F43] rounded w-1/3"></div>
    </div>
    <div className="w-5 h-5 rounded-full bg-[#3A3F43]"></div>
  </div>
);

const MobileListView: React.FC<MobileListViewProps> = ({
  items,
  onStartConnection,
  connectedDevice,
  onScanQrCode,
  onRescanBleItems,
  isScanning,
  onSubmitQrCode,
}) => {
  const [qrCodeInput, setQrCodeInput] = useState<string>('');

  // Filter items based on QR code input
  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(qrCodeInput.toLowerCase()) ||
    item.macAddress.toLowerCase().includes(qrCodeInput.toLowerCase())
  );

  const handleDeviceClick = async (macAddress: string) => {
    onStartConnection(macAddress);
  };

  const handleRescan = () => {
    onRescanBleItems();
  };

  const handleSubmitQrCode = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    if (qrCodeInput.trim()) {
      onSubmitQrCode(qrCodeInput.trim().slice(-6).toLowerCase());
      setQrCodeInput(''); // Clear input after submission
    }
  };

  // Generate skeleton loaders
  const renderSkeletons = () => {
    return Array(5).fill(0).map((_, index) => (
      <DeviceItemSkeleton key={`skeleton-${index}`} />
    ));
  };

  return (
    <div className="relative max-w-md mx-auto bg-gradient-to-b from-[#24272C] to-[#0C0C0E] min-h-screen overflow-hidden">
      <div className="p-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div className="text-center flex-1">
            <h2 className="text-white font-medium">My Devices</h2>
          </div>
          <div className="relative">
            <RefreshCcw
              onClick={handleRescan}
              className={`w-6 h-6 text-gray-400 ${items.length === 0 && isScanning ? 'animate-spin' : ''}`}
            />
          </div>
        </div>

        {/* QR Code Input */}
        <div className="relative mb-4">
          <input
            type="text"
            className="w-full px-4 py-2 border border-gray-700 bg-gray-800 rounded-lg pr-20 focus:outline-none text-white"
            placeholder="Enter QR code or scan..."
            value={qrCodeInput}
            onChange={(e) => setQrCodeInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSubmitQrCode(e);
              }
            }}
          />
          <div className="absolute right-3 top-2.5 flex items-center space-x-3">
            <div
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onScanQrCode();
              }}
            >
              <Camera size={18} className="text-gray-400 hover:text-white transition-colors" />
            </div>
            <div
              className="cursor-pointer"
              onClick={handleSubmitQrCode}
            >
              <Send size={18} className="text-gray-400 hover:text-white transition-colors" />
            </div>
          </div>
        </div>

        {/* Sort and Filter */}
        <div className="flex gap-2 mb-4">
          <button
            className="flex-1 px-4 py-2 border border-[#52545c] rounded-lg text-white text-sm flex items-center justify-between bg-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            Sort by...
            <span className="text-xs">
              <ArrowUpDown />
            </span>
          </button>
          <button
            className="flex-1 px-4 py-2 border border-[#52545c] rounded-lg text-white text-sm flex items-center justify-between bg-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            Filter
            <span className="text-lg">
              <ListFilter />
            </span>
          </button>
        </div>

        {/* List Items or Skeleton Loaders */}
        <div className="space-y-3">
          {items.length === 0 && isScanning ? (
            renderSkeletons()
          ) : filteredItems.length > 0 ? (
            <div className="text-center py-6 text-gray-400">
             Scan or enter a QR code to connect to device.
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400">
              {qrCodeInput ? "No devices match your input." : "No devices found. Try entering or scanning a QR code."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MobileListView;

//working before adding code
// 'use client';

// import React, { useEffect, useState } from 'react';
// import {
//   Camera,
//   RefreshCcw,
//   ArrowUpDown,
//   ListFilter,
//   Send,
// } from 'lucide-react';
// import { BleDevice } from './page';

// interface MobileListViewProps {
//   items: BleDevice[];
//   onStartConnection: (macAddress: string) => void;
//   connectedDevice: string | null;
//   onScanQrCode: () => void;
//   onRescanBleItems: () => void;
//   isScanning: boolean;
//   onSubmitQrCode: (code: string) => void;
// }

// const DeviceItemSkeleton = () => (
//   <div className="flex items-start p-3 rounded-lg bg-[#2A2F33] animate-pulse">
//     <div className="w-12 h-12 rounded-full mr-3 bg-[#3A3F43]"></div>
//     <div className="flex-1">
//       <div className="h-4 bg-[#3A3F43] rounded w-2/3 mb-2"></div>
//       <div className="h-3 bg-[#3A3F43] rounded w-1/2 mb-2"></div>
//       <div className="h-3 bg-[#3A3F43] rounded w-1/3"></div>
//     </div>
//     <div className="w-5 h-5 rounded-full bg-[#3A3F43]"></div>
//   </div>
// );

// const MobileListView: React.FC<MobileListViewProps> = ({
//   items,
//   onStartConnection,
//   connectedDevice,
//   onScanQrCode,
//   onRescanBleItems,
//   isScanning,
//   onSubmitQrCode,
// }) => {
//   const [qrCodeInput, setQrCodeInput] = useState<string>('');

//   // Filter items based on QR code input
//   const filteredItems = items.filter((item) =>
//     item.name.toLowerCase().includes(qrCodeInput.toLowerCase()) ||
//     item.macAddress.toLowerCase().includes(qrCodeInput.toLowerCase())
//   );

//   const handleDeviceClick = async (macAddress: string) => {
//     onStartConnection(macAddress);
//   };

//   const handleRescan = () => {
//     onRescanBleItems();
//   };

//   const handleSubmitQrCode = (e: React.MouseEvent | React.KeyboardEvent) => {
//     e.preventDefault();
//     if (qrCodeInput.trim()) {
//       onSubmitQrCode(qrCodeInput.trim().slice(-6).toLowerCase());
//       setQrCodeInput(''); // Clear input after submission
//     }
//   };

//   // Generate skeleton loaders
//   const renderSkeletons = () => {
//     return Array(5).fill(0).map((_, index) => (
//       <DeviceItemSkeleton key={`skeleton-${index}`} />
//     ));
//   };

//   return (
//     <div className="relative max-w-md mx-auto bg-gradient-to-b from-[#24272C] to-[#0C0C0E] min-h-screen overflow-hidden">
//       <div className="p-4">
//         {/* Header */}
//         <div className="flex justify-between items-center mb-4">
//           <div className="text-center flex-1">
//             <h2 className="text-white font-medium">My Devices</h2>
//           </div>
//           <div className="relative">
//             <RefreshCcw
//               onClick={handleRescan}
//               className={`w-6 h-6 text-gray-400 ${items.length === 0 && isScanning ? 'animate-spin' : ''}`}
//             />
//           </div>
//         </div>

//         {/* QR Code Input */}
//         <div className="relative mb-4">
//           <input
//             type="text"
//             className="w-full px-4 py-2 border border-gray-700 bg-gray-800 rounded-lg pr-20 focus:outline-none text-white"
//             placeholder="Enter QR code or scan..."
//             value={qrCodeInput}
//             onChange={(e) => setQrCodeInput(e.target.value)}
//             onKeyDown={(e) => {
//               if (e.key === 'Enter') {
//                 handleSubmitQrCode(e);
//               }
//             }}
//           />
//           <div className="absolute right-3 top-2.5 flex items-center space-x-3">
//             <div
//               className="cursor-pointer"
//               onClick={(e) => {
//                 e.stopPropagation();
//                 onScanQrCode();
//               }}
//             >
//               <Camera size={18} className="text-gray-400 hover:text-white transition-colors" />
//             </div>
//             <div
//               className="cursor-pointer"
//               onClick={handleSubmitQrCode}
//             >
//               <Send size={18} className="text-gray-400 hover:text-white transition-colors" />
//             </div>
//           </div>
//         </div>

//         {/* Sort and Filter */}
//         <div className="flex gap-2 mb-4">
//           <button
//             className="flex-1 px-4 py-2 border border-[#52545c] rounded-lg text-white text-sm flex items-center justify-between bg-gray-800"
//             onClick={(e) => e.stopPropagation()}
//           >
//             Sort by...
//             <span className="text-xs">
//               <ArrowUpDown />
//             </span>
//           </button>
//           <button
//             className="flex-1 px-4 py-2 border border-[#52545c] rounded-lg text-white text-sm flex items-center justify-between bg-gray-800"
//             onClick={(e) => e.stopPropagation()}
//           >
//             Filter
//             <span className="text-lg">
//               <ListFilter />
//             </span>
//           </button>
//         </div>

//         {/* List Items or Skeleton Loaders */}
//         <div className="space-y-3">
//           {items.length === 0 && isScanning ? (
//             renderSkeletons()
//           ) : filteredItems.length > 0 ? (
//             <div className="text-center py-6 text-gray-400">
//              Scan or enter a QR code to connect to device.
//             </div>
//           ) : (
//             <div className="text-center py-6 text-gray-400">
//               {qrCodeInput ? "No devices match your input." : "No devices found. Try entering or scanning a QR code."}
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// };

// export default MobileListView;
