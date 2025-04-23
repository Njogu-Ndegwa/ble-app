'use client'

import React from 'react';
import { User, RefreshCcw } from 'lucide-react';

interface HeaderProps {
  title: string;
  showRefresh?: boolean;
  isScanning?: boolean;
  itemsLength?: number;
  onMenuOpen: () => void;
  onRefresh?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  title,
  showRefresh = false,
  isScanning = false,
  itemsLength = 0,
  onMenuOpen,
  onRefresh = () => {}
}) => {
  return (
    <div className="flex justify-between items-center mb-4">
      <User
        className="w-6 h-6 text-gray-400 cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          onMenuOpen();
        }}
      />
      <div className="text-center flex-1">
        <h2 className="text-white font-medium">{title}</h2>
      </div>
      {showRefresh ? (
        <div className="relative">
          <RefreshCcw
            onClick={onRefresh}
            className={`w-6 h-6 text-gray-400 ${itemsLength === 0 && isScanning ? 'animate-spin' : ''}`}
          />
        </div>
      ) : (
        <div className="w-6 h-6"></div> // Spacer for alignment
      )}
    </div>
  );
};

export default Header;