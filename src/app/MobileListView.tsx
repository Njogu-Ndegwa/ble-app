// 'use client'

// import React, { useState } from 'react';
// import { BleDevice } from './page';
// import SearchBar from '@/components/SearchBar';
// import SortFilterBar from '@/components/SortFilterBar';
// import DeviceList from '@/components/DeviceList';
// import Header from '@/components/Header';
// import Sidebar from '@/components/Sidebar';
// import CustomKeypadPage from './CustomKeypadPage';
// interface MobileListViewProps {
//   items: BleDevice[];
//   onStartConnection: (macAddress: string) => void;
//   connectedDevice: string | null;
//   onScanQrCode: () => void;
//   onRescanBleItems: () => void;
//   isScanning: boolean;
//   onLogout?: () => void;
//   onSubPageChange?: (subPage: string) => void;
// }

// type PageType = 'assets' | 'dashboard' | 'customer' | 'team' | 'company' | 'maplocation' | 'settings' | 'location' | 'debug';

// const MobileListView: React.FC<MobileListViewProps> = ({
//   items,
//   onStartConnection,
//   connectedDevice,
//   onScanQrCode,
//   onRescanBleItems,
//   isScanning,
//   onLogout = () => console.log('Logout clicked'),
//   onSubPageChange,
// }) => {
//   const [isMenuOpen, setIsMenuOpen] = useState(false);
//   const [activePage, setActivePage] = useState<PageType>('assets');
//   const [activeSubPage, setActiveSubPage] = useState<string>('bledevices');
//   const [searchQuery, setSearchQuery] = useState<string>('');

//   const sidebarWidth = '80%';

//   const filteredItems = items.filter(
//     (item) =>
//       item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
//       item.macAddress.toLowerCase().includes(searchQuery.toLowerCase())
//   );

//   const handleContentClick = () => {
//     if (isMenuOpen) setIsMenuOpen(false);
//   };

//   const handleSubMenuItemClick = (menuId: PageType, itemId: string) => {
//     setActivePage(menuId);
//     setActiveSubPage(itemId);
//     setIsMenuOpen(false);
//     if (onSubPageChange) {
//       onSubPageChange(itemId);
//     }
//   };

//   const handleMenuOpen = () => setIsMenuOpen(true);

//   const renderPageContent = () => {
//     if (activePage === 'assets' && (activeSubPage === 'bledevices' || activeSubPage === 'cmd')) {
//       return (
//         <>
//           <SearchBar
//             searchQuery={searchQuery}
//             setSearchQuery={setSearchQuery}
//             onScanQrCode={onScanQrCode}
//             isMenuOpen={isMenuOpen}
//           />
//           <SortFilterBar isMenuOpen={isMenuOpen} />
//           <DeviceList
//             items={items}
//             filteredItems={filteredItems}
//             connectedDevice={connectedDevice}
//             onDeviceClick={onStartConnection}
//             isScanning={isScanning}
//             searchQuery={searchQuery}
//           />
//         </>
//       );
//     } 
//     if (activePage === 'team' && activeSubPage === 'members') {
//       return <CustomKeypadPage />;
//     }
//     else {
//       return (
//         <div className="flex items-center justify-center h-64">
//           <div className="text-center p-6 bg-[#2A2F33] rounded-lg">
//             <h3 className="text-xl font-medium text-white mb-2">
//               {activePage.charAt(0).toUpperCase() + activePage.slice(1)} -{' '}
//               {activeSubPage.charAt(0).toUpperCase() + activeSubPage.slice(1)}
//             </h3>
//             <p className="text-gray-400">Hello World</p>
//           </div>
//         </div>
//       );
//     }
//   };

//   const getPageTitle = () => {
//     if (activePage === 'assets' && activeSubPage === 'bledevices') return 'All Devices';
//     if (activePage === 'team' && activeSubPage === 'members') return 'Customer Access';
//     if (activePage === 'settings') return 'Settings';

//     return activePage.charAt(0).toUpperCase() + activePage.slice(1);
//   };

