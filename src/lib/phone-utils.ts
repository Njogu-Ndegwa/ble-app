/**
 * Phone number utilities for internationalization
 * Provides country-specific phone number placeholders and formatting
 * 
 * Note: For the PhoneInputWithCountry component, we use the react-phone-number-input
 * library which handles all country data internally. These utilities are kept for
 * backward compatibility with other parts of the codebase.
 */

export interface LegacyCountryPhoneFormat {
  countryCode: string;
  placeholder: string;
  example: string;
}

// Country phone formats for the primary markets (used for placeholders and examples)
const COUNTRY_PHONE_FORMATS: Record<string, LegacyCountryPhoneFormat> = {
  'KE': {
    countryCode: '+254',
    placeholder: '+254 7XX XXX XXX',
    example: '+254 712 345 678',
  },
  'TG': {
    countryCode: '+228',
    placeholder: '+228 XX XX XX XX',
    example: '+228 90 12 34 56',
  },
  'CN': {
    countryCode: '+86',
    placeholder: '+86 1XX XXXX XXXX',
    example: '+86 138 0013 8000',
  },
};

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
 * Get phone placeholder based on locale
 * @param locale - Locale string (e.g., 'en', 'fr', 'zh')
 * @returns Phone placeholder string with country code
 */
export function getPhonePlaceholder(locale?: string): string {
  const countryCode = detectCountryCodeFromLocale(locale);
  return COUNTRY_PHONE_FORMATS[countryCode]?.placeholder || COUNTRY_PHONE_FORMATS.KE.placeholder;
}

/**
 * Get country phone format information based on locale
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
  
  // If already has country code, return as-is (remove +)
  if (cleaned.startsWith('+')) {
    return cleaned.slice(1);
  }
  
  // If starts with 0, replace with country code
  if (cleaned.startsWith('0')) {
    return format.countryCode.replace('+', '') + cleaned.slice(1);
  }
  
  // If doesn't start with country code, add it
  const codeWithoutPlus = format.countryCode.replace('+', '');
  if (!cleaned.startsWith(codeWithoutPlus)) {
    return codeWithoutPlus + cleaned;
  }
  
  return cleaned;
}
