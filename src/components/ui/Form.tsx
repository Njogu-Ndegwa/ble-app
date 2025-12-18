'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

// ============================================
// FORM INPUT
// ============================================

export type InputType = 'text' | 'email' | 'tel' | 'password' | 'number' | 'search';
export type InputSize = 'sm' | 'md' | 'lg';

// Country code data for phone input
export interface CountryCodeOption {
  code: string;       // ISO country code (e.g., 'KE')
  dialCode: string;   // Dial code with + (e.g., '+254')
  name: string;       // Country name
  flag: string;       // Flag emoji
  placeholder: string; // Phone number placeholder without country code
}

// Comprehensive list of countries with dial codes
// Sorted alphabetically by country name for easy lookup
export const COUNTRY_CODES: CountryCodeOption[] = [
  { code: 'AF', dialCode: '+93', name: 'Afghanistan', flag: '🇦🇫', placeholder: '7X XXX XXXX' },
  { code: 'AL', dialCode: '+355', name: 'Albania', flag: '🇦🇱', placeholder: '6X XXX XXXX' },
  { code: 'DZ', dialCode: '+213', name: 'Algeria', flag: '🇩🇿', placeholder: '5XX XX XX XX' },
  { code: 'AD', dialCode: '+376', name: 'Andorra', flag: '🇦🇩', placeholder: 'XXX XXX' },
  { code: 'AO', dialCode: '+244', name: 'Angola', flag: '🇦🇴', placeholder: '9XX XXX XXX' },
  { code: 'AR', dialCode: '+54', name: 'Argentina', flag: '🇦🇷', placeholder: '11 XXXX XXXX' },
  { code: 'AM', dialCode: '+374', name: 'Armenia', flag: '🇦🇲', placeholder: 'XX XXX XXX' },
  { code: 'AU', dialCode: '+61', name: 'Australia', flag: '🇦🇺', placeholder: '4XX XXX XXX' },
  { code: 'AT', dialCode: '+43', name: 'Austria', flag: '🇦🇹', placeholder: '6XX XXX XXXX' },
  { code: 'AZ', dialCode: '+994', name: 'Azerbaijan', flag: '🇦🇿', placeholder: 'XX XXX XX XX' },
  { code: 'BH', dialCode: '+973', name: 'Bahrain', flag: '🇧🇭', placeholder: 'XXXX XXXX' },
  { code: 'BD', dialCode: '+880', name: 'Bangladesh', flag: '🇧🇩', placeholder: '1XXX XXXXXX' },
  { code: 'BY', dialCode: '+375', name: 'Belarus', flag: '🇧🇾', placeholder: 'XX XXX XX XX' },
  { code: 'BE', dialCode: '+32', name: 'Belgium', flag: '🇧🇪', placeholder: '4XX XX XX XX' },
  { code: 'BJ', dialCode: '+229', name: 'Benin', flag: '🇧🇯', placeholder: 'XX XX XX XX' },
  { code: 'BT', dialCode: '+975', name: 'Bhutan', flag: '🇧🇹', placeholder: '17 XX XX XX' },
  { code: 'BO', dialCode: '+591', name: 'Bolivia', flag: '🇧🇴', placeholder: '7XXX XXXX' },
  { code: 'BA', dialCode: '+387', name: 'Bosnia', flag: '🇧🇦', placeholder: '6X XXX XXX' },
  { code: 'BW', dialCode: '+267', name: 'Botswana', flag: '🇧🇼', placeholder: '7X XXX XXX' },
  { code: 'BR', dialCode: '+55', name: 'Brazil', flag: '🇧🇷', placeholder: '11 9XXXX XXXX' },
  { code: 'BN', dialCode: '+673', name: 'Brunei', flag: '🇧🇳', placeholder: 'XXX XXXX' },
  { code: 'BG', dialCode: '+359', name: 'Bulgaria', flag: '🇧🇬', placeholder: '8X XXX XXXX' },
  { code: 'BF', dialCode: '+226', name: 'Burkina Faso', flag: '🇧🇫', placeholder: 'XX XX XX XX' },
  { code: 'BI', dialCode: '+257', name: 'Burundi', flag: '🇧🇮', placeholder: 'XX XX XX XX' },
  { code: 'KH', dialCode: '+855', name: 'Cambodia', flag: '🇰🇭', placeholder: '9X XXX XXX' },
  { code: 'CM', dialCode: '+237', name: 'Cameroon', flag: '🇨🇲', placeholder: '6XX XX XX XX' },
  { code: 'CA', dialCode: '+1', name: 'Canada', flag: '🇨🇦', placeholder: 'XXX XXX XXXX' },
  { code: 'CF', dialCode: '+236', name: 'Central African Republic', flag: '🇨🇫', placeholder: 'XX XX XX XX' },
  { code: 'TD', dialCode: '+235', name: 'Chad', flag: '🇹🇩', placeholder: 'XX XX XX XX' },
  { code: 'CL', dialCode: '+56', name: 'Chile', flag: '🇨🇱', placeholder: '9 XXXX XXXX' },
  { code: 'CN', dialCode: '+86', name: 'China', flag: '🇨🇳', placeholder: '1XX XXXX XXXX' },
  { code: 'CO', dialCode: '+57', name: 'Colombia', flag: '🇨🇴', placeholder: '3XX XXX XXXX' },
  { code: 'CG', dialCode: '+242', name: 'Congo', flag: '🇨🇬', placeholder: '0X XXX XXXX' },
  { code: 'CD', dialCode: '+243', name: 'Congo (DRC)', flag: '🇨🇩', placeholder: '9XX XXX XXX' },
  { code: 'CR', dialCode: '+506', name: 'Costa Rica', flag: '🇨🇷', placeholder: 'XXXX XXXX' },
  { code: 'CI', dialCode: '+225', name: "Côte d'Ivoire", flag: '🇨🇮', placeholder: 'XX XX XX XX XX' },
  { code: 'HR', dialCode: '+385', name: 'Croatia', flag: '🇭🇷', placeholder: '9X XXX XXXX' },
  { code: 'CU', dialCode: '+53', name: 'Cuba', flag: '🇨🇺', placeholder: '5 XXX XXXX' },
  { code: 'CY', dialCode: '+357', name: 'Cyprus', flag: '🇨🇾', placeholder: '9X XXX XXX' },
  { code: 'CZ', dialCode: '+420', name: 'Czech Republic', flag: '🇨🇿', placeholder: '6XX XXX XXX' },
  { code: 'DK', dialCode: '+45', name: 'Denmark', flag: '🇩🇰', placeholder: 'XX XX XX XX' },
  { code: 'DJ', dialCode: '+253', name: 'Djibouti', flag: '🇩🇯', placeholder: 'XX XX XX XX' },
  { code: 'DO', dialCode: '+1809', name: 'Dominican Republic', flag: '🇩🇴', placeholder: 'XXX XXXX' },
  { code: 'EC', dialCode: '+593', name: 'Ecuador', flag: '🇪🇨', placeholder: '9X XXX XXXX' },
  { code: 'EG', dialCode: '+20', name: 'Egypt', flag: '🇪🇬', placeholder: '1XX XXX XXXX' },
  { code: 'SV', dialCode: '+503', name: 'El Salvador', flag: '🇸🇻', placeholder: 'XXXX XXXX' },
  { code: 'GQ', dialCode: '+240', name: 'Equatorial Guinea', flag: '🇬🇶', placeholder: 'XXX XXX XXX' },
  { code: 'ER', dialCode: '+291', name: 'Eritrea', flag: '🇪🇷', placeholder: 'X XXX XXX' },
  { code: 'EE', dialCode: '+372', name: 'Estonia', flag: '🇪🇪', placeholder: 'XXXX XXXX' },
  { code: 'SZ', dialCode: '+268', name: 'Eswatini', flag: '🇸🇿', placeholder: 'XXXX XXXX' },
  { code: 'ET', dialCode: '+251', name: 'Ethiopia', flag: '🇪🇹', placeholder: '9X XXX XXXX' },
  { code: 'FJ', dialCode: '+679', name: 'Fiji', flag: '🇫🇯', placeholder: 'XXX XXXX' },
  { code: 'FI', dialCode: '+358', name: 'Finland', flag: '🇫🇮', placeholder: '4X XXX XXXX' },
  { code: 'FR', dialCode: '+33', name: 'France', flag: '🇫🇷', placeholder: '6 XX XX XX XX' },
  { code: 'GA', dialCode: '+241', name: 'Gabon', flag: '🇬🇦', placeholder: '0X XX XX XX' },
  { code: 'GM', dialCode: '+220', name: 'Gambia', flag: '🇬🇲', placeholder: 'XXX XXXX' },
  { code: 'GE', dialCode: '+995', name: 'Georgia', flag: '🇬🇪', placeholder: '5XX XXX XXX' },
  { code: 'DE', dialCode: '+49', name: 'Germany', flag: '🇩🇪', placeholder: '1XX XXXXXXX' },
  { code: 'GH', dialCode: '+233', name: 'Ghana', flag: '🇬🇭', placeholder: 'XX XXX XXXX' },
  { code: 'GR', dialCode: '+30', name: 'Greece', flag: '🇬🇷', placeholder: '6XX XXX XXXX' },
  { code: 'GT', dialCode: '+502', name: 'Guatemala', flag: '🇬🇹', placeholder: 'XXXX XXXX' },
  { code: 'GN', dialCode: '+224', name: 'Guinea', flag: '🇬🇳', placeholder: 'XXX XX XX XX' },
  { code: 'GW', dialCode: '+245', name: 'Guinea-Bissau', flag: '🇬🇼', placeholder: 'XXX XXXX' },
  { code: 'HT', dialCode: '+509', name: 'Haiti', flag: '🇭🇹', placeholder: 'XX XX XXXX' },
  { code: 'HN', dialCode: '+504', name: 'Honduras', flag: '🇭🇳', placeholder: 'XXXX XXXX' },
  { code: 'HK', dialCode: '+852', name: 'Hong Kong', flag: '🇭🇰', placeholder: 'XXXX XXXX' },
  { code: 'HU', dialCode: '+36', name: 'Hungary', flag: '🇭🇺', placeholder: '20 XXX XXXX' },
  { code: 'IS', dialCode: '+354', name: 'Iceland', flag: '🇮🇸', placeholder: 'XXX XXXX' },
  { code: 'IN', dialCode: '+91', name: 'India', flag: '🇮🇳', placeholder: 'XXXXX XXXXX' },
  { code: 'ID', dialCode: '+62', name: 'Indonesia', flag: '🇮🇩', placeholder: '8XX XXX XXXX' },
  { code: 'IR', dialCode: '+98', name: 'Iran', flag: '🇮🇷', placeholder: '9XX XXX XXXX' },
  { code: 'IQ', dialCode: '+964', name: 'Iraq', flag: '🇮🇶', placeholder: '7XX XXX XXXX' },
  { code: 'IE', dialCode: '+353', name: 'Ireland', flag: '🇮🇪', placeholder: '8X XXX XXXX' },
  { code: 'IL', dialCode: '+972', name: 'Israel', flag: '🇮🇱', placeholder: '5X XXX XXXX' },
  { code: 'IT', dialCode: '+39', name: 'Italy', flag: '🇮🇹', placeholder: '3XX XXX XXXX' },
  { code: 'JM', dialCode: '+1876', name: 'Jamaica', flag: '🇯🇲', placeholder: 'XXX XXXX' },
  { code: 'JP', dialCode: '+81', name: 'Japan', flag: '🇯🇵', placeholder: '90 XXXX XXXX' },
  { code: 'JO', dialCode: '+962', name: 'Jordan', flag: '🇯🇴', placeholder: '7X XXX XXXX' },
  { code: 'KZ', dialCode: '+7', name: 'Kazakhstan', flag: '🇰🇿', placeholder: '7XX XXX XXXX' },
  { code: 'KE', dialCode: '+254', name: 'Kenya', flag: '🇰🇪', placeholder: '7XX XXX XXX' },
  { code: 'KW', dialCode: '+965', name: 'Kuwait', flag: '🇰🇼', placeholder: 'XXXX XXXX' },
  { code: 'KG', dialCode: '+996', name: 'Kyrgyzstan', flag: '🇰🇬', placeholder: 'XXX XXX XXX' },
  { code: 'LA', dialCode: '+856', name: 'Laos', flag: '🇱🇦', placeholder: '20 XX XXX XXX' },
  { code: 'LV', dialCode: '+371', name: 'Latvia', flag: '🇱🇻', placeholder: '2X XXX XXX' },
  { code: 'LB', dialCode: '+961', name: 'Lebanon', flag: '🇱🇧', placeholder: 'XX XXX XXX' },
  { code: 'LS', dialCode: '+266', name: 'Lesotho', flag: '🇱🇸', placeholder: 'XX XXX XXX' },
  { code: 'LR', dialCode: '+231', name: 'Liberia', flag: '🇱🇷', placeholder: 'XX XXX XXXX' },
  { code: 'LY', dialCode: '+218', name: 'Libya', flag: '🇱🇾', placeholder: '9X XXX XXXX' },
  { code: 'LI', dialCode: '+423', name: 'Liechtenstein', flag: '🇱🇮', placeholder: 'XXX XXXX' },
  { code: 'LT', dialCode: '+370', name: 'Lithuania', flag: '🇱🇹', placeholder: '6XX XXXXX' },
  { code: 'LU', dialCode: '+352', name: 'Luxembourg', flag: '🇱🇺', placeholder: '6XX XXX XXX' },
  { code: 'MO', dialCode: '+853', name: 'Macau', flag: '🇲🇴', placeholder: '6XXX XXXX' },
  { code: 'MG', dialCode: '+261', name: 'Madagascar', flag: '🇲🇬', placeholder: '3X XX XXX XX' },
  { code: 'MW', dialCode: '+265', name: 'Malawi', flag: '🇲🇼', placeholder: '9XX XX XX XX' },
  { code: 'MY', dialCode: '+60', name: 'Malaysia', flag: '🇲🇾', placeholder: '1X XXX XXXX' },
  { code: 'MV', dialCode: '+960', name: 'Maldives', flag: '🇲🇻', placeholder: '7XX XXXX' },
  { code: 'ML', dialCode: '+223', name: 'Mali', flag: '🇲🇱', placeholder: 'XX XX XX XX' },
  { code: 'MT', dialCode: '+356', name: 'Malta', flag: '🇲🇹', placeholder: 'XXXX XXXX' },
  { code: 'MR', dialCode: '+222', name: 'Mauritania', flag: '🇲🇷', placeholder: 'XX XX XX XX' },
  { code: 'MU', dialCode: '+230', name: 'Mauritius', flag: '🇲🇺', placeholder: 'XXXX XXXX' },
  { code: 'MX', dialCode: '+52', name: 'Mexico', flag: '🇲🇽', placeholder: '1 XXX XXX XXXX' },
  { code: 'MD', dialCode: '+373', name: 'Moldova', flag: '🇲🇩', placeholder: '6XX XXXXX' },
  { code: 'MC', dialCode: '+377', name: 'Monaco', flag: '🇲🇨', placeholder: 'XX XX XX XX' },
  { code: 'MN', dialCode: '+976', name: 'Mongolia', flag: '🇲🇳', placeholder: 'XX XX XXXX' },
  { code: 'ME', dialCode: '+382', name: 'Montenegro', flag: '🇲🇪', placeholder: '6X XXX XXX' },
  { code: 'MA', dialCode: '+212', name: 'Morocco', flag: '🇲🇦', placeholder: '6XX XXX XXX' },
  { code: 'MZ', dialCode: '+258', name: 'Mozambique', flag: '🇲🇿', placeholder: '8X XXX XXXX' },
  { code: 'MM', dialCode: '+95', name: 'Myanmar', flag: '🇲🇲', placeholder: '9 XXX XXXX' },
  { code: 'NA', dialCode: '+264', name: 'Namibia', flag: '🇳🇦', placeholder: '8X XXX XXXX' },
  { code: 'NP', dialCode: '+977', name: 'Nepal', flag: '🇳🇵', placeholder: '98X XXX XXXX' },
  { code: 'NL', dialCode: '+31', name: 'Netherlands', flag: '🇳🇱', placeholder: '6 XXXX XXXX' },
  { code: 'NZ', dialCode: '+64', name: 'New Zealand', flag: '🇳🇿', placeholder: '2X XXX XXXX' },
  { code: 'NI', dialCode: '+505', name: 'Nicaragua', flag: '🇳🇮', placeholder: 'XXXX XXXX' },
  { code: 'NE', dialCode: '+227', name: 'Niger', flag: '🇳🇪', placeholder: 'XX XX XX XX' },
  { code: 'NG', dialCode: '+234', name: 'Nigeria', flag: '🇳🇬', placeholder: '8XX XXX XXXX' },
  { code: 'KP', dialCode: '+850', name: 'North Korea', flag: '🇰🇵', placeholder: '19X XXX XXXX' },
  { code: 'MK', dialCode: '+389', name: 'North Macedonia', flag: '🇲🇰', placeholder: '7X XXX XXX' },
  { code: 'NO', dialCode: '+47', name: 'Norway', flag: '🇳🇴', placeholder: 'XXX XX XXX' },
  { code: 'OM', dialCode: '+968', name: 'Oman', flag: '🇴🇲', placeholder: 'XXXX XXXX' },
  { code: 'PK', dialCode: '+92', name: 'Pakistan', flag: '🇵🇰', placeholder: '3XX XXX XXXX' },
  { code: 'PS', dialCode: '+970', name: 'Palestine', flag: '🇵🇸', placeholder: '5X XXX XXXX' },
  { code: 'PA', dialCode: '+507', name: 'Panama', flag: '🇵🇦', placeholder: 'XXXX XXXX' },
  { code: 'PG', dialCode: '+675', name: 'Papua New Guinea', flag: '🇵🇬', placeholder: 'XXX XXXX' },
  { code: 'PY', dialCode: '+595', name: 'Paraguay', flag: '🇵🇾', placeholder: '9XX XXX XXX' },
  { code: 'PE', dialCode: '+51', name: 'Peru', flag: '🇵🇪', placeholder: '9XX XXX XXX' },
  { code: 'PH', dialCode: '+63', name: 'Philippines', flag: '🇵🇭', placeholder: '9XX XXX XXXX' },
  { code: 'PL', dialCode: '+48', name: 'Poland', flag: '🇵🇱', placeholder: 'XXX XXX XXX' },
  { code: 'PT', dialCode: '+351', name: 'Portugal', flag: '🇵🇹', placeholder: '9X XXX XXXX' },
  { code: 'QA', dialCode: '+974', name: 'Qatar', flag: '🇶🇦', placeholder: 'XXXX XXXX' },
  { code: 'RO', dialCode: '+40', name: 'Romania', flag: '🇷🇴', placeholder: '7XX XXX XXX' },
  { code: 'RU', dialCode: '+7', name: 'Russia', flag: '🇷🇺', placeholder: '9XX XXX XXXX' },
  { code: 'RW', dialCode: '+250', name: 'Rwanda', flag: '🇷🇼', placeholder: '7XX XXX XXX' },
  { code: 'SA', dialCode: '+966', name: 'Saudi Arabia', flag: '🇸🇦', placeholder: '5X XXX XXXX' },
  { code: 'SN', dialCode: '+221', name: 'Senegal', flag: '🇸🇳', placeholder: '7X XXX XX XX' },
  { code: 'RS', dialCode: '+381', name: 'Serbia', flag: '🇷🇸', placeholder: '6X XXX XXXX' },
  { code: 'SL', dialCode: '+232', name: 'Sierra Leone', flag: '🇸🇱', placeholder: 'XX XXX XXX' },
  { code: 'SG', dialCode: '+65', name: 'Singapore', flag: '🇸🇬', placeholder: 'XXXX XXXX' },
  { code: 'SK', dialCode: '+421', name: 'Slovakia', flag: '🇸🇰', placeholder: '9XX XXX XXX' },
  { code: 'SI', dialCode: '+386', name: 'Slovenia', flag: '🇸🇮', placeholder: '3X XXX XXX' },
  { code: 'SO', dialCode: '+252', name: 'Somalia', flag: '🇸🇴', placeholder: 'XX XXX XXX' },
  { code: 'ZA', dialCode: '+27', name: 'South Africa', flag: '🇿🇦', placeholder: '7X XXX XXXX' },
  { code: 'KR', dialCode: '+82', name: 'South Korea', flag: '🇰🇷', placeholder: '10 XXXX XXXX' },
  { code: 'SS', dialCode: '+211', name: 'South Sudan', flag: '🇸🇸', placeholder: '9X XXX XXXX' },
  { code: 'ES', dialCode: '+34', name: 'Spain', flag: '🇪🇸', placeholder: '6XX XXX XXX' },
  { code: 'LK', dialCode: '+94', name: 'Sri Lanka', flag: '🇱🇰', placeholder: '7X XXX XXXX' },
  { code: 'SD', dialCode: '+249', name: 'Sudan', flag: '🇸🇩', placeholder: '9X XXX XXXX' },
  { code: 'SE', dialCode: '+46', name: 'Sweden', flag: '🇸🇪', placeholder: '7X XXX XX XX' },
  { code: 'CH', dialCode: '+41', name: 'Switzerland', flag: '🇨🇭', placeholder: '7X XXX XX XX' },
  { code: 'SY', dialCode: '+963', name: 'Syria', flag: '🇸🇾', placeholder: '9XX XXX XXX' },
  { code: 'TW', dialCode: '+886', name: 'Taiwan', flag: '🇹🇼', placeholder: '9XX XXX XXX' },
  { code: 'TJ', dialCode: '+992', name: 'Tajikistan', flag: '🇹🇯', placeholder: 'XX XXX XXXX' },
  { code: 'TZ', dialCode: '+255', name: 'Tanzania', flag: '🇹🇿', placeholder: '7XX XXX XXX' },
  { code: 'TH', dialCode: '+66', name: 'Thailand', flag: '🇹🇭', placeholder: '8X XXX XXXX' },
  { code: 'TG', dialCode: '+228', name: 'Togo', flag: '🇹🇬', placeholder: 'XX XX XX XX' },
  { code: 'TT', dialCode: '+1868', name: 'Trinidad and Tobago', flag: '🇹🇹', placeholder: 'XXX XXXX' },
  { code: 'TN', dialCode: '+216', name: 'Tunisia', flag: '🇹🇳', placeholder: 'XX XXX XXX' },
  { code: 'TR', dialCode: '+90', name: 'Turkey', flag: '🇹🇷', placeholder: '5XX XXX XXXX' },
  { code: 'TM', dialCode: '+993', name: 'Turkmenistan', flag: '🇹🇲', placeholder: '6X XXXXXX' },
  { code: 'UG', dialCode: '+256', name: 'Uganda', flag: '🇺🇬', placeholder: '7XX XXX XXX' },
  { code: 'UA', dialCode: '+380', name: 'Ukraine', flag: '🇺🇦', placeholder: '9X XXX XXXX' },
  { code: 'AE', dialCode: '+971', name: 'United Arab Emirates', flag: '🇦🇪', placeholder: '5X XXX XXXX' },
  { code: 'GB', dialCode: '+44', name: 'United Kingdom', flag: '🇬🇧', placeholder: '7XXX XXXXXX' },
  { code: 'US', dialCode: '+1', name: 'United States', flag: '🇺🇸', placeholder: 'XXX XXX XXXX' },
  { code: 'UY', dialCode: '+598', name: 'Uruguay', flag: '🇺🇾', placeholder: '9X XXX XXX' },
  { code: 'UZ', dialCode: '+998', name: 'Uzbekistan', flag: '🇺🇿', placeholder: '9X XXX XX XX' },
  { code: 'VE', dialCode: '+58', name: 'Venezuela', flag: '🇻🇪', placeholder: '4XX XXX XXXX' },
  { code: 'VN', dialCode: '+84', name: 'Vietnam', flag: '🇻🇳', placeholder: '9X XXX XX XX' },
  { code: 'YE', dialCode: '+967', name: 'Yemen', flag: '🇾🇪', placeholder: '7XX XXX XXX' },
  { code: 'ZM', dialCode: '+260', name: 'Zambia', flag: '🇿🇲', placeholder: '9X XXX XXXX' },
  { code: 'ZW', dialCode: '+263', name: 'Zimbabwe', flag: '🇿🇼', placeholder: '7X XXX XXXX' },
];

