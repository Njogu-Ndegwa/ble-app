/**
 * Phone number utilities for internationalization
 * Provides country-specific phone number placeholders and formatting
 */

export interface CountryPhoneFormat {
  /** ISO country code (e.g., 'KE', 'TG', 'CN') */
  isoCode: string;
  /** Country name in English */
  name: string;
  /** Dial code with + prefix (e.g., '+254') */
  dialCode: string;
  /** Flag emoji */
  flag: string;
  /** Phone number placeholder (local format without country code) */
  placeholder: string;
  /** Example phone number */
  example: string;
  /** Expected length of local phone number (without country code) */
  localLength?: number;
}

// Comprehensive list of countries with phone formats
// Sorted by relevance (primary markets first, then alphabetically)
export const COUNTRIES: CountryPhoneFormat[] = [
  // Primary markets (Kenya, Togo, China)
  {
    isoCode: 'KE',
    name: 'Kenya',
    dialCode: '+254',
    flag: '🇰🇪',
    placeholder: '7XX XXX XXX',
    example: '712 345 678',
    localLength: 9,
  },
  {
    isoCode: 'TG',
    name: 'Togo',
    dialCode: '+228',
    flag: '🇹🇬',
    placeholder: 'XX XX XX XX',
    example: '90 12 34 56',
    localLength: 8,
  },
  {
    isoCode: 'CN',
    name: 'China',
    dialCode: '+86',
    flag: '🇨🇳',
    placeholder: '1XX XXXX XXXX',
    example: '138 0013 8000',
    localLength: 11,
  },
  // Additional African countries
  {
    isoCode: 'NG',
    name: 'Nigeria',
    dialCode: '+234',
    flag: '🇳🇬',
    placeholder: 'XXX XXX XXXX',
    example: '803 123 4567',
    localLength: 10,
  },
  {
    isoCode: 'UG',
    name: 'Uganda',
    dialCode: '+256',
    flag: '🇺🇬',
    placeholder: '7XX XXX XXX',
    example: '712 345 678',
    localLength: 9,
  },
  {
    isoCode: 'TZ',
    name: 'Tanzania',
    dialCode: '+255',
    flag: '🇹🇿',
    placeholder: '7XX XXX XXX',
    example: '712 345 678',
    localLength: 9,
  },
  {
    isoCode: 'RW',
    name: 'Rwanda',
    dialCode: '+250',
    flag: '🇷🇼',
    placeholder: '7XX XXX XXX',
    example: '788 123 456',
    localLength: 9,
  },
  {
    isoCode: 'GH',
    name: 'Ghana',
    dialCode: '+233',
    flag: '🇬🇭',
    placeholder: 'XX XXX XXXX',
    example: '24 123 4567',
    localLength: 9,
  },
  {
    isoCode: 'ZA',
    name: 'South Africa',
    dialCode: '+27',
    flag: '🇿🇦',
    placeholder: 'XX XXX XXXX',
    example: '82 123 4567',
    localLength: 9,
  },
  {
    isoCode: 'ET',
    name: 'Ethiopia',
    dialCode: '+251',
    flag: '🇪🇹',
    placeholder: '9X XXX XXXX',
    example: '91 123 4567',
    localLength: 9,
  },
  // Additional countries (alphabetically)
  {
    isoCode: 'BD',
    name: 'Bangladesh',
    dialCode: '+880',
    flag: '🇧🇩',
    placeholder: '1XXX XXXXXX',
    example: '1812 345678',
    localLength: 10,
  },
  {
    isoCode: 'IN',
    name: 'India',
    dialCode: '+91',
    flag: '🇮🇳',
    placeholder: 'XXXXX XXXXX',
    example: '98765 43210',
    localLength: 10,
  },
  {
    isoCode: 'PH',
    name: 'Philippines',
    dialCode: '+63',
    flag: '🇵🇭',
    placeholder: '9XX XXX XXXX',
    example: '917 123 4567',
    localLength: 10,
  },
  {
    isoCode: 'VN',
    name: 'Vietnam',
    dialCode: '+84',
    flag: '🇻🇳',
    placeholder: 'XX XXX XXXX',
    example: '91 234 5678',
    localLength: 9,
  },
  {
    isoCode: 'ID',
    name: 'Indonesia',
    dialCode: '+62',
    flag: '🇮🇩',
    placeholder: '8XX XXX XXXX',
    example: '812 345 6789',
    localLength: 10,
  },
  {
    isoCode: 'PK',
    name: 'Pakistan',
    dialCode: '+92',
    flag: '🇵🇰',
    placeholder: '3XX XXXXXXX',
    example: '300 1234567',
    localLength: 10,
  },
];

// Legacy interface for backward compatibility
export interface LegacyCountryPhoneFormat {
  countryCode: string;
  placeholder: string;
  example: string;
}

// Country phone formats map for backward compatibility
const COUNTRY_PHONE_FORMATS: Record<string, LegacyCountryPhoneFormat> = Object.fromEntries(
  COUNTRIES.map(c => [c.isoCode, {
    countryCode: c.dialCode,
    placeholder: `${c.dialCode} ${c.placeholder}`,
    example: `${c.dialCode} ${c.example}`,
  }])
);

/**
 * Map locale to country code
 * en → Kenya (KE)
 * fr → Togo (TG)
 * zh → China (CN)
 */
