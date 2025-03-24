import React, { useState } from 'react';
import {
  Home,
  Battery,
  BarChart4,
  Settings2,
  ChevronDown,
  ChevronUp,
  Users,
  Building2,
  UserCircle,
  BugPlay,
  LogOut
} from 'lucide-react';

// Define page types for navigation
type PageType = 'assets' | 'dashboard' | 'customer' | 'team' | 'company' | 'myaccount' | 'settings' | 'debug';
type SubPageType = string;

interface SidebarProps {
  isMenuOpen: boolean;
  sidebarWidth: string;
  onClose: () => void;
  activePage: PageType;
  activeSubPage: SubPageType;
  onSubMenuItemClick: (menuId: PageType, itemId: SubPageType) => void;
  onLogout?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  isMenuOpen,
  sidebarWidth,
  onClose,
  activePage,
  activeSubPage,
  onSubMenuItemClick,
  onLogout = () => console.log('Logout clicked')
}) => {
  // Set expandable menus state
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    // Set devices menu expanded by default
    'devices': true
  });

  // Menu items data structure
  const menuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <Home size={18} />,
      subItems: [
        { id: 'overview', label: 'My Dash 1' },
        { id: 'overview1', label: 'My Dash 2' }
      ]
    },
    {
      id: 'assets',
      label: 'Assets',
      icon: <Battery size={18} />,
      subItems: [
        { id: 'bledevices', label: 'BLE Devices' },
        { id: 'fleetview', label: 'Fleet View' },
        { id: 'devicelocator', label: 'Device Locator' },
      ]
    },
    {
      id: 'customers',
      label: 'Customers',
      icon: <BarChart4 size={18} />,
      subItems: [
        { id: 'myportfolio', label: 'My Portfolio' },
        { id: 'payments', label: 'Payments' }
      ]
    },
    {
      id: 'team',
      label: 'Team',
      icon: <Users size={18} />,
      subItems: [
        { id: 'members', label: 'Members' },
        { id: 'Chat', label: 'Chat' }
      ]
    },
    {
      id: 'company',
      label: 'Company',
      icon: <Building2 size={18} />,
      subItems: [
        { id: 'request', label: 'Request' },
        { id: 'updates', label: 'Updates' }
      ]
    },
    {
      id: 'divider1',
      type: 'divider'
    },
    {
      id: 'myaccount',
      label: 'My Account',
      icon: <UserCircle size={18} />,
      subItems: [
        { id: 'resetpassword', label: 'Reset Password' }
      ]
    },
    {
      id: 'settings',
      label: 'My Settings',
      icon: <Settings2 size={18} />,
      subItems: [
        { id: 'settings', label: 'My Settings' }
      ]
    },
    {
      id: 'divider2',
      type: 'divider'
    },
    {
      id: 'debug',
      label: 'Debug',
      icon: <BugPlay size={18} />,
      subItems: [
        { id: 'console', label: 'Console' },
        { id: 'reportissue', label: 'Report Issue' },
      ]
    },
    {
      id: 'divider3',
      type: 'divider'
    },
    {
      id: 'logout',
      label: 'Logout',
      icon: <LogOut size={18} />,
      type: 'button', // Mark this as a button, not a menu item
      onClick: () => onLogout()
    }
  ];

  const toggleSubmenu = (menuId: string) => {
    setExpandedMenus((prev) => ({
      ...prev,
      [menuId]: !prev[menuId]
    }));
  };

  return (
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
              onClick={onClose}
              className="text-sm text-gray-400 hover:text-white"
            >
              Close
            </button>
          </div>
        </div>

        {/* Menu Items with overflow scrolling */}
        <div className="flex-1 overflow-y-auto">
          {menuItems.map((menuItem) => {
            // Handle dividers
            if (menuItem.type === 'divider') {
              return (
                <div key={menuItem.id} className="px-6 py-2">
                  <div className="border-t border-gray-700"></div>
                </div>
              );
            }
            
            // Handle logout button
            if (menuItem.type === 'button') {
              return (
                <div key={menuItem.id} className="px-6 py-2">
                  <button
                    className="flex items-center w-full px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
                    onClick={() => (menuItem as any).onClick?.()}
                  >
                    <span className="mr-3 text-white">
                      {menuItem.icon}
                    </span>
                    {menuItem.label}
                  </button>
                </div>
              );
            }
            
            // Regular menu items
            return (
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
                {expandedMenus[menuItem.id] && menuItem.subItems && (
                  <div className="bg-[#161a1d] overflow-hidden transition-all">
                    {menuItem.subItems.map((subItem) => {
                      const isActive = activePage === menuItem.id && activeSubPage === subItem.id;
                      return (
                        <div
                          key={subItem.id}
                          className={`pl-12 pr-6 py-2 cursor-pointer ${
                            isActive ? 'bg-[#2d4c6d] text-white' : 'hover:bg-[#252a2e] text-gray-400'
                          }`}
                          onClick={() => onSubMenuItemClick(menuItem.id as PageType, subItem.id)}
                        >
                          {subItem.label}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Menu Footer */}
        <div className="px-6 pt-4 border-t border-gray-800 mt-auto">
          <p className="text-xs text-gray-500">Version 1.2.5</p>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;