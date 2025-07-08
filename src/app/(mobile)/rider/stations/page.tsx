"use client"
import React, { useState } from 'react';
import SwapHistory from './SwapHistory';
import RecordSwap from './RecordSwap';

interface Swap {
  id: string;
  date: string;
  riderName: string;
  depletedBattery: { percentage: number; range: string };
  newBattery: { percentage: number; range: string };
  pricing: { batteryCharges: number; convenienceFee: number; total: number };
}

export default function Home() {
  const [selectedSwap, setSelectedSwap] = useState<Swap | null>(null);

  return (
    <>
      {selectedSwap ? (
        <RecordSwap selectedSwap={selectedSwap} onBack={() => setSelectedSwap(null)} />
      ) : (
        <SwapHistory onSelectSwap={(swap: Swap) => setSelectedSwap(swap)} />
      )}
    </>
  );
}