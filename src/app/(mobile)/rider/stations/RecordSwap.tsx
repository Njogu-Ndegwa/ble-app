"use client"

import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle } from 'lucide-react';

interface Swap {
  id: string;
  date: string;
  riderName: string;
  depletedBattery: { percentage: number; range: string };
  newBattery: { percentage: number; range: string };
  pricing: { batteryCharges: number; convenienceFee: number; total: number; currencySymbol: string };
}

interface RecordSwapProps {
  selectedSwap: Swap | null;
  onBack: () => void;
}

export default function RecordSwap({ selectedSwap, onBack }: RecordSwapProps) {
  const [currentStep, setCurrentStep] = useState(2);
  
  const steps = [
    { id: 1, label: 'Start' },
    { id: 2, label: 'Review' },
    { id: 3, label: 'Complete' }
  ];

  if (!selectedSwap) return null;

  return (
<div className="min-h-screen p-4 flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
          <div className="w-full max-w-md">
        {/* Main Card */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden mb-8">
          {/* Header */}
          <div className="bg-bg-secondary px-6 py-4 flex items-center justify-between">
            <button onClick={onBack}>
              <ArrowLeft className="w-6 h-6 text-text-muted" />
            </button>
            <h1 className="text-lg font-semibold text-text-primary">Record Swap</h1>
            <div className="w-6 h-6"></div>
          </div>

          {/* Progress Steps */}
          <div className="px-6 py-4">
            <div className="flex items-center justify-between mb-6">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                    step.id <= currentStep 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-bg-elevated text-text-muted'
                  }`}>
                    {step.id}
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`w-16 h-0.5 mx-2 ${
                      step.id < currentStep ? 'bg-blue-600' : 'bg-bg-elevated'
                    }`}></div>
                  )}
                </div>
              ))}
            </div>

            {/* Swap Review Section */}
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-text-primary">Swap Review</h2>
              
              {/* Swap Details */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-muted">Swap ID:</span>
                  <span className="font-medium">{selectedSwap.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Date:</span>
                  <span className="font-medium">{selectedSwap.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Rider Name:</span>
                  <span className="font-medium">{selectedSwap.riderName}</span>
                </div>
              </div>

              {/* Battery Status */}
              <div className="space-y-4">
                {/* Depleted Battery */}
                <div>
                  <h3 className="font-semibold text-text-primary mb-2">Returned Battery status</h3>
                  <div className="flex items-center space-x-3 p-3 bg-red-50 rounded-lg">
                    <div className="w-12 h-6 bg-red-500 rounded-sm relative overflow-hidden">
                      <div 
                        className="h-full bg-red-600 transition-all duration-300"
                        style={{ width: `${selectedSwap.depletedBattery.percentage}%` }}
                      ></div>
                    </div>
                    <div>
                      <div className="text-red-600 font-semibold">
                        {selectedSwap.depletedBattery.percentage}% Remaining Battery
                      </div>
                      <div className="text-sm text-text-muted">
                        {selectedSwap.depletedBattery.range}
                      </div>
                    </div>
                  </div>
                </div>

                {/* New Battery */}
                <div>
                  <h3 className="font-semibold text-text-primary mb-2">New Battery status</h3>
                  <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                    <div className="w-12 h-6 bg-green-500 rounded-sm relative overflow-hidden">
                      <div 
                        className="h-full bg-green-600 transition-all duration-300"
                        style={{ width: `${selectedSwap.newBattery.percentage}%` }}
                      ></div>
                    </div>
                    <div>
                      <div className="text-green-600 font-semibold">
                        {selectedSwap.newBattery.percentage}% Remaining Battery
                      </div>
                      <div className="text-sm text-text-muted">
                        {selectedSwap.newBattery.range}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pricing Details */}
              <div>
                <h3 className="font-semibold text-text-primary mb-3">Pricing Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Battery Charges</span>
                    <span className="font-medium">{selectedSwap.pricing.currencySymbol} {selectedSwap.pricing.batteryCharges}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Convenience Fee</span>
                    <span className="font-medium">{selectedSwap.pricing.currencySymbol} {selectedSwap.pricing.convenienceFee}</span>
                  </div>
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between font-semibold">
                      <span>Total Payable</span>
                      <span>{selectedSwap.pricing.currencySymbol} {selectedSwap.pricing.total}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold text-lg hover:bg-purple-800 transition-colors">
                Swap Complete
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}