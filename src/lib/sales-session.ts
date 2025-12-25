/**
 * Sales Flow Session Persistence
 * 
 * Manages persisting the sales flow state to localStorage so that
 * if a salesperson's session is interrupted (phone goes off, app closes, etc.),
 * they can resume from where they left off.
 */

import type { 
  CustomerFormData, 
  SalesStep, 
  SubscriptionData,
  BatteryData 
} from '@/app/(mobile)/customers/customerform/components/types';

// Storage key for the sales session
const SALES_SESSION_KEY = 'oves_sales_session';

// Session expiry time (24 hours in milliseconds)
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000;

/**
 * Persisted session data structure
 * Contains all the state needed to resume a sales flow
 */
export interface SalesSessionData {
  // Flow progress
  currentStep: SalesStep;
  maxStepReached: SalesStep;
  
  // Customer form data
  formData: CustomerFormData;
  
  // Package selection (product + privilege bundled)
  selectedPackageId: string;
  
  // Plan selection
  selectedPlanId: string;
  
  // Customer registration results (from Odoo)
  createdCustomerId: number | null;
  createdPartnerId: number | null;
  customerSessionToken: string | null;
  
  // Subscription data
  subscriptionData: SubscriptionData | null;
  
  // Payment state
  paymentConfirmed: boolean;
  paymentReference: string;
  paymentInitiated: boolean;
  paymentAmountPaid: number;
  paymentAmountExpected: number;
  paymentAmountRemaining: number;
  paymentIncomplete: boolean;
  confirmedSubscriptionCode: string | null;
  
  // Vehicle scan (optional - only if step 6 was partially completed)
  scannedVehicleId: string | null;
  
  // Battery assignment (optional - only if step 7 was partially completed)
  assignedBattery: BatteryData | null;
  registrationId: string;
  
  // Metadata
  savedAt: number; // Timestamp when saved
  version: number; // Schema version for future migrations
}

// Current schema version - increment when SalesSessionData structure changes
// Version 2: Added selectedPackageId field
// Version 3: Added scannedVehicleId field, updated steps (vehicle scan before battery)
const CURRENT_VERSION = 3;

/**
 * Check if localStorage is available
 */
function isLocalStorageAvailable(): boolean {
  try {
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Save the current sales session to localStorage
 */
export function saveSalesSession(data: Omit<SalesSessionData, 'savedAt' | 'version'>): boolean {
  if (!isLocalStorageAvailable()) {
    console.warn('localStorage not available - session will not persist');
    return false;
  }

  try {
    const sessionData: SalesSessionData = {
      ...data,
      savedAt: Date.now(),
      version: CURRENT_VERSION,
    };

    localStorage.setItem(SALES_SESSION_KEY, JSON.stringify(sessionData));
    return true;
  } catch (error) {
    console.error('Failed to save sales session:', error);
    return false;
  }
}

/**
 * Load a saved sales session from localStorage
 * Returns null if no valid session exists or if the session has expired
 */
export function loadSalesSession(): SalesSessionData | null {
  if (!isLocalStorageAvailable()) {
    return null;
  }

  try {
    const stored = localStorage.getItem(SALES_SESSION_KEY);
    
    if (!stored) {
      return null;
    }

    const sessionData: SalesSessionData = JSON.parse(stored);

    // Validate version
    if (sessionData.version !== CURRENT_VERSION) {
      clearSalesSession();
      return null;
    }

    // Check if session has expired
    const now = Date.now();
    if (now - sessionData.savedAt > SESSION_EXPIRY_MS) {
      clearSalesSession();
      return null;
    }

    // Validate that the session has meaningful progress
    // Only restore if we're past step 1 or have entered customer data
    const hasProgress = 
      sessionData.currentStep > 1 ||
      sessionData.formData.firstName.trim() !== '' ||
      sessionData.formData.lastName.trim() !== '' ||
      sessionData.formData.email.trim() !== '' ||
      sessionData.formData.phone.trim() !== '';

    if (!hasProgress) {
      clearSalesSession();
      return null;
    }

    return sessionData;
  } catch (error) {
    console.error('Failed to load sales session:', error);
    clearSalesSession();
    return null;
  }
}

/**
 * Clear the saved sales session from localStorage
 * Call this when the flow is completed or explicitly cancelled
 */
export function clearSalesSession(): void {
  if (!isLocalStorageAvailable()) {
    return;
  }

  try {
    localStorage.removeItem(SALES_SESSION_KEY);
  } catch (error) {
    console.error('Failed to clear sales session:', error);
  }
}

/**
 * Check if a saved session exists (without loading it)
 */
export function hasSavedSession(): boolean {
  if (!isLocalStorageAvailable()) {
    return false;
  }

  try {
    const stored = localStorage.getItem(SALES_SESSION_KEY);
    if (!stored) {
      return false;
    }

    const sessionData = JSON.parse(stored);
    
    // Check version and expiry
    if (sessionData.version !== CURRENT_VERSION) {
      return false;
    }

    const now = Date.now();
    if (now - sessionData.savedAt > SESSION_EXPIRY_MS) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Get the time elapsed since the session was saved (for display purposes)
 */
export function getSessionAge(): string | null {
  const session = loadSalesSession();
  if (!session) {
    return null;
  }

  const elapsed = Date.now() - session.savedAt;
  const minutes = Math.floor(elapsed / 60000);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else {
    return 'just now';
  }
}

/**
 * Get a summary of the saved session for display
 */
export function getSessionSummary(): { customerName: string; step: number; savedAt: string } | null {
  const session = loadSalesSession();
  if (!session) {
    return null;
  }

  const customerName = session.formData.firstName && session.formData.lastName
    ? `${session.formData.firstName} ${session.formData.lastName}`
    : session.formData.email || 'Unknown Customer';

  return {
    customerName,
    step: session.currentStep,
    savedAt: getSessionAge() || 'Unknown',
  };
}
