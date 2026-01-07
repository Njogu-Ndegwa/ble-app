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
// import { useI18n } from '@/i18n';

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
//   <div className="flex items-start p-3 rounded-lg animate-pulse" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
//     <div className="w-12 h-12 rounded-full mr-3" style={{ background: 'var(--bg-tertiary)' }}></div>
//     <div className="flex-1">
//       <div className="h-4 rounded w-2/3 mb-2" style={{ background: 'var(--bg-tertiary)' }}></div>
//       <div className="h-3 rounded w-1/2 mb-2" style={{ background: 'var(--bg-tertiary)' }}></div>
//       <div className="h-3 rounded w-1/3" style={{ background: 'var(--bg-tertiary)' }}></div>
//     </div>
//     <div className="w-5 h-5 rounded-full" style={{ background: 'var(--bg-tertiary)' }}></div>
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
//   const { t } = useI18n();
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
//     <div className="flex-1 overflow-y-auto" style={{ position: 'relative', zIndex: 1 }}>
//       <div className="p-4 max-w-md mx-auto">
//         {/* Header */}
//         <div className="flex justify-between items-center mb-4">
//           <div className="text-center flex-1">
//             <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{t('My Devices')}</h2>
//           </div>
//           <div className="relative">
//             <div
//               onClick={handleRescan}
//               className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
//                 items.length === 0 && isScanning ? 'animate-spin' : ''
//               }`}
//               style={{
//                 background: 'var(--bg-secondary)',
//                 border: '1px solid var(--border)',
//                 color: 'var(--text-secondary)',
//                 cursor: 'pointer',
//               }}
//               onMouseEnter={(e) => {
//                 e.currentTarget.style.background = 'var(--bg-tertiary)';
//                 e.currentTarget.style.color = 'var(--accent)';
//                 e.currentTarget.style.borderColor = 'var(--accent)';
//               }}
//               onMouseLeave={(e) => {
//                 e.currentTarget.style.background = 'var(--bg-secondary)';
//                 e.currentTarget.style.color = 'var(--text-secondary)';
//                 e.currentTarget.style.borderColor = 'var(--border)';
//               }}
//             >
//               <RefreshCcw size={16} />
//             </div>
//           </div>
//         </div>

//         {/* QR Code Input */}
//         <div className="relative mb-4">
//           <input
//             type="text"
//             className="form-input"
//             style={{ paddingRight: 80 }}
//             placeholder={t('Enter QR code or scan...')}
//             value={qrCodeInput}
//             onChange={(e) => setQrCodeInput(e.target.value)}
//             onKeyDown={(e) => {
//               if (e.key === 'Enter') {
//                 handleSubmitQrCode(e);
//               }
//             }}
//           />
//           <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-3">
//             <div
//               className="cursor-pointer"
//               onClick={(e) => {
//                 e.stopPropagation();
//                 onScanQrCode();
//               }}
//             >
//               <Camera size={18} style={{ color: 'var(--text-secondary)' }} className="hover:opacity-80 transition-opacity" />
//             </div>
//             <div
//               className="cursor-pointer"
//               onClick={handleSubmitQrCode}
//             >
//               <Send size={18} style={{ color: 'var(--text-secondary)' }} className="hover:opacity-80 transition-opacity" />
//             </div>
//           </div>
//         </div>

//         {/* Sort and Filter */}
//         {/* <div className="flex gap-2 mb-4">
//           <button
//             className="flex-1 px-4 py-2 border border-[#52545c] rounded-lg text-white text-sm flex items-center justify-between bg-gray-800"
//             onClick={(e) => e.stopPropagation()}
//           >
//             {t('Sort by...')}
//             <span className="text-xs">
//               <ArrowUpDown />
//             </span>
//           </button>
//           <button
//             className="flex-1 px-4 py-2 border border-[#52545c] rounded-lg text-white text-sm flex items-center justify-between bg-gray-800"
//             onClick={(e) => e.stopPropagation()}
//           >
//             {t('Filter')}
//             <span className="text-lg">
//               <ListFilter />
//             </span>
//           </button>
//         </div> */}

//         {/* List Items or Skeleton Loaders */}
//         <div className="space-y-3">
//           {items.length === 0 && isScanning ? (
//             renderSkeletons()
//           ) : filteredItems.length > 0 ? (
//             <div className="text-center py-6" style={{ color: 'var(--text-secondary)' }}>
//              {t('Scan or enter a QR code to connect to device.')}
//             </div>
//           ) : (
//             <div className="text-center py-6" style={{ color: 'var(--text-secondary)' }}>
//               {qrCodeInput ? t('No devices match your input.') : t('No devices found. Try entering or scanning a QR code.')}
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// };

// export default MobileListView;


'use client';

import React, { useEffect, useState } from 'react';
import {
  Search,
  Camera,
  RefreshCcw,
  BluetoothSearching,
  BluetoothConnected,
} from 'lucide-react';
import { BleDevice } from './page';
import { useI18n } from '@/i18n';