// Helper to get country by code
export function getCountryByCode(code: string): CountryCodeOption | undefined {
  return COUNTRY_CODES.find(c => c.code === code);
}

// Helper to get country by dial code
export function getCountryByDialCode(dialCode: string): CountryCodeOption | undefined {
  return COUNTRY_CODES.find(c => c.dialCode === dialCode);
}

interface FormInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Input label */
  label?: string;
  /** Error message */
  error?: string;
  /** Helper text */
  helperText?: string;
  /** Required indicator */
  required?: boolean;
  /** Size variant */
  size?: InputSize;
  /** Left icon */
  leftIcon?: React.ReactNode;
  /** Right icon */
  rightIcon?: React.ReactNode;
  /** Full width */
  fullWidth?: boolean;
}

const SIZE_STYLES: Record<InputSize, React.CSSProperties> = {
  sm: { height: '36px', padding: '8px 10px', fontSize: '12px' },
  md: { height: '40px', padding: '10px 12px', fontSize: '12px' },
  lg: { height: '48px', padding: '12px 14px', fontSize: '14px' },
};

/**
 * FormInput - Styled input field with label and error state
 */
export function FormInput({
  label,
  error,
  helperText,
  required = false,
  size = 'md',
  leftIcon,
  rightIcon,
  fullWidth = true,
  className = '',
  style,
  ...props
}: FormInputProps) {
  const sizeStyle = SIZE_STYLES[size];
  const hasError = !!error;

  const inputStyles: React.CSSProperties = {
    width: fullWidth ? '100%' : 'auto',
    backgroundColor: 'var(--bg-surface)',
    border: `1px solid ${hasError ? 'var(--color-error)' : 'var(--border-default)'}`,
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    outline: 'none',
    transition: 'var(--transition-fast)',
    fontFamily: 'var(--font-sans)',
    ...sizeStyle,
    ...(leftIcon && { paddingLeft: 'var(--space-10)' }),
    ...(rightIcon && { paddingRight: 'var(--space-10)' }),
    ...style,
  };

  return (
    <div className={`form-group ${className}`} style={{ marginBottom: 'var(--space-2)' }}>
      {label && (
        <label className="text-label" style={{
          display: 'block',
          marginBottom: '4px',
          fontSize: 'var(--font-sm)',
          fontWeight: 500,
          color: 'var(--text-secondary)',
        }}>
          {label}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        {leftIcon && (
          <div style={{
            position: 'absolute',
            left: 'var(--space-3)',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)',
            width: 'var(--icon-md)',
            height: 'var(--icon-md)',
          }}>
            {leftIcon}
          </div>
        )}
        <input
          className={`form-input ${hasError ? 'form-input-error' : ''}`}
          style={inputStyles}
          {...props}
        />
        {rightIcon && (
          <div style={{
            position: 'absolute',
            right: 'var(--space-3)',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)',
            width: 'var(--icon-md)',
            height: 'var(--icon-md)',
          }}>
            {rightIcon}
          </div>
        )}
      </div>
      {error && (
        <span className="text-caption" style={{ 
          display: 'block',
          marginTop: 'var(--space-1)',
          color: 'var(--color-error)',
        }}>
          {error}
        </span>
      )}
      {helperText && !error && (
        <span className="text-caption" style={{ 
          display: 'block',
          marginTop: 'var(--space-1)',
          color: 'var(--text-muted)',
        }}>
          {helperText}
        </span>
      )}
    </div>
  );
}

