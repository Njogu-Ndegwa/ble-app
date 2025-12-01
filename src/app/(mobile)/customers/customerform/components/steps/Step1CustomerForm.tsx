'use client';

import React from 'react';
import { CustomerFormData } from '../types';

interface Step1Props {
  formData: CustomerFormData;
  onFormChange: (field: keyof CustomerFormData, value: string) => void;
  errors?: Partial<Record<keyof CustomerFormData, string>>;
}

export default function Step1CustomerForm({ formData, onFormChange, errors = {} }: Step1Props) {
  return (
    <div className="screen active">
      <h2 className="scan-title" style={{ textAlign: 'center', marginBottom: '4px' }}>New Customer</h2>
      <p className="scan-subtitle" style={{ textAlign: 'center', marginBottom: '12px' }}>Enter customer details to get started</p>

      <div className="form-section">
        <div className="form-section-title">Personal Information</div>
        
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">First Name <span className="form-required">*</span></label>
            <input 
              type="text" 
              className={`form-input ${errors.firstName ? 'form-input-error' : ''}`}
              value={formData.firstName}
              onChange={(e) => onFormChange('firstName', e.target.value)}
              placeholder="John"
            />
            {errors.firstName && <span className="form-error">{errors.firstName}</span>}
          </div>
          <div className="form-group">
            <label className="form-label">Last Name <span className="form-required">*</span></label>
            <input 
              type="text" 
              className={`form-input ${errors.lastName ? 'form-input-error' : ''}`}
              value={formData.lastName}
              onChange={(e) => onFormChange('lastName', e.target.value)}
              placeholder="Doe"
            />
            {errors.lastName && <span className="form-error">{errors.lastName}</span>}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Email Address <span className="form-required">*</span></label>
          <input 
            type="email" 
            className={`form-input ${errors.email ? 'form-input-error' : ''}`}
            value={formData.email}
            onChange={(e) => onFormChange('email', e.target.value)}
            placeholder="customer@example.com"
          />
          {errors.email && <span className="form-error">{errors.email}</span>}
        </div>

        <div className="form-group">
          <label className="form-label">Phone Number <span className="form-required">*</span></label>
          <input 
            type="tel" 
            className={`form-input ${errors.phone ? 'form-input-error' : ''}`}
            value={formData.phone}
            onChange={(e) => onFormChange('phone', e.target.value)}
            placeholder="+254 7XX XXX XXX"
          />
          {errors.phone && <span className="form-error">{errors.phone}</span>}
        </div>

        <div className="form-group">
          <label className="form-label">National ID <span className="form-required">*</span></label>
          <input 
            type="text" 
            className={`form-input ${errors.nationalId ? 'form-input-error' : ''}`}
            value={formData.nationalId}
            onChange={(e) => onFormChange('nationalId', e.target.value)}
            placeholder="Enter ID number"
          />
          {errors.nationalId && <span className="form-error">{errors.nationalId}</span>}
        </div>
      </div>

      <div className="form-section">
        <div className="form-section-title">Address Information</div>
        
        <div className="form-group">
          <label className="form-label">Street Address <span className="form-required">*</span></label>
          <input 
            type="text" 
            className={`form-input ${errors.street ? 'form-input-error' : ''}`}
            value={formData.street}
            onChange={(e) => onFormChange('street', e.target.value)}
            placeholder="123 Main Street"
          />
          {errors.street && <span className="form-error">{errors.street}</span>}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">City <span className="form-required">*</span></label>
            <input 
              type="text" 
              className={`form-input ${errors.city ? 'form-input-error' : ''}`}
              value={formData.city}
              onChange={(e) => onFormChange('city', e.target.value)}
              placeholder="Nairobi"
            />
            {errors.city && <span className="form-error">{errors.city}</span>}
          </div>
          <div className="form-group">
            <label className="form-label">Zip Code <span className="form-required">*</span></label>
            <input 
              type="text" 
              className={`form-input ${errors.zip ? 'form-input-error' : ''}`}
              value={formData.zip}
              onChange={(e) => onFormChange('zip', e.target.value)}
              placeholder="00100"
            />
            {errors.zip && <span className="form-error">{errors.zip}</span>}
          </div>
        </div>
      </div>

      <div className="form-section">
        <div className="form-section-title">Vehicle Information</div>
        
        <div className="form-group">
          <label className="form-label">Vehicle Registration <span className="form-required">*</span></label>
          <input 
            type="text" 
            className={`form-input ${errors.vehicleReg ? 'form-input-error' : ''}`}
            value={formData.vehicleReg}
            onChange={(e) => onFormChange('vehicleReg', e.target.value.toUpperCase())}
            placeholder="KXX 000X"
          />
          {errors.vehicleReg && <span className="form-error">{errors.vehicleReg}</span>}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Vehicle Type</label>
            <input 
              type="text" 
              className={`form-input ${errors.vehicleType ? 'form-input-error' : ''}`}
              value={formData.vehicleType}
              onChange={(e) => onFormChange('vehicleType', e.target.value)}
              placeholder="Motorcycle"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Model</label>
            <input 
              type="text" 
              className={`form-input ${errors.vehicleModel ? 'form-input-error' : ''}`}
              value={formData.vehicleModel}
              onChange={(e) => onFormChange('vehicleModel', e.target.value)}
              placeholder="TVS HLX 125"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
