"use client"

import React from 'react';
import { ArrowRight, Filter, Search } from 'lucide-react';

interface Swap {
  id: string;
  date: string;
  riderName: string;
  depletedBattery: { percentage: number; range: string };
  newBattery: { percentage: number; range: string };
  pricing: { batteryCharges: number; convenienceFee: number; total: number };
  status: string;
}

interface SwapHistoryProps {
  onSelectSwap: (swap: Swap) => void;
}

const swapData: Swap[] = [
  {
    id: '999287433899',
    date: '4/16/2024 - 09:31 AM',
    riderName: 'KMGF 679U',
    depletedBattery: { percentage: 44, range: '' },
    newBattery: { percentage: 100, range: '' },
    pricing: { batteryCharges: 106.8, convenienceFee: 50, total: 156.8 },
    status: 'Completed'
  },
  {
    id: '88A176522788',
    date: '4/15/2024 - 02:22 PM',
    riderName: 'KMGF 679U',
    depletedBattery: { percentage: 25, range: '' },
    newBattery: { percentage: 100, range: '' },
    pricing: { batteryCharges: 92.5, convenienceFee: 50, total: 142.5 },
    status: 'Completed'
  },
  {
    id: '77C065411677',
    date: '4/14/2024 - 11:45 AM',
    riderName: 'KMGF 679U',
    depletedBattery: { percentage: 15, range: '' },
    newBattery: { percentage: 100, range: '' },
    pricing: { batteryCharges: 118, convenienceFee: 50, total: 168 },
    status: 'Completed'
  },
  {
    id: '66D054322566',
    date: '4/13/2024 - 08:15 AM',
    riderName: 'KMGF 679U',
    depletedBattery: { percentage: 30, range: '' },
    newBattery: { percentage: 100, range: '' },
    pricing: { batteryCharges: 100, convenienceFee: 50, total: 150 },
    status: 'Completed'
  }
];

export default function SwapHistory({ onSelectSwap }: SwapHistoryProps) {
  return (
<div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700 p-4 flex items-center justify-center">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 flex justify-between items-center">
          <h1 className="text-xl font-semibold text-gray-800">Swap History</h1>
          <div className="w-6 h-6 flex items-center justify-center">
            <div className="space-y-1">
              <span className="block w-1 h-1 bg-gray-600 rounded-full"></span>
              <span className="block w-1 h-1 bg-gray-600 rounded-full"></span>
              <span className="block w-1 h-1 bg-gray-600 rounded-full"></span>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-6 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search swaps..."
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
            />
            <Filter className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          </div>
        </div>

        {/* Summary Stats */}
        <div className="px-6 py-4 flex justify-between">
          <div className="bg-purple-50 rounded-lg p-4 w-1/2 mr-2">
            <h2 className="text-2xl font-bold text-purple-900">24</h2>
            <p className="text-sm text-gray-600">Total Swaps</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4 w-1/2 ml-2">
            <h2 className="text-2xl font-bold text-green-900">KES 3,420</h2>
            <p className="text-sm text-gray-600">This Month</p>
          </div>
        </div>

        {/* Recent Swaps */}
        <div className="px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Recent Swaps</h2>
          <div className="space-y-4">
            {swapData.map((swap) => (
              <div
                key={swap.id}
                className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                onClick={() => onSelectSwap(swap)}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium text-gray-800">{swap.riderName}</div>
                    <div className="text-xs text-gray-500">ID: {swap.id}</div>
                    <div className="text-sm text-gray-600 mt-1">{swap.date}</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-800">KES {swap.pricing.total.toFixed(1)}</span>
                    <ArrowRight className="w-5 h-5 text-gray-600" />
                  </div>
                </div>
                <div className="flex items-center mt-2 space-x-2">
                  <div className="w-12 h-4 bg-red-200 rounded-sm relative overflow-hidden">
                    <div
                      className="h-full bg-red-500 transition-all duration-300"
                      style={{ width: `${swap.depletedBattery.percentage}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-600">{swap.depletedBattery.percentage}%</span>
                  <span className="text-sm text-gray-600">→</span>
                  <div className="w-12 h-4 bg-green-200 rounded-sm relative overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all duration-300"
                      style={{ width: `${swap.newBattery.percentage}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-600">{swap.newBattery.percentage}%</span>
                </div>
                <div className="mt-2">
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full ${
                      swap.status === 'Completed'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {swap.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}