//   return (
//     <div className="relative max-w-md mx-auto bg-gradient-to-b from-[#24272C] to-[#0C0C0E] min-h-screen overflow-hidden">
//       <div
//         className="w-full transition-all duration-300"
//         style={{
//           transform: isMenuOpen ? `translateX(${sidebarWidth})` : 'translateX(0)',
//           opacity: isMenuOpen ? 0.3 : 1,
//         }}
//         onClick={handleContentClick}
//       >
//         <div className="p-4">
//           <Header
//             title={getPageTitle()}
//             showRefresh={activePage === 'assets' && activeSubPage === 'bledevices'}
//             isScanning={isScanning}
//             itemsLength={items.length}
//             onMenuOpen={handleMenuOpen}
//             onRefresh={onRescanBleItems}
//           />
//           {renderPageContent()}
//         </div>
//       </div>

//       <Sidebar
//         isMenuOpen={isMenuOpen}
//         sidebarWidth={sidebarWidth}
//         onClose={() => setIsMenuOpen(false)}
//         activePage={activePage}
//         activeSubPage={activeSubPage}
//         onSubMenuItemClick={handleSubMenuItemClick}
//         onLogout={onLogout}
//       />

//       {isMenuOpen && (
//         <div
//           className="fixed inset-0 bg-black transition-opacity duration-300"
//           style={{ opacity: 0.3, zIndex: 4 }}
//           onClick={() => setIsMenuOpen(false)}
//         />
//       )}
//     </div>
//   );
// };

// export default MobileListView;

// 'use client'

// import React, { useState, useEffect, useRef } from 'react';
// import { useRouter } from 'next/navigation';
// import { BleDevice } from './page';
// import SearchBar from '@/components/SearchBar';
// import SortFilterBar from '@/components/SortFilterBar';
// import DeviceList from '@/components/DeviceList';
// import Header from '@/components/Header';
// import Sidebar from '@/components/Sidebar';
// import LocationView from '@/components/LocationView';
// import MapLocationFinder from '@/components/MapLocationFinder';
// import SettingsView from '@/components/SettingsView';

// interface Contact {
//   name: string;
//   phoneNumber: string;
// }

// interface LocationData {
//   latitude: number;
//   longitude: number;
//   timestamp?: number;
//   [key: string]: any;
// }

// interface MobileListViewProps {
//   items: BleDevice[];
//   onStartConnection: (macAddress: string) => void;
//   connectedDevice: string | null;
//   onScanQrCode: () => void;
//   onRescanBleItems: () => void;
//   selectedImage: string | null;
//   setSelectedImage: (image: string | null) => void;
//   onChooseImage: () => void;
//   isScanning: boolean;
//   onLogout?: () => void;
//   onFingerprintVerification: () => void;
//   onTextRecognition: () => void;
//   onReadContacts: () => void;
//   contacts: Contact[];
//   setContacts: (contacts: Contact[]) => void;
//   isLocationActive: boolean;
//   lastKnownLocation: LocationData | null;
//   onStartLocation: () => void;
//   onStopLocation: () => void;
//   onGetLocation: () => void;
//   onCallPhone: (phoneNumber: string) => void;
//   onSendSms: (phoneNumber: string, message: string) => void;
//   onNetworkType: () => Promise<string>; // Update to return Promise<string>
// }

// type PageType = 'assets' | 'dashboard' | 'customer' | 'team' | 'company' | 'maplocation' | 'settings' | 'location' | 'debug';

// const MobileListView: React.FC<MobileListViewProps> = ({
//   items,
//   onStartConnection,
//   connectedDevice,
//   onScanQrCode,
//   onRescanBleItems,
//   isScanning,
//   onChooseImage,
//   selectedImage,
//   setSelectedImage,
//   onLogout = () => { },
//   onReadContacts,
//   onFingerprintVerification,
//   onTextRecognition,
//   contacts,
//   setContacts,
//   isLocationActive,
//   lastKnownLocation,
//   onStartLocation,
//   onStopLocation,
//   onGetLocation,
//   onCallPhone,
//   onSendSms,
//   onNetworkType,
// }) => {