const LOCALE_TO_COUNTRY: Record<string, string> = {
  'en': 'KE',
  'fr': 'TG',
  'zh': 'CN',
};

/**
 * Detect country code from locale
 * @param locale - Locale string (e.g., 'en', 'fr', 'zh')
 * @returns ISO country code (e.g., 'KE', 'TG', 'CN')
 */
export function detectCountryCodeFromLocale(locale?: string): string {
  if (!locale) {
    // Try to detect from browser if locale not provided
    if (typeof window !== 'undefined') {
      const browserLocale = navigator.language || navigator.languages?.[0] || 'en';
      const langCode = browserLocale.split('-')[0].toLowerCase();
      return LOCALE_TO_COUNTRY[langCode] || 'KE';
    }
    return 'KE'; // Default to Kenya
  }
  
  const langCode = locale.toLowerCase();
  return LOCALE_TO_COUNTRY[langCode] || 'KE'; // Default to Kenya
}

/**
 * Get the default country based on locale
 * @param locale - Locale string (e.g., 'en', 'fr', 'zh')
 * @returns CountryPhoneFormat for the default country
 */
export function getDefaultCountry(locale?: string): CountryPhoneFormat {
  const isoCode = detectCountryCodeFromLocale(locale);
  return COUNTRIES.find(c => c.isoCode === isoCode) || COUNTRIES[0];
}

/**
 * Get country by ISO code
 * @param isoCode - ISO country code (e.g., 'KE', 'TG', 'CN')
 * @returns CountryPhoneFormat or undefined if not found
 */
export function getCountryByIsoCode(isoCode: string): CountryPhoneFormat | undefined {
  return COUNTRIES.find(c => c.isoCode === isoCode.toUpperCase());
}

/**
 * Get country by dial code
 * @param dialCode - Dial code with or without + prefix (e.g., '+254' or '254')
 * @returns CountryPhoneFormat or undefined if not found
 */
export function getCountryByDialCode(dialCode: string): CountryPhoneFormat | undefined {
  const normalized = dialCode.startsWith('+') ? dialCode : `+${dialCode}`;
  return COUNTRIES.find(c => c.dialCode === normalized);
}

/**
 * Get phone placeholder based on locale (backward compatible)
 * @param locale - Locale string (e.g., 'en', 'fr', 'zh')
 * @returns Phone placeholder string with country code
 */
export function getPhonePlaceholder(locale?: string): string {
  const countryCode = detectCountryCodeFromLocale(locale);
  return COUNTRY_PHONE_FORMATS[countryCode]?.placeholder || COUNTRY_PHONE_FORMATS.KE.placeholder;
}

/**
 * Get country phone format information based on locale (backward compatible)
 * @param locale - Locale string (e.g., 'en', 'fr', 'zh')
 * @returns Country phone format object
 */
export function getCountryPhoneFormat(locale?: string): LegacyCountryPhoneFormat {
  const countryCode = detectCountryCodeFromLocale(locale);
  return COUNTRY_PHONE_FORMATS[countryCode] || COUNTRY_PHONE_FORMATS.KE;
}

/**
 * Format phone number with country code
 * Attempts to add country code if missing
 * @param phone - Phone number string
 * @param locale - Locale string (e.g., 'en', 'fr', 'zh')
 * @returns Formatted phone number
 */
export function formatPhoneWithCountryCode(phone: string, locale?: string): string {
  const format = getCountryPhoneFormat(locale);
  const cleaned = phone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
  
  // If already has country code, return as-is
  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  
  // If starts with 0, replace with country code
  if (cleaned.startsWith('0')) {
    return format.countryCode.replace('+', '') + cleaned.slice(1);
  }
  
  // If doesn't start with country code, add it
  if (!cleaned.startsWith(format.countryCode.replace('+', ''))) {
    return format.countryCode.replace('+', '') + cleaned;
  }
  
  return cleaned;
}

/**
 * Format phone number with a specific country
 * @param localNumber - Local phone number (without country code)
 * @param country - CountryPhoneFormat object
 * @returns Full phone number with country code
 */
export function formatPhoneWithCountry(localNumber: string, country: CountryPhoneFormat): string {
  // Clean the local number
  let cleaned = localNumber.replace(/\s+/g, '').replace(/[^0-9]/g, '');
  
  // If starts with 0, remove it
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.slice(1);
  }
  
  // Return with country code (without + for backend)
  return country.dialCode.replace('+', '') + cleaned;
}

/**
 * Parse a full phone number into country and local parts
 * @param fullPhone - Full phone number with country code
 * @returns Object with country and localNumber, or null if not matched
 */
export function parsePhoneNumber(fullPhone: string): { country: CountryPhoneFormat; localNumber: string } | null {
  // Clean the phone number
  let cleaned = fullPhone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
  
  // Ensure it starts with +
  if (!cleaned.startsWith('+') && cleaned.length > 10) {
    cleaned = '+' + cleaned;
  }
  
  // Try to match against known countries (longest dial code first)
  const sortedCountries = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);
  
  for (const country of sortedCountries) {
    if (cleaned.startsWith(country.dialCode)) {
      return {
        country,
        localNumber: cleaned.slice(country.dialCode.length),
      };
    }
    // Also try without the + prefix
    if (cleaned.startsWith(country.dialCode.replace('+', ''))) {
      return {
        country,
        localNumber: cleaned.slice(country.dialCode.length - 1),
      };
    }
  }
  
  return null;
}

