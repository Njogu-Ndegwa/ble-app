'use client'

import React, { useState } from 'react';
import {
  User,
  BluetoothSearching,
  ListFilter,
  ArrowUpDown,
  RefreshCcw,
  BluetoothConnected
} from 'lucide-react';
import { BleDevice } from './page';
import Sidebar from '@/components/Sidebar';
import SearchBar from '@/components/SearchBar';

interface MobileListViewProps {
  items: BleDevice[];
  onStartConnection: (macAddress: string) => void;
  connectedDevice: string | null;
  onScanQrCode: () => void;
  onRescanBleItems: () => void;
  isScanning: boolean;
  onLogout?: () => void;
}

// Define page types for navigation
type PageType = 'assets' | 'dashboard' | 'customer' | 'team' | 'company' | 'myaccount' | 'settings' | 'debug';
type SubPageType = string;

// Skeleton loader component for device items
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
  onLogout = () => console.log('Logout clicked')
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Set active page to 'devices' and subpage to 'all' by default
  const [activePage, setActivePage] = useState<PageType>('assets');
  const [activeSubPage, setActiveSubPage] = useState<SubPageType>('bledevices');
  
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Calculate sidebar width (80%)
  const sidebarWidth = "80%";

  // Filter items based on search query
  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.macAddress.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleContentClick = () => {
    if (isMenuOpen) {
      setIsMenuOpen(false);
    }
  };

  const handleSubMenuItemClick = (menuId: PageType, itemId: SubPageType) => {
    setActivePage(menuId);
    setActiveSubPage(itemId);
    setIsMenuOpen(false); // Close menu after selection
  };

  // Handle rescan with loading state
  const handleRescan = () => {
    onRescanBleItems();
  };

  const handleDeviceClick = async (macAddress: string) => {
    if (isMenuOpen) return;
    onStartConnection(macAddress);
  };

  // Generate skeleton loaders
  const renderSkeletons = () => {
    return Array(5).fill(0).map((_, index) => (
      <DeviceItemSkeleton key={`skeleton-${index}`} />
    ));
  };

  // Render content based on active page
  const renderPageContent = () => {
    // Only show devices list when on the devices/all page
    if (activePage === 'assets' && activeSubPage === 'bledevices') {
      return (
        <>
          {/* Search Bar Component */}
          <SearchBar 
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onScanQrCode={onScanQrCode}
            isMenuOpen={isMenuOpen}
          />

          {/* Sort and Filter */}
          <div className="flex gap-2 mb-4">
            <button
              className="flex-1 px-4 py-2 border border-[#52545c] rounded-lg text-white text-sm flex items-center justify-between bg-gray-800"
              onClick={(e) => isMenuOpen && e.stopPropagation()}
            >
              Sort by...
              <span className="text-xs">
                <ArrowUpDown />
              </span>
            </button>
            <button
              className="flex-1 px-4 py-2 border border-[#52545c] rounded-lg text-white text-sm flex items-center justify-between bg-gray-800"
              onClick={(e) => isMenuOpen && e.stopPropagation()}
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
              filteredItems.map((item) => (
                <div
                  key={item.macAddress}
                  className="flex items-start p-3 rounded-lg bg-[#2A2F33] cursor-pointer hover:bg-[#343a40] transition-colors"
                  onClick={() => handleDeviceClick(item.macAddress)}
                >
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-12 h-12 rounded-full mr-3"
                  />
                  <div className="flex-1">
                    <h3 className="text-[14px] font-medium text-white">{item.name}</h3>
                    <p className="text-[10px] text-gray-400">{item.macAddress}</p>
                    <p className="text-[10px] text-gray-500 mt-1">{item.rssi}</p>
                  </div>
                  <span className="text-lg">
                    {item.macAddress === connectedDevice ? (
                      <BluetoothConnected className="text-blue-500" />
                    ) : (
                      <BluetoothSearching className="text-gray-400" />
                    )}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-gray-400">
                {searchQuery ? "No devices match your search." : "No devices found. Try scanning again."}
              </div>
            )}
          </div>
        </>
      );
    } else {
      // Display a simple page for other menu items
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center p-6 bg-[#2A2F33] rounded-lg">
            <h3 className="text-xl font-medium text-white mb-2">
              {activePage.charAt(0).toUpperCase() + activePage.slice(1)} - {activeSubPage.charAt(0).toUpperCase() + activeSubPage.slice(1)}
            </h3>
            <p className="text-gray-400">Hello World</p>
          </div>
        </div>
      );
    }
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
        {/* Content Area */}
        <div className="p-4">
          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <User
              className="w-6 h-6 text-gray-400 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen(true);
              }}
            />
            <div className="text-center flex-1">
              <h2 className="text-white font-medium">
                {activePage === 'assets' && activeSubPage === 'bledevices' 
                  ? 'All Devices' 
                  : `${activePage.charAt(0).toUpperCase() + activePage.slice(1)} - ${activeSubPage.charAt(0).toUpperCase() + activeSubPage.slice(1)}`}
              </h2>
            </div>
            {activePage === 'assets' && activeSubPage === 'bledevices' && (
              <div className="relative">
                <RefreshCcw
                  onClick={handleRescan}
                  className={`w-6 h-6 text-gray-400 ${items.length === 0 && isScanning ? 'animate-spin' : ''}`}
                />
              </div>
            )}
            {activePage !== 'assets' || activeSubPage !== 'bledevices' && (
              <div className="w-6 h-6"></div> // Spacer for alignment
            )}
          </div>

          {/* Page Content */}
          {renderPageContent()}
        </div>
      </div>

      {/* Sidebar Menu - Now extracted as a component */}
      <Sidebar
        isMenuOpen={isMenuOpen}
        sidebarWidth={sidebarWidth}
        onClose={() => setIsMenuOpen(false)}
        activePage={activePage}
        activeSubPage={activeSubPage}
        onSubMenuItemClick={handleSubMenuItemClick}
        onLogout={onLogout}
      />

      {/* Semi-transparent overlay to darken background */}
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
