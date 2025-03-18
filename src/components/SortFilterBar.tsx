'use client'

import React from 'react';
import { ArrowUpDown, ListFilter } from 'lucide-react';

interface SortFilterBarProps {
  isMenuOpen: boolean;
  onSort?: () => void;
  onFilter?: () => void;
}

const SortFilterBar: React.FC<SortFilterBarProps> = ({ 
  isMenuOpen, 
  onSort = () => {}, 
  onFilter = () => {} 
}) => {
  return (
    <div className="flex gap-2 mb-4">
      <button
        className="flex-1 px-4 py-2 border border-[#52545c] rounded-lg text-white text-sm flex items-center justify-between bg-gray-800"
        onClick={(e) => {
          isMenuOpen && e.stopPropagation();
          onSort();
        }}
      >
        Sort by...
        <span className="text-xs">
          <ArrowUpDown />
        </span>
      </button>
      <button
        className="flex-1 px-4 py-2 border border-[#52545c] rounded-lg text-white text-sm flex items-center justify-between bg-gray-800"
        onClick={(e) => {
          isMenuOpen && e.stopPropagation();
          onFilter();
        }}
      >
        Filter
        <span className="text-lg">
          <ListFilter />
        </span>
      </button>
    </div>
  );
};

export default SortFilterBar;