interface MobileListViewProps {
  items: BleDevice[];
  onStartConnection: (macAddress: string) => void;
  connectedDevice: string | null;
  onScanQrCode: () => void;
  onRescanBleItems: () => void;
  isScanning: boolean;
}

const DeviceItemSkeleton = () => (
  <div className="flex items-start p-3 rounded-lg animate-pulse" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
    <div className="w-12 h-12 rounded-full mr-3" style={{ background: 'var(--bg-tertiary)' }}></div>
    <div className="flex-1">
      <div className="h-4 rounded w-2/3 mb-2" style={{ background: 'var(--bg-tertiary)' }}></div>
      <div className="h-3 rounded w-1/2 mb-2" style={{ background: 'var(--bg-tertiary)' }}></div>
      <div className="h-3 rounded w-1/3" style={{ background: 'var(--bg-tertiary)' }}></div>
    </div>
    <div className="w-5 h-5 rounded-full" style={{ background: 'var(--bg-tertiary)' }}></div>
  </div>
);

const MobileListView: React.FC<MobileListViewProps> = ({
  items,
  onStartConnection,
  connectedDevice,
  onScanQrCode,
  onRescanBleItems,
  isScanning,
}) => {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Filter items based on search query
  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.macAddress.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDeviceClick = async (macAddress: string) => {
    onStartConnection(macAddress);
  };

  const handleRescan = () => {
    onRescanBleItems();
  };


  // Generate skeleton loaders
  const renderSkeletons = () => {
    return Array(5).fill(0).map((_, index) => (
      <DeviceItemSkeleton key={`skeleton-${index}`} />
    ));
  };

  return (
    <div className="flex-1 overflow-y-auto" style={{ position: 'relative', zIndex: 1 }}>
      <div className="p-4 max-w-md mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div className="text-center flex-1">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{t('My Devices')}</h2>
          </div>
          <div className="relative">
            <div
              onClick={handleRescan}
              className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
                items.length === 0 && isScanning ? 'animate-spin' : ''
              }`}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-tertiary)';
                e.currentTarget.style.color = 'var(--accent)';
                e.currentTarget.style.borderColor = 'var(--accent)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--bg-secondary)';
                e.currentTarget.style.color = 'var(--text-secondary)';
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
            >
              <RefreshCcw size={16} />
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mb-4">
          <input
            type="text"
            className="form-input"
            style={{ paddingRight: 80 }}
            placeholder={t('Search devices...') || 'Search devices...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-3">
            <div
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onScanQrCode();
              }}
            >
              <Camera size={18} style={{ color: 'var(--text-secondary)' }} className="hover:opacity-80 transition-opacity" />
            </div>
            <Search className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
          </div>
        </div>

        {/* Sort and Filter */}
        {/* <div className="flex gap-2 mb-4">
          <button
            className="flex-1 px-4 py-2 border border-[#52545c] rounded-lg text-white text-sm flex items-center justify-between bg-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            {t('Sort by...')}
            <span className="text-xs">
              <ArrowUpDown />
            </span>
          </button>
          <button
            className="flex-1 px-4 py-2 border border-[#52545c] rounded-lg text-white text-sm flex items-center justify-between bg-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            {t('Filter')}
            <span className="text-lg">
              <ListFilter />
            </span>
          </button>
        </div> */}

        {/* List Items or Skeleton Loaders */}
        <div className="space-y-3">
          {items.length === 0 && isScanning ? (
            renderSkeletons()
          ) : filteredItems.length > 0 ? (
            filteredItems.map((item) => (
              <div
                key={item.macAddress}
                className="flex items-start p-3 rounded-lg cursor-pointer transition-colors"
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-tertiary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--bg-secondary)';
                }}
                onClick={() => handleDeviceClick(item.macAddress)}
              >
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-12 h-12 rounded-full mr-3 object-contain"
                    style={{ background: 'var(--bg-tertiary)' }}
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full mr-3 flex items-center justify-center" style={{ background: 'var(--bg-tertiary)' }}>
                    <BluetoothSearching size={20} style={{ color: 'var(--text-muted)' }} />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="text-[14px] font-medium" style={{ color: 'var(--text-primary)' }}>{item.name}</h3>
                  <p className="text-[10px] mt-1" style={{ color: 'var(--text-secondary)' }}>{item.macAddress}</p>
                  <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{item.rssi}</p>
                </div>
                <span className="text-lg">
                  {item.macAddress === connectedDevice ? (
                    <BluetoothConnected style={{ color: 'var(--accent)' }} />
                  ) : (
                    <BluetoothSearching style={{ color: 'var(--text-secondary)' }} />
                  )}
                </span>
              </div>
            ))
          ) : (
            <div className="text-center py-6" style={{ color: 'var(--text-secondary)' }}>
              {searchQuery ? (t('No devices match your search.') || 'No devices match your search.') : (t('No devices found. Try scanning again.') || 'No devices found. Try scanning again.')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MobileListView;