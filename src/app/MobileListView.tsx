'use client'

import React, { useEffect, useState } from 'react';
import {
  Search,
  User,
  BluetoothSearching,
  ListFilter,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Home,
  Battery,
  BarChart4,
  Settings2,
  HelpCircle,
  BluetoothConnected,
  Camera,
  RefreshCcw
} from 'lucide-react';
import { BleDevice } from './page';

interface MobileListViewProps {
  items: BleDevice[];
  onStartConnection: (macAddress: string) => void;
  connectedDevice: string | null;
  onScanQrCode: () => void;
  onRescanBleItems: () => void;
  isScanning: boolean;
}

// Define page types for navigation
type PageType = 'devices' | 'dashboard' | 'analytics' | 'settings' | 'help';
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
  isScanning }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    // Set devices menu expanded by default
    'devices': true
  });
  
  // Set active page to 'devices' and subpage to 'all' by default
  const [activePage, setActivePage] = useState<PageType>('devices');
  const [activeSubPage, setActiveSubPage] = useState<SubPageType>('all');
  
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Sidebar menu data structure
  const menuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <Home size={18} />,
      subItems: [
        { id: 'overview', label: 'Overview' }
      ]
    },
    {
      id: 'devices',
      label: 'Devices',
      icon: <Battery size={18} />,
      subItems: [
        { id: 'all', label: 'All Devices' }
      ]
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: <BarChart4 size={18} />,
      subItems: [
        { id: 'performance', label: 'Performance' },
        { id: 'efficiency', label: 'Efficiency' },
        { id: 'usage', label: 'Usage Patterns' }
      ]
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings2 size={18} />,
      subItems: [
        { id: 'account', label: 'Account' },
        { id: 'preferences', label: 'Preferences' },
        { id: 'notifications', label: 'Notifications' }
      ]
    },
    {
      id: 'help',
      label: 'Help & Support',
      icon: <HelpCircle size={18} />,
      subItems: [
        { id: 'faq', label: 'FAQ' },
        { id: 'contact', label: 'Contact Support' },
        { id: 'docs', label: 'Documentation' }
      ]
    }
  ];

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

  const toggleSubmenu = (menuId: string) => {
    setExpandedMenus((prev) => ({
      ...prev,
      [menuId]: !prev[menuId]
    }));
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
    if (activePage === 'devices' && activeSubPage === 'all') {
      return (
        <>
          {/* Search Bar */}
          <div className="relative mb-4">
            <input
              type="text"
              className="w-full px-4 py-2 border border-gray-700 bg-gray-800 rounded-lg pr-20 focus:outline-none text-white"
              placeholder="Search devices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClick={(e) => isMenuOpen && e.stopPropagation()}
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
              <Search className="w-5 h-5 text-gray-400" />
            </div>
          </div>

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
                {activePage === 'devices' && activeSubPage === 'all' 
                  ? 'All Devices' 
                  : `${activePage.charAt(0).toUpperCase() + activePage.slice(1)} - ${activeSubPage.charAt(0).toUpperCase() + activeSubPage.slice(1)}`}
              </h2>
            </div>
            {activePage === 'devices' && activeSubPage === 'all' && (
              <div className="relative">
                <RefreshCcw
                  onClick={handleRescan}
                  className={`w-6 h-6 text-gray-400 ${items.length === 0 && isScanning ? 'animate-spin' : ''}`}
                />
              </div>
            )}
            {activePage !== 'devices' || activeSubPage !== 'all' && (
              <div className="w-6 h-6"></div> // Spacer for alignment
            )}
          </div>

          {/* Page Content */}
          {renderPageContent()}
        </div>
      </div>

      {/* Sidebar Menu with expandable menu items */}
      <div
        className="fixed top-0 left-0 bg-[#1c1f22] min-h-screen transition-transform duration-300 transform"
        style={{
          width: sidebarWidth,
          transform: isMenuOpen ? 'translateX(0)' : `translateX(-100%)`,
          zIndex: 5
        }}
      >
        <div className="py-6 flex flex-col h-full">
          {/* Menu Header */}
          <div className="px-6 mb-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Menu</h2>
              <button
                onClick={() => setIsMenuOpen(false)}
                className="text-sm text-gray-400 hover:text-white"
              >
                Close
              </button>
            </div>
          </div>

          {/* Menu Items */}
          <div className="flex-1 overflow-y-auto">
            {menuItems.map((menuItem) => (
              <div key={menuItem.id} className="mb-1">
                {/* Menu Item Header */}
                <div
                  className={`flex items-center justify-between px-6 py-3 cursor-pointer ${
                    activePage === menuItem.id ? 'bg-[#2a2d31]' : 'hover:bg-[#2a2d31]'
                  }`}
                  onClick={() => toggleSubmenu(menuItem.id)}
                >
                  <div className="flex items-center">
                    <span className={`mr-3 ${activePage === menuItem.id ? 'text-blue-500' : 'text-gray-400'}`}>
                      {menuItem.icon}
                    </span>
                    <span className={activePage === menuItem.id ? 'text-white' : 'text-gray-200'}>
                      {menuItem.label}
                    </span>
                  </div>
                  <span className="text-gray-400">
                    {expandedMenus[menuItem.id] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </span>
                </div>

                {/* Submenu Items */}
                {expandedMenus[menuItem.id] && (
                  <div className="bg-[#161a1d] overflow-hidden transition-all">
                    {menuItem.subItems.map((subItem) => {
                      const isActive = activePage === menuItem.id && activeSubPage === subItem.id;
                      return (
                        <div
                          key={subItem.id}
                          className={`pl-12 pr-6 py-2 cursor-pointer ${
                            isActive ? 'bg-[#2d4c6d] text-white' : 'hover:bg-[#252a2e] text-gray-400'
                          }`}
                          onClick={() => handleSubMenuItemClick(menuItem.id as PageType, subItem.id)}
                        >
                          {subItem.label}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Menu Footer */}
          <div className="px-6 pt-4 border-t border-gray-800 mt-auto">
            <p className="text-xs text-gray-500">Version 1.2.5</p>
          </div>
        </div>
      </div>

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