// ============================================
// PHONE INPUT WITH COUNTRY CODE
// ============================================

interface PhoneInputWithCountryCodeProps {
  /** Input label */
  label?: string;
  /** The full phone number value including country code (e.g., '+254712345678') */
  value: string;
  /** Change handler - receives the full phone number with country code */
  onChange: (value: string) => void;
  /** Error message */
  error?: string;
  /** Helper text */
  helperText?: string;
  /** Required indicator */
  required?: boolean;
  /** Size variant */
  size?: InputSize;
  /** Default country code (e.g., 'KE') */
  defaultCountry?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Custom className */
  className?: string;
}

/**
 * PhoneInputWithCountryCode - Phone input with country code selector
 * 
 * Allows selecting country code from a dropdown and entering the phone number.
 * Value is stored as full phone number with country code (e.g., '+254712345678').
 */
export function PhoneInputWithCountryCode({
  label,
  value,
  onChange,
  error,
  helperText,
  required = false,
  size = 'md',
  defaultCountry = 'KE',
  disabled = false,
  className = '',
}: PhoneInputWithCountryCodeProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Filter countries based on search query
  const filteredCountries = searchQuery.trim() 
    ? COUNTRY_CODES.filter(country => 
        country.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        country.dialCode.includes(searchQuery) ||
        country.code.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : COUNTRY_CODES;
  
  // Focus search input when dropdown opens
  useEffect(() => {
    if (isDropdownOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    if (!isDropdownOpen) {
      setSearchQuery(''); // Clear search when dropdown closes
    }
  }, [isDropdownOpen]);
  
  // Parse the current value to extract country code and local number
  const parsePhoneValue = (phone: string): { countryCode: string; localNumber: string } => {
    if (!phone) {
      return { countryCode: defaultCountry, localNumber: '' };
    }
    
    // Find matching country by dial code
    for (const country of COUNTRY_CODES) {
      if (phone.startsWith(country.dialCode)) {
        return {
          countryCode: country.code,
          localNumber: phone.slice(country.dialCode.length),
        };
      }
      // Also check without + prefix
      const dialCodeWithoutPlus = country.dialCode.replace('+', '');
      if (phone.startsWith(dialCodeWithoutPlus)) {
        return {
          countryCode: country.code,
          localNumber: phone.slice(dialCodeWithoutPlus.length),
        };
      }
    }
    
    // Default to provided defaultCountry if no match
    return { countryCode: defaultCountry, localNumber: phone.replace(/^\+/, '') };
  };
  
  const { countryCode, localNumber } = parsePhoneValue(value);
  const selectedCountry = COUNTRY_CODES.find(c => c.code === countryCode) || COUNTRY_CODES[0];
  
  // Handle country code selection
  const handleCountrySelect = (country: CountryCodeOption) => {
    setIsDropdownOpen(false);
    // Rebuild the full phone number with new country code
    onChange(`${country.dialCode}${localNumber}`);
  };
  
  // Handle local number input
  const handleLocalNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newLocalNumber = e.target.value.replace(/[^0-9]/g, ''); // Only allow digits
    onChange(`${selectedCountry.dialCode}${newLocalNumber}`);
  };
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDropdownOpen]);
  
  const sizeStyle = SIZE_STYLES[size];
  const hasError = !!error;
  
  return (
    <div className={`form-group ${className}`} style={{ marginBottom: 'var(--space-2)' }}>
      {label && (
        <label className="text-label" style={{
          display: 'block',
          marginBottom: '4px',
          fontSize: 'var(--font-sm)',
          fontWeight: 500,
          color: 'var(--text-secondary)',
        }}>
          {label}
        </label>
      )}
      
      <div style={{ display: 'flex', gap: '4px', position: 'relative' }} ref={dropdownRef}>
        {/* Country Code Selector */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            minWidth: '90px',
            backgroundColor: 'var(--bg-surface)',
            border: `1px solid ${hasError ? 'var(--color-error)' : 'var(--border-default)'}`,
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-primary)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'var(--transition-fast)',
            fontFamily: 'var(--font-sans)',
            fontSize: '12px',
            ...sizeStyle,
            padding: '0 8px',
            opacity: disabled ? 0.5 : 1,
          }}
        >
          <span style={{ fontSize: '16px' }}>{selectedCountry.flag}</span>
          <span style={{ fontWeight: 500 }}>{selectedCountry.dialCode}</span>
          <ChevronDown size={14} style={{ 
            marginLeft: 'auto', 
            transition: 'transform 0.2s',
            transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          }} />
        </button>
        
        {/* Country Dropdown */}
        {isDropdownOpen && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: '4px',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            zIndex: 100,
            width: '280px',
            overflow: 'hidden',
          }}>
            {/* Search Input */}
            <div style={{ 
              padding: '8px', 
              borderBottom: '1px solid var(--border-default)',
              position: 'sticky',
              top: 0,
              backgroundColor: 'var(--bg-surface)',
            }}>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search country..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  backgroundColor: 'var(--bg-base)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  outline: 'none',
                  fontFamily: 'var(--font-sans)',
                }}
              />
            </div>
            
            {/* Countries List */}
            <div style={{
              maxHeight: '250px',
              overflowY: 'auto',
            }}>
              {filteredCountries.length === 0 ? (
                <div style={{
                  padding: '16px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '13px',
                }}>
                  No countries found
                </div>
              ) : (
                filteredCountries.map((country) => (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => handleCountrySelect(country)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      width: '100%',
                      padding: '10px 12px',
                      backgroundColor: country.code === selectedCountry.code 
                        ? 'var(--bg-active)' 
                        : 'transparent',
                      border: 'none',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '13px',
                      textAlign: 'left',
                      transition: 'background-color 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      if (country.code !== selectedCountry.code) {
                        e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 
                        country.code === selectedCountry.code ? 'var(--bg-active)' : 'transparent';
                    }}
                  >
                    <span style={{ fontSize: '18px' }}>{country.flag}</span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{country.name}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '12px', flexShrink: 0 }}>{country.dialCode}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
        
        {/* Phone Number Input */}
        <input
          type="tel"
          value={localNumber}
          onChange={handleLocalNumberChange}
          placeholder={selectedCountry.placeholder}
          disabled={disabled}
          style={{
            flex: 1,
            backgroundColor: 'var(--bg-surface)',
            border: `1px solid ${hasError ? 'var(--color-error)' : 'var(--border-default)'}`,
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-primary)',
            outline: 'none',
            transition: 'var(--transition-fast)',
            fontFamily: 'var(--font-sans)',
            ...sizeStyle,
            opacity: disabled ? 0.5 : 1,
          }}
        />
      </div>
      
      {error && (
        <span className="text-caption" style={{ 
          display: 'block',
          marginTop: 'var(--space-1)',
          color: 'var(--color-error)',
        }}>
          {error}
        </span>
      )}
      {helperText && !error && (
        <span className="text-caption" style={{ 
          display: 'block',
          marginTop: 'var(--space-1)',
          color: 'var(--text-muted)',
        }}>
          {helperText}
        </span>
      )}
    </div>
  );
}

