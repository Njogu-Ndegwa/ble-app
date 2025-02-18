import React from 'react';
import { Search, Settings, User, BluetoothSearching, ListFilter, ArrowUpDown } from 'lucide-react';

const MobileListView = () => {
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

  return (
    <div className="max-w-md mx-auto bg-gradient-to-b from-[#24272C] to-[#0C0C0E] min-h-screen p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <User className="w-6 h-6 text-gray-600" />
        <Settings className="w-6 h-6 text-gray-600" />
      </div>

      {/* Search Bar */}
      <div className="relative mb-4">
        <input
          type="text"
          className="w-full px-4 py-2 border rounded-lg pr-10 focus:outline-none"
          placeholder="Search..."
        />
        <Search className="absolute right-3 top-2.5 w-5 h-5 text-gray-400" />
      </div>

      {/* Sort and Filter */}
      <div className="flex gap-2 mb-4">
        <button className="flex-1 px-4 py-2 border border-[#52545c] rounded-lg text-white text-sm flex items-center justify-between">
          Sort by...
          <span className="text-xs">
            <ArrowUpDown />
          </span>
        </button>
        <button className="flex-1 px-4 py-2 border border-[#52545c] rounded-lg text-white text-sm flex items-center justify-between">
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
          >
            <img
              src={item.imageUrl}
              alt={item.title}
              className="w-12 h-12 rounded-full mr-3"
            />
            <div className="flex-1">
              <h3 className="text-[14px] font-medium text-white">{item.title}</h3> {/* Title in white */}
              <p className="text-[10px] text-gray-400">{item.subtitle}</p> {/* Subtitle in light grey */}
              <p className="text-[10px] text-gray-500 mt-1">{item.info}</p>
            </div>
            <span className="text-gray-400 text-lg">
              <BluetoothSearching />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MobileListView;