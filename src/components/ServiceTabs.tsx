'use client'

import React from 'react';

interface Tab {
  id: string;
  label: string;
  serviceNameEnum: string;
}

interface ServiceTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  attributeList: any[];
}

const ServiceTabs: React.FC<ServiceTabsProps> = ({ tabs, activeTab, onTabChange, attributeList }) => {
  return (
    <div className="border-b border-gray-800">
      <div className="flex justify-between px-4">
        {tabs.map(tab => {
          const serviceExists = attributeList.some(s => s.serviceNameEnum === tab.serviceNameEnum);
          return (
            <button
              key={tab.id}
              className={`py-3 px-4 text-sm font-medium relative ${activeTab === tab.id ? 'text-blue-500' : 'text-gray-400'
                } ${!serviceExists ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => serviceExists && onTabChange(tab.id)}
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
  );
};

export default ServiceTabs;