'use client'

import React from 'react';
import { Search, Camera } from 'lucide-react';

interface SearchBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onScanQrCode: () => void;
  isMenuOpen: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({
  searchQuery,
  setSearchQuery,
  onScanQrCode,
  isMenuOpen
}) => {
  return (
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
  );
};

export default SearchBar;