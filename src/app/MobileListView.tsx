'use client'

import React, { useState, useEffect } from 'react';
import { BleDevice } from '@/app/context/BridgeContext';
import SearchBar from '@/components/SearchBar';
import SortFilterBar from '@/components/SortFilterBar';
import DeviceList from '@/components/DeviceList';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from './context/AuthProvider';


interface MobileListViewProps {
  items: BleDevice[];
  onStartConnection: (macAddress: string) => void;
  connectedDevice: string | null;
  onScanQrCode: () => void;
  onRescanBleItems: () => void;
  isScanning: boolean;
  onLogout?: () => void;
}

type PageType = 'assets' | 'dashboard' | 'customer' | 'team' | 'company' | 'maplocation' | 'settings' | 'location' | 'debug';

const MobileListView: React.FC<MobileListViewProps> = ({
  items,
  onStartConnection,
  connectedDevice,
  onScanQrCode,
  onRescanBleItems,
  isScanning,
  onLogout = () => console.log('Logout clicked'),
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  
  // Set activePage based on current pathname
  const [activePage, setActivePage] = useState<PageType>('assets');
  const [activeSubPage, setActiveSubPage] = useState<string>('cmd');

  // Check authentication status and redirect accordingly
  useEffect(() => {
    if (isAuthenticated) {
      // If authenticated, redirect to BLE devices page if not already there
      if (pathname !== '/bledevices') {
        router.push('/bledevices');
      }
      setActiveSubPage('bledevices');
    } else {
      // If not authenticated, stay on cmd page
      setActiveSubPage('cmd');
    }
  }, [isAuthenticated, router, pathname]);

  // Set activeSubPage based on pathname
  useEffect(() => {
    if (pathname === '/bledevices') {
      setActiveSubPage('bledevices');
    } else if (pathname === '/') {
      setActiveSubPage('cmd');
    }
  }, [pathname]);

  const sidebarWidth = '80%';

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.macAddress.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleContentClick = () => {
    if (isMenuOpen) setIsMenuOpen(false);
  };

  const handleSubMenuItemClick = (menuId: PageType, itemId: string) => {
    // Check if user is authenticated before allowing navigation
    if (!isAuthenticated && itemId === 'bledevices') {
      // Redirect to login page for unauthenticated users
      router.push('/login');
      setIsMenuOpen(false);
      return;
    }
    
    // Continue with navigation
    setActivePage(menuId);
    setActiveSubPage(itemId);
    setIsMenuOpen(false);

    if (menuId === 'assets' && itemId === 'bledevices' && isAuthenticated) {
      router.push('/bledevices');
    } else if (menuId === 'assets' && itemId === 'cmd') {
      router.push('/');
    }
  };

  const handleMenuOpen = () => setIsMenuOpen(true);

  const renderPageContent = () => {
    if (activePage === 'assets' && (activeSubPage === 'cmd' || activeSubPage === 'bledevices')) {
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

    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center p-6 bg-[#2A2F33] rounded-lg">
          <h3 className="text-xl font-medium text-white mb-2">
            {activePage.charAt(0).toUpperCase() + activePage.slice(1)} -{' '}
            {activeSubPage.charAt(0).toUpperCase() + activeSubPage.slice(1)}
          </h3>
          <p className="text-gray-400">Hello World</p>
        </div>
      </div>
    );
  };

  const getPageTitle = () => {
    if (activePage === 'assets' && activeSubPage === 'bledevices') return 'All Devices';
    if (activePage === 'team' && activeSubPage === 'members') return 'Customer Access';
    if (activePage === 'settings') return 'Settings';

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
            showRefresh={(activePage === 'assets' && (activeSubPage === 'cmd' || activeSubPage === 'bledevices'))}
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
        onSubMenuItemClick={handleSubMenuItemClick}
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