// ============================================
// FORM GROUP
// ============================================

interface FormGroupProps {
  /** Children */
  children: React.ReactNode;
  /** Layout direction */
  direction?: 'row' | 'column';
  /** Gap between items */
  gap?: number;
  /** Custom className */
  className?: string;
}

/**
 * FormGroup - Group form fields together
 */
export function FormGroup({
  children,
  direction = 'column',
  gap = 16,
  className = '',
}: FormGroupProps) {
  return (
    <div 
      className={`form-group-container ${className}`}
      style={{
        display: 'flex',
        flexDirection: direction,
        gap: `${gap}px`,
      }}
    >
      {children}
    </div>
  );
}

// ============================================
// FORM SECTION
// ============================================

interface FormSectionProps {
  /** Section title */
  title: string;
  /** Section description */
  description?: string;
  /** Children */
  children: React.ReactNode;
  /** Custom className */
  className?: string;
}

/**
 * FormSection - Section with title for grouping related fields
 */
export function FormSection({
  title,
  description,
  children,
  className = '',
}: FormSectionProps) {
  return (
    <div className={`form-section ${className}`} style={{ marginBottom: '16px' }}>
      <div style={{ marginBottom: '8px' }}>
        <h3 style={{ 
          fontSize: '13px',
          fontWeight: 500,
          marginBottom: '4px',
          color: 'var(--text-secondary)',
        }}>{title}</h3>
        {description && (
          <p className="text-caption text-muted" style={{ margin: 0 }}>{description}</p>
        )}
      </div>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0',
      }}>
        {children}
      </div>
    </div>
  );
}