//   useEffect(() => {
//     console.info(`MobileListView - contacts prop: ${contacts.length ? 'Yes, length ' + contacts.length : 'No'}`);
//   }, [contacts]);
//   const [isMenuOpen, setIsMenuOpen] = useState(false);
//   const [activePage, setActivePage] = useState<PageType>('assets');
//   const [activeSubPage, setActiveSubPage] = useState<string>('cmd');
//   const [searchQuery, setSearchQuery] = useState<string>('');
//   const initialized = useRef(false);
//   const intervalRef = useRef<NodeJS.Timeout | null>(null);
//   const [networkType, setNetworkType] = useState<string | null>(null); 

//   const sidebarWidth = '80%';
//    // Auto-start location tracking on component mount (only once)
//    useEffect(() => {
//     if (!initialized.current) {
//       initialized.current = true;

//       if (!isLocationActive) {
//         onStartLocation();
//       }

//       // Set up periodic location checks (every 5 minutes)
//       if (!intervalRef.current) {
//         const interval = setInterval(() => {
//           if (isLocationActive) {
//             onGetLocation();
//           }
//         }, 5 * 60 * 1000); // 5 minutes

//         intervalRef.current = interval;

//         // Initial location fetch (after a short delay)
//         setTimeout(() => {
//           if (isLocationActive) {
//             onGetLocation();
//           }
//         }, 1000);
//       }
//     }

//     // Clean up interval when component unmounts
//     return () => {
//       if (intervalRef.current) {
//         clearInterval(intervalRef.current);
//         intervalRef.current = null;
//       }
//     };
//   }, []);

//   // Manage interval based on active status
//   useEffect(() => {
//     // If location becomes inactive and we have an interval, clear it
//     if (!isLocationActive && intervalRef.current) {
//       clearInterval(intervalRef.current);
//       intervalRef.current = null;
//     }

//     // If location becomes active and we don't have an interval, create one
//     if (isLocationActive && !intervalRef.current) {
//       const interval = setInterval(() => {
//         onGetLocation();
//       }, 5 * 60 * 1000);

//       intervalRef.current = interval;

//       // Get location immediately when activated
//       onGetLocation();
//     }
//   }, [isLocationActive]);

//   // Debug networkType changes
//   useEffect(() => {
//     console.info(`MobileListView networkType: ${networkType || 'Not set'}`);
//   }, [networkType]);

//   const filteredItems = items.filter(
//     (item) =>
//       item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
//       item.macAddress.toLowerCase().includes(searchQuery.toLowerCase())
//   );

//   const handleContentClick = () => {
//     if (isMenuOpen) setIsMenuOpen(false);
//   };

//   const handleSubMenuItemClick = (menuId: PageType, itemId: string) => {
//     setActivePage(menuId);
//     setActiveSubPage(itemId);
//     setIsMenuOpen(false);
//     if (itemId === 'myfingers' || itemId === 'fingerprintverification') {
//       onFingerprintVerification();
//     } else if (itemId === 'textrecognition') {
//       onTextRecognition();
//     }
//   };


//   const handleMenuOpen = () => setIsMenuOpen(true);

//   const renderPageContent = () => {
//       if (activePage === 'assets' && (activeSubPage === 'bledevices' || activeSubPage === 'cmd')) {

//       return (
//         <>
//           <SearchBar
//             searchQuery={searchQuery}
//             setSearchQuery={setSearchQuery}
//             onScanQrCode={onScanQrCode}
//             isMenuOpen={isMenuOpen}
//           />
//           <SortFilterBar isMenuOpen={isMenuOpen} />
//           <DeviceList
//             items={items}
//             filteredItems={filteredItems}
//             connectedDevice={connectedDevice}
//             onDeviceClick={onStartConnection}
//             isScanning={isScanning}
//             searchQuery={searchQuery}
//           />
//         </>
//       );
//     } 

