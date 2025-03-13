import React from 'react';

interface DeviceTabsProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const tabs = [
  { id: 'ATT', label: 'ATT' },
  { id: 'CMD', label: 'CMD' },
  { id: 'SVC', label: 'SVC' },
  { id: 'DTA', label: 'DTA' },
  { id: 'DIA', label: 'DIA' },
];

const DeviceTabs: React.FC<DeviceTabsProps> = ({ activeTab, setActiveTab }) => {
  return (
    <div className="border-b border-gray-800">
      <div className="flex justify-between px-4">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`py-3 px-4 text-sm font-medium relative ${
              activeTab === tab.id ? 'text-blue-500' : 'text-gray-400'
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {activeTab === tab.id && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500"></div>}
          </button>
        ))}
      </div>
    </div>
  );
};

export default DeviceTabs;