// ============================================
// FORM ROW
// ============================================

interface FormRowProps {
  /** Children */
  children: React.ReactNode;
  /** Number of columns */
  columns?: 2 | 3 | 4;
  /** Gap between items */
  gap?: number;
  /** Custom className */
  className?: string;
}

/**
 * FormRow - Horizontal row of form fields
 */
export function FormRow({
  children,
  columns = 2,
  gap = 8,
  className = '',
}: FormRowProps) {
  return (
    <div 
      className={`form-row ${className}`}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: `${gap}px`,
      }}
    >
      {children}
    </div>
  );
}

// ============================================
// TOGGLE GROUP
// ============================================

interface ToggleOption<T> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

interface ToggleGroupProps<T> {
  /** Options */
  options: ToggleOption<T>[];
  /** Selected value */
  value: T;
  /** Change handler */
  onChange: (value: T) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Custom className */
  className?: string;
}

/**
 * ToggleGroup - Toggle between options (like scan/manual)
 */
export function ToggleGroup<T extends string | number>({
  options,
  value,
  onChange,
  disabled = false,
  className = '',
}: ToggleGroupProps<T>) {
  return (
    <div 
      className={`toggle-group ${className}`}
      style={{
        display: 'flex',
        gap: 'var(--space-2)',
        padding: 'var(--space-1)',
        backgroundColor: 'var(--bg-surface)',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option.value)}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-1-5)',
            padding: 'var(--space-2-5) var(--space-4)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-sm)',
            fontWeight: 'var(--weight-medium)' as React.CSSProperties['fontWeight'],
            fontFamily: 'var(--font-sans)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'var(--transition-fast)',
            backgroundColor: value === option.value ? 'var(--color-brand)' : 'transparent',
            color: value === option.value ? 'var(--text-inverse)' : 'var(--text-muted)',
            opacity: disabled ? 0.5 : 1,
          }}
        >
          {option.icon && (
            <span style={{ width: 'var(--icon-sm)', height: 'var(--icon-sm)' }}>
              {option.icon}
            </span>
          )}
          {option.label}
        </button>
      ))}
    </div>
  );
}