//     else if (activePage === 'settings') {
//       return (
//         <SettingsView
//           onChooseImage={onChooseImage}
//           onReadContacts={onReadContacts}
//           onFingerprintVerification={onFingerprintVerification}
//           onTextRecognition={onTextRecognition}
//           selectedImage={selectedImage}
//           setSelectedImage={setSelectedImage}
//           contacts={contacts}
//           setContacts={setContacts}
//           onCallPhone={onCallPhone}
//           onSendSms={onSendSms}
//           onNetworkType={async () => {
//             try {
//               const type = await onNetworkType();
//               setNetworkType(type); // Update local state
//               console.info("SettingsView: Network type set to", type);
//             } catch (error) {
//               console.error("SettingsView: Failed to get network type:", error);
//               // toast.error("Failed to get network type");
//             }
//           }}
//           networkType={networkType}
//           setNetworkType={setNetworkType}
//         />
//       );
//     } 
//     else if (activePage === 'maplocation') {
//       return <MapLocationFinder />;
//     } 
//     else if (activePage === 'location') {
//       return (
//         <LocationView
//           isLocationActive={isLocationActive}
//           handleStartLocationListener={onStartLocation}
//           handleStopLocationListener={onStopLocation}
//           handleGetLastLocation={onGetLocation}
//           lastKnownLocation={
//             lastKnownLocation
//               ? {
//                   ...lastKnownLocation,
//                   timestamp: Date.now(),
//                 }
//               : null
//           }
//         />
//       );
//     } else {
//       return (
//         <div className="flex items-center justify-center h-64">
//           <div className="text-center p-6 bg-[#2A2F33] rounded-lg">
//             <h3 className="text-xl font-medium text-white mb-2">
//               {activePage.charAt(0).toUpperCase() + activePage.slice(1)}
//             </h3>
//             <p className="text-gray-400">Content coming soon</p>
//           </div>
//         </div>
//       );
//     }
//   };

//   const getPageTitle = () => {
//     if (activePage === 'assets' && activeSubPage === 'bledevices') return 'All Devices';
//     if (activePage === 'settings') return 'Settings';
//     if (activePage === 'location') return 'Location Tracking';
//     return activePage.charAt(0).toUpperCase() + activePage.slice(1);
//   };


//   return (
//     <div className="relative max-w-md mx-auto bg-gradient-to-b from-[#24272C] to-[#0C0C0E] min-h-screen overflow-hidden">
//       <div
//         className="w-full transition-all duration-300"
//         style={{
//           transform: isMenuOpen ? `translateX(${sidebarWidth})` : 'translateX(0)',
//           opacity: isMenuOpen ? 0.3 : 1,
//         }}
//         onClick={handleContentClick}
//       >
//         <div className="p-4">
//           <Header
//             title={getPageTitle()}
//             showRefresh={activePage === 'assets' && activeSubPage === 'bledevices'}
//             isScanning={isScanning}
//             itemsLength={items.length}
//             onMenuOpen={handleMenuOpen}
//             onRefresh={onRescanBleItems}
//           />
//           {renderPageContent()}
//         </div>
//       </div>
//       <Sidebar
//         isMenuOpen={isMenuOpen}
//         sidebarWidth={sidebarWidth}
//         onClose={() => setIsMenuOpen(false)}
//         activePage={activePage}
//         activeSubPage={activeSubPage}
//         onSubMenuItemClick={handleSubMenuItemClick}
//         onLogout={onLogout}
//       />

//       {isMenuOpen && (
//         <div
//           className="fixed inset-0 bg-black transition-opacity duration-300"
//           style={{ opacity: 0.3, zIndex: 4 }}
//           onClick={() => setIsMenuOpen(false)}
//         />
//       )}
//     </div>
//   );
// };

// export default MobileListView;

'use client'

import React, { useState, useEffect, useRef } from 'react';
import SearchBar from '@/components/SearchBar';
import SortFilterBar from '@/components/SortFilterBar';
import DeviceList from '@/components/DeviceList';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import LocationView from '@/components/LocationView';
import MapLocationFinder from '@/components/MapLocationFinder';
import SettingsView from '@/components/SettingsView';
import { BleDevice } from './page';

