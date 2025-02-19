'use client'

import React, { useState } from 'react';
import { Search, Settings, User, BluetoothSearching, ListFilter, ArrowUpDown, ChevronDown, ChevronUp, Home, Battery, BarChart4, Settings2, HelpCircle } from 'lucide-react';

const MobileListView = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<any>({});
  const [activeSubMenuItem, setActiveSubMenuItem] = useState<any>(null);
  
  const items = [
    {
      title: "HESS-Bat242004",
      subtitle: "82:05:10:00:A9:48",
      info: "-90db ~ 10m",
      imageUrl: "https://res.cloudinary.com/oves/image/upload/t_product1000x1000/v1731144599/OVES-PRODUCTS/CROSS-GRID/HOME%20BATTERY%20SYSTEMS/Bat24100P/Bat24100TP_Left_Side_fvmldv.png"
    },
    {
      title: "HESS-Bat242005",
      subtitle: "82:05:10:00:A9:48",
      info: "-95db ~ 12m",
      imageUrl: "https://res.cloudinary.com/oves/image/upload/t_product1000x1000/v1731144599/OVES-PRODUCTS/CROSS-GRID/HOME%20BATTERY%20SYSTEMS/Bat24100P/Bat24100TP_Left_Side_fvmldv.png"
    }
  ];

  // Sidebar menu data structure
  const menuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <Home size={18} />,
      subItems: [
        { id: 'overview', label: 'Overview' },
        { id: 'analytics', label: 'Analytics' },
        { id: 'reports', label: 'Reports' }
      ]
    },
    {
      id: 'batteries',
      label: 'Batteries',
      icon: <Battery size={18} />,
      subItems: [
        { id: 'devices', label: 'All Devices' },
        { id: 'search', label: 'Search Device' },
        { id: 'favorites', label: 'Favorites' }
      ]
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: <BarChart4 size={18} />,
      subItems: [
        { id: 'performance', label: 'Performance' },
        { id: 'usage', label: 'Usage Stats' },
        { id: 'history', label: 'History' }
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
        { id: 'about', label: 'About' }
      ]
    }
  ];
  
  // Calculate sidebar width (80%)
  const sidebarWidth = "80%";
  
  const handleContentClick = () => {
    if (isMenuOpen) {
      setIsMenuOpen(false);
    }
  };

  const toggleSubmenu = (menuId: any) => {
    setExpandedMenus((prev:any) => ({
      ...prev,
      [menuId]: !prev[menuId]
    }));
  };

  const handleSubMenuItemClick = (menuId:any, itemId:any) => {
    setActiveSubMenuItem(`${menuId}-${itemId}`);
    // You could add navigation logic here in a real app
  };
  
  return (
    <div className="relative max-w-md mx-auto bg-gradient-to-b from-[#24272C] to-[#0C0C0E] min-h-screen overflow-hidden">
      {/* Fixed width wrapper to maintain content size */}
      <div 
        className={`w-full transition-all duration-300 ${isMenuOpen ? `translate-x-[${sidebarWidth}]` : 'translate-x-0'}`}
        style={{ 
          transform: isMenuOpen ? `translateX(${sidebarWidth})` : 'translateX(0)',
          opacity: isMenuOpen ? 0.1 : 1,
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
                e.stopPropagation(); // Prevent content click handler from firing
                setIsMenuOpen(true);
              }} 
            />
            <Settings className="w-6 h-6 text-gray-400" />
          </div>
          
          {/* Search Bar */}
          <div className="relative mb-4">
            <input
              type="text"
              className="w-full px-4 py-2 border border-gray-700 bg-gray-800 rounded-lg pr-10 focus:outline-none text-white"
              placeholder="Search..."
              onClick={(e) => isMenuOpen && e.stopPropagation()} 
            />
            <Search className="absolute right-3 top-2.5 w-5 h-5 text-gray-400" />
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
          
          {/* List Items */}
          <div className="space-y-3">
            {items.map((item, index) => (
              <div
                key={index}
                className="flex items-start p-3 rounded-lg bg-[#2A2F33]"
                onClick={(e) => isMenuOpen && e.stopPropagation()}
              >
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="w-12 h-12 rounded-full mr-3"
                />
                <div className="flex-1">
                  <h3 className="text-[14px] font-medium text-white">{item.title}</h3>
                  <p className="text-[10px] text-gray-400">{item.subtitle}</p>
                  <p className="text-[10px] text-gray-500 mt-1">{item.info}</p>
                </div>
                <span className="text-gray-400 text-lg">
                  <BluetoothSearching />
                </span>
              </div>
            ))}
          </div>
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
                  className="flex items-center justify-between px-6 py-3 cursor-pointer hover:bg-[#2a2d31]"
                  onClick={() => toggleSubmenu(menuItem.id)}
                >
                  <div className="flex items-center">
                    <span className="mr-3 text-gray-400">{menuItem.icon}</span>
                    <span className="text-gray-200">{menuItem.label}</span>
                  </div>
                  <span className="text-gray-400">
                    {expandedMenus[menuItem.id] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </span>
                </div>
                
                {/* Submenu Items */}
                {expandedMenus[menuItem.id] && (
                  <div className="bg-[#161a1d] overflow-hidden transition-all">
                    {menuItem.subItems.map((subItem) => {
                      const isActive = activeSubMenuItem === `${menuItem.id}-${subItem.id}`;
                      return (
                        <div 
                          key={subItem.id}
                          className={`pl-12 pr-6 py-2 cursor-pointer ${isActive ? 'bg-[#2d4c6d] text-white' : 'hover:bg-[#252a2e] text-gray-400'}`}
                          onClick={() => handleSubMenuItemClick(menuItem.id, subItem.id)}
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
