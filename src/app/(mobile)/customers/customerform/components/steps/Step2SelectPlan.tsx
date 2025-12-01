'use client';

import React from 'react';
import { PlanData, AVAILABLE_PLANS } from '../types';

interface Step2Props {
  selectedPlan: string;
  onPlanSelect: (planId: string) => void;
}

export default function Step2SelectPlan({ selectedPlan, onPlanSelect }: Step2Props) {
  return (
    <div className="screen active">
      <h2 className="scan-title" style={{ textAlign: 'center', marginBottom: '4px' }}>Choose Plan</h2>
      <p className="scan-subtitle" style={{ textAlign: 'center', marginBottom: '12px' }}>Select a subscription package</p>

      <div className="product-grid">
        {AVAILABLE_PLANS.map((plan) => (
          <div 
            key={plan.id}
            className={`product-card ${selectedPlan === plan.id ? 'selected' : ''}`}
            onClick={() => onPlanSelect(plan.id)}
          >
            <div className="product-radio"></div>
            <div className="product-info">
              <div className="product-name">{plan.name}</div>
              <div className="product-desc">{plan.description}</div>
            </div>
            <div className="product-price">
              KES {plan.price.toLocaleString()}
              <span className="product-price-period">{plan.period}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