interface Contact {
  name: string;
  phoneNumber: string;
}

interface LocationData {
  latitude: number;
  longitude: number;
  timestamp?: number;
  [key: string]: any;
}

type PageType = 'assets' | 'dashboard' | 'customer' | 'team' | 'company' | 'maplocation' | 'settings' | 'location' | 'debug';

interface MobileListViewProps {
  items: BleDevice[];
  onStartConnection: (macAddress: string) => void;
  connectedDevice: string | null;
  onScanQrCode: () => void;
  onRescanBleItems: () => void;
  isScanning: boolean;
  onLogout?: () => void;
  activePage: PageType;
  activeSubPage: string;
  onSubMenuItemClick: (menuId: PageType, itemId: string) => void;
}

const MobileListView: React.FC<MobileListViewProps> = ({
  items,
  onStartConnection,
  connectedDevice,
  onScanQrCode,
  onRescanBleItems,
  isScanning,
  onLogout = () => {},
  activePage,
  activeSubPage,
  onSubMenuItemClick,
}) => {

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const sidebarWidth = '80%';

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.macAddress.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleContentClick = () => {
    if (isMenuOpen) setIsMenuOpen(false);
  };

  const handleMenuOpen = () => setIsMenuOpen(true);

  const renderPageContent = () => {
    if (activePage === 'assets' && (activeSubPage === 'bledevices' || activeSubPage === 'cmd')) {
      return (
        <>
          <SearchBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onScanQrCode={onScanQrCode}
            isMenuOpen={isMenuOpen}
          />
          <SortFilterBar isMenuOpen={isMenuOpen} />
          <DeviceList
            items={items}
            filteredItems={filteredItems}
            connectedDevice={connectedDevice}
            onDeviceClick={onStartConnection}
            isScanning={isScanning}
            searchQuery={searchQuery}
          />
        </>
      );
    } 
    else if (activePage === 'maplocation') {
      return <MapLocationFinder />;
    } 
     else {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center p-6 bg-[#2A2F33] rounded-lg">
            <h3 className="text-xl font-medium text-white mb-2">
              {activePage.charAt(0).toUpperCase() + activePage.slice(1)}
            </h3>
            <p className="text-gray-400">Content coming soon</p>
          </div>
        </div>
      );
    }
  };

  const getPageTitle = () => {
    if (activePage === 'assets' && activeSubPage === 'bledevices') return 'All Devices';
    if (activePage === 'settings') return 'Settings';
    if (activePage === 'location') return 'Location Tracking';
    return activePage.charAt(0).toUpperCase() + activePage.slice(1);
  };

  return (
    <div className="relative max-w-md mx-auto bg-gradient-to-b from-[#24272C] to-[#0C0C0E] min-h-screen overflow-hidden">
      <div
        className="w-full transition-all duration-300"
        style={{
          transform: isMenuOpen ? `translateX(${sidebarWidth})` : 'translateX(0)',
          opacity: isMenuOpen ? 0.3 : 1,
        }}
        onClick={handleContentClick}
      >
        <div className="p-4">
          <Header
            title={getPageTitle()}
            showRefresh={activePage === 'assets' && activeSubPage === 'bledevices'}
            isScanning={isScanning}
            itemsLength={items.length}
            onMenuOpen={handleMenuOpen}
            onRefresh={onRescanBleItems}
          />
          {renderPageContent()}
        </div>
      </div>
      <Sidebar
        isMenuOpen={isMenuOpen}
        sidebarWidth={sidebarWidth}
        onClose={() => setIsMenuOpen(false)}
        activePage={activePage}
        activeSubPage={activeSubPage}
        onSubMenuItemClick={onSubMenuItemClick}
        onLogout={onLogout}
      />
      {isMenuOpen && (
        <div
          className="fixed inset-0 bg-black transition-opacity duration-300"
          style={{ opacity: 0.3, zIndex: 4 }}
          onClick={() => setIsMenuOpen(false)}
        />
      )}
    </div>
  );
};

export default MobileListView;