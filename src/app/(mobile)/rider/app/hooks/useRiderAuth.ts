"use client";

import { useCallback, useEffect, useState } from 'react';
import type { RiderCustomer } from '../types';

/**
 * Manages Rider authentication state using the legacy `authToken_rider` /
 * `customerData_rider` keys (so existing sessions keep working).
 *
 * Exposes:
 * - `customer`, `token`, `isLoggedIn`
 * - `isChecking` — true while we're reading localStorage on mount
 * - `hasStoredCustomer` — a saved customer but user hasn't pressed Continue yet
 * - `loginWithCustomer`, `confirmStoredCustomer`, `clearStoredCustomer`, `logout`
 */
export function useRiderAuth() {
  const [customer, setCustomer] = useState<RiderCustomer | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [hasStoredCustomer, setHasStoredCustomer] = useState(false);

  useEffect(() => {
    try {
      const t = localStorage.getItem('authToken_rider');
      const raw = localStorage.getItem('customerData_rider');
      if (t && raw) {
        const parsed = JSON.parse(raw) as RiderCustomer;
        setCustomer(parsed);
        setToken(t);
        setHasStoredCustomer(true);
      }
    } catch (err) {
      console.warn('[useRiderAuth] Failed to read stored credentials:', err);
    } finally {
      setIsChecking(false);
    }
  }, []);

  /** Called by the Login form once Odoo signs the user in. */
  const loginWithCustomer = useCallback((c: RiderCustomer) => {
    setCustomer(c);
    setToken(localStorage.getItem('authToken_rider'));
    setIsLoggedIn(true);
    setHasStoredCustomer(false);
  }, []);

  /** Called from the "found customer" screen when the user presses Continue. */
  const confirmStoredCustomer = useCallback(() => {
    setIsLoggedIn(true);
    setHasStoredCustomer(false);
  }, []);

  /** Wipes the stored customer/token and returns to the login form. */
  const clearStoredCustomer = useCallback(() => {
    localStorage.removeItem('authToken_rider');
    localStorage.removeItem('customerData_rider');
    localStorage.removeItem('userPhone');
    setCustomer(null);
    setToken(null);
    setHasStoredCustomer(false);
  }, []);

  const logout = useCallback(() => {
    clearStoredCustomer();
    setIsLoggedIn(false);
  }, [clearStoredCustomer]);

  return {
    customer,
    token,
    isLoggedIn,
    isChecking,
    hasStoredCustomer,
    loginWithCustomer,
    confirmStoredCustomer,
    clearStoredCustomer,
    logout,
  };
}
