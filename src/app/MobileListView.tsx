'use client'

import React, { useState } from 'react';
import { BleDevice } from './page';
import Sidebar from '@/components/Sidebar';
import SearchBar from '@/components/SearchBar';
import DeviceList from '@/components/DeviceList';
import SortFilterBar from '@/components/SortFilterBar';
import Header from '@/components/Header';

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

  const handleMenuOpen = () => {
    setIsMenuOpen(true);
  };

  // Render content based on active page
  const renderPageContent = () => {
    // Only show devices list when on the devices/all page
    if (activePage === 'assets' && activeSubPage === 'bledevices') {
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

  // Determine the title based on active page and subpage
  const getPageTitle = () => {
    if (activePage === 'assets' && activeSubPage === 'bledevices') {
      return 'All Devices';
    }
    return `${activePage.charAt(0).toUpperCase() + activePage.slice(1)} - ${activeSubPage.charAt(0).toUpperCase() + activeSubPage.slice(1)}`;
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
          <Header 
            title={getPageTitle()}
            showRefresh={activePage === 'assets' && activeSubPage === 'bledevices'}
            isScanning={isScanning}
            itemsLength={items.length}
            onMenuOpen={handleMenuOpen}
            onRefresh={onRescanBleItems}
          />

          {/* Page Content */}
          {renderPageContent()}
        </div>
      </div>

      {/* Sidebar Menu */}
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