// Shared authentication utility for Attendant and Sales roles
// Uses the Odoo Employee Login API: POST /api/employee/login
// This is separate from:
// - JWT-based auth in (auth)/context for BLE Device Manager (GraphQL ERM)
// - Rider auth which uses Odoo /api/auth/login

// User types for distinguishing between different login credentials
export type UserType = 'attendant' | 'sales' | 'rider' | 'ble_device_manager';

// Storage keys - each user type has distinct storage to avoid conflicts
const STORAGE_KEYS = {
  // Employee auth (Attendant/Sales)
  EMPLOYEE_USER_EMAIL: 'oves-employee-email',
  EMPLOYEE_USER_DATA: 'oves-employee-data',
  EMPLOYEE_ACCESS_TOKEN: 'oves-employee-token',
  EMPLOYEE_TOKEN_EXPIRES: 'oves-employee-token-expires',
  EMPLOYEE_USER_TYPE: 'oves-employee-type',
  
  // Legacy keys for backwards compatibility
  USER_EMAIL: 'oves-user-email',
  USER_DATA: 'oves-user-data',
  
  // Rider uses these (defined in rider login.tsx)
  RIDER_TOKEN: 'authToken_rider',
  RIDER_EMAIL: 'userEmail',
  
  // BLE Device Manager uses these (defined in auth-context.tsx)
  BLE_ACCESS_TOKEN: 'access_token',
  BLE_REFRESH_TOKEN: 'refresh_token',
  BLE_DISTRIBUTOR_ID: 'distributorId',
  BLE_USER: 'user',
} as const;

// Employee login API configuration
const EMPLOYEE_API = {
  BASE_URL: 'https://crm-omnivoltaic.odoo.com/api',
  LOGIN_ENDPOINT: '/employee/login',
  API_KEY: 'abs_connector_secret_key_2024',
} as const;

export interface EmployeeUser {
  id: string | number;
  name: string;
  email: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  accessToken?: string;
  tokenExpiresAt?: string;
  userType: UserType;
  employeeId?: number;
  companyId?: number;
  odooUserType?: string; // e.g., "abs.employee"
}

// Legacy interface for backwards compatibility
export interface AttendantUser {
  id: string | number;
  name: string;
  email: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  accessToken?: string;
}

// API Response structure matching actual Odoo Employee Login response
export interface EmployeeLoginResponse {
  success: boolean;
  message?: string;
  session?: {
    token: string;
    expires_at: string;
    employee: {
      id: number;
      name: string;
      email: string;
      company_id: number;
      user_type: string; // e.g., "abs.employee"
    };
  };
  error?: string;
}

/**
 * Login using the Employee API (for Attendant and Sales Person)
 * Endpoint: POST https://crm-omnivoltaic.odoo.com/api/employee/login
 * 
 * Response structure:
 * {
 *   "success": true,
 *   "message": "Login successful!",
 *   "session": {
 *     "token": "eyJ...",
 *     "expires_at": "2025-12-03T13:32:54.570917",
 *     "employee": {
 *       "id": 4,
 *       "name": "Test Employee",
 *       "email": "test@example.com",
 *       "company_id": 14,
 *       "user_type": "abs.employee"
 *     }
 *   }
 * }
 */
export async function employeeLogin(
  email: string,
  password: string,
  userType: 'attendant' | 'sales'
): Promise<{ success: boolean; user?: EmployeeUser; error?: string }> {
  try {
    console.log(`[EmployeeAuth] Attempting ${userType} login for:`, email);
    console.log(`[EmployeeAuth] Endpoint: ${EMPLOYEE_API.BASE_URL}${EMPLOYEE_API.LOGIN_ENDPOINT}`);

    const response = await fetch(`${EMPLOYEE_API.BASE_URL}${EMPLOYEE_API.LOGIN_ENDPOINT}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': EMPLOYEE_API.API_KEY,
      },
      body: JSON.stringify({
        email: email.trim(),
        password: password,
      }),
    });

    const data = await response.json() as EmployeeLoginResponse;

    console.log('[EmployeeAuth] Response status:', response.status);
    console.log('[EmployeeAuth] Response data:', JSON.stringify(data, null, 2));

    if (response.ok && data.success && data.session) {
      const { token, expires_at, employee } = data.session;

      if (!employee) {
        throw new Error('No employee data in response');
      }

      const user: EmployeeUser = {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        accessToken: token,
        tokenExpiresAt: expires_at,
        userType: userType,
        employeeId: employee.id,
        companyId: employee.company_id,
        odooUserType: employee.user_type,
      };

      // Save to storage with employee-specific keys
      saveEmployeeLogin(user);

      console.log('[EmployeeAuth] Login successful:', user.name);
      console.log('[EmployeeAuth] Token expires at:', expires_at);
      return { success: true, user };
    } else {
      const errorMessage = data.error || data.message || 'Login failed. Please check your credentials.';
      console.error('[EmployeeAuth] Login failed:', errorMessage);
      return { success: false, error: errorMessage };
    }
  } catch (error: any) {
    console.error('[EmployeeAuth] Login error:', error);
    return { 
      success: false, 
      error: error.message || 'Network error. Please try again.' 
    };
  }
}

/**
 * Decode a JWT token payload without verification
 * JWT structure: header.payload.signature (base64url encoded)
 */
function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.warn('[EmployeeAuth] Invalid JWT format');
      return null;
    }
    
    // Decode the payload (second part)
    // Handle base64url encoding (replace - with + and _ with /)
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('[EmployeeAuth] Failed to decode JWT:', error);
    return null;
  }
}

/**
 * Check if a JWT token is expired by examining its exp claim
 * @param token - The JWT token string
 * @returns true if expired or invalid, false if still valid
 */
export function isJwtTokenExpired(token?: string | null): boolean {
  if (!token) return true;
  
  try {
    const payload = decodeJwtPayload(token);
    if (!payload || !payload.exp) {
      console.warn('[EmployeeAuth] JWT has no exp claim');
      return true;
    }
    
    // JWT exp is in seconds (Unix timestamp), convert to milliseconds
    const expMs = payload.exp * 1000;
    const now = Date.now();
    
    // Add a 1-minute buffer to avoid edge cases
    const bufferMs = 60 * 1000;
    const isExpired = now >= (expMs - bufferMs);
    
    if (isExpired) {
      console.log('[EmployeeAuth] Token expired. Exp:', new Date(expMs).toISOString(), 'Now:', new Date(now).toISOString());
    }
    
    return isExpired;
  } catch (error) {
    console.error('[EmployeeAuth] Error checking token expiration:', error);
    return true;
  }
}

/**
 * Get decoded information from the employee JWT token
 */
export function getEmployeeTokenInfo(): {
  companyId?: number;
  email?: string;
  exp?: number;
  iat?: number;
  sub?: number;
  type?: string;
} | null {
  const token = localStorage.getItem(STORAGE_KEYS.EMPLOYEE_ACCESS_TOKEN);
  if (!token) return null;
  
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  
  return {
    companyId: payload.company_id,
    email: payload.email,
    exp: payload.exp,
    iat: payload.iat,
    sub: payload.sub,
    type: payload.type,
  };
}

/**
 * @deprecated Use isJwtTokenExpired() instead
 * Check if the employee token is expired using stored expiration date
 * @param expiresAt - ISO date string of when the token expires
 * @returns true if expired, false if still valid
 */
export function isEmployeeTokenExpired(expiresAt?: string | null): boolean {
  // First try to check the actual JWT token
  const token = typeof window !== 'undefined' 
    ? localStorage.getItem(STORAGE_KEYS.EMPLOYEE_ACCESS_TOKEN) 
    : null;
  
  if (token) {
    return isJwtTokenExpired(token);
  }
  
  // Fallback to stored expiration date
  if (!expiresAt) return true;
  
  try {
    const expirationDate = new Date(expiresAt);
    const now = new Date();
    
    // Add a 1-minute buffer to avoid edge cases
    const bufferMs = 60 * 1000;
    return now.getTime() >= (expirationDate.getTime() - bufferMs);
  } catch {
    return true;
  }
}

/**
 * Check if an employee (Attendant/Sales) is logged in with a valid (non-expired) token
 */
export function isEmployeeLoggedIn(): boolean {
  if (typeof window === 'undefined') return false;
  
  const userData = localStorage.getItem(STORAGE_KEYS.EMPLOYEE_USER_DATA);
  if (!userData) return false;
  
  const token = localStorage.getItem(STORAGE_KEYS.EMPLOYEE_ACCESS_TOKEN);
  if (!token) return false;
  
  // Check if JWT token is expired by decoding and checking exp claim
  if (isJwtTokenExpired(token)) {
    console.log('[EmployeeAuth] JWT token expired, clearing session');
    clearEmployeeLogin();
    return false;
  }
  
  return true;
}

/**
 * Get the currently logged-in employee user (returns null if token expired)
 */
export function getEmployeeUser(): EmployeeUser | null {
  if (typeof window === 'undefined') return null;
  
  // First check if logged in (includes expiration check)
  if (!isEmployeeLoggedIn()) return null;
  
  const userData = localStorage.getItem(STORAGE_KEYS.EMPLOYEE_USER_DATA);
  if (!userData) return null;
  
  try {
    return JSON.parse(userData) as EmployeeUser;
  } catch {
    return null;
  }
}

/**
 * Get the employee access token (returns null if expired)
 */
export function getEmployeeToken(): string | null {
  if (typeof window === 'undefined') return null;
  
  const token = localStorage.getItem(STORAGE_KEYS.EMPLOYEE_ACCESS_TOKEN);
  
  // Check if JWT token is expired
  if (isJwtTokenExpired(token)) {
    console.log('[EmployeeAuth] JWT token expired when getting token');
    clearEmployeeLogin();
    return null;
  }
  
  return token;
}

/**
 * Get the token expiration time
 */
export function getEmployeeTokenExpiration(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEYS.EMPLOYEE_TOKEN_EXPIRES);
}

/**
 * Get the current user type for employee
 */
export function getEmployeeUserType(): UserType | null {
  if (typeof window === 'undefined') return null;
  
  // Check if logged in (includes expiration check)
  if (!isEmployeeLoggedIn()) return null;
  
  const userType = localStorage.getItem(STORAGE_KEYS.EMPLOYEE_USER_TYPE);
  return userType as UserType | null;
}

/**
 * Save employee user data after successful login
 */
export function saveEmployeeLogin(user: EmployeeUser): void {
  if (typeof window === 'undefined') return;
  
  localStorage.setItem(STORAGE_KEYS.EMPLOYEE_USER_EMAIL, user.email);
  localStorage.setItem(STORAGE_KEYS.EMPLOYEE_USER_DATA, JSON.stringify(user));
  localStorage.setItem(STORAGE_KEYS.EMPLOYEE_USER_TYPE, user.userType);
  
  if (user.accessToken) {
    localStorage.setItem(STORAGE_KEYS.EMPLOYEE_ACCESS_TOKEN, user.accessToken);
  }
  
  if (user.tokenExpiresAt) {
    localStorage.setItem(STORAGE_KEYS.EMPLOYEE_TOKEN_EXPIRES, user.tokenExpiresAt);
  }
  
  // Also save to legacy keys for backwards compatibility
  localStorage.setItem(STORAGE_KEYS.USER_EMAIL, user.email);
  localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
}

/**
 * Clear employee login data on logout
 */
export function clearEmployeeLogin(): void {
  if (typeof window === 'undefined') return;
  
  // Clear employee-specific keys
  localStorage.removeItem(STORAGE_KEYS.EMPLOYEE_USER_EMAIL);
  localStorage.removeItem(STORAGE_KEYS.EMPLOYEE_USER_DATA);
  localStorage.removeItem(STORAGE_KEYS.EMPLOYEE_ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.EMPLOYEE_TOKEN_EXPIRES);
  localStorage.removeItem(STORAGE_KEYS.EMPLOYEE_USER_TYPE);
  
  // Clear legacy keys
  localStorage.removeItem(STORAGE_KEYS.USER_EMAIL);
  localStorage.removeItem(STORAGE_KEYS.USER_DATA);
}

/**
 * Get stored email (for pre-filling login form)
 */
export function getStoredEmployeeEmail(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEYS.EMPLOYEE_USER_EMAIL);
}

// ============================================================================
// Legacy functions for backwards compatibility (Attendant flow)
// These map to the new employee functions but maintain the old interface
// ============================================================================

/**
 * @deprecated Use isEmployeeLoggedIn() instead
 * Check if a user is logged in
 */
export function isAttendantLoggedIn(): boolean {
  return isEmployeeLoggedIn();
}

/**
 * @deprecated Use getEmployeeUser() instead
 * Get the currently logged-in user
 */
export function getAttendantUser(): AttendantUser | null {
  const employee = getEmployeeUser();
  if (!employee) return null;
  
  // Convert to legacy format
  return {
    id: employee.id,
    name: employee.name,
    email: employee.email,
    phone: employee.phone,
    firstName: employee.firstName,
    lastName: employee.lastName,
    role: employee.role,
    accessToken: employee.accessToken,
  };
}

/**
 * @deprecated Use saveEmployeeLogin() instead
 * Save user data after successful login
 */
export function saveAttendantLogin(user: AttendantUser): void {
  if (typeof window === 'undefined') return;
  
  // Convert to new format
  const employeeUser: EmployeeUser = {
    ...user,
    userType: 'attendant', // Default to attendant for legacy calls
  };
  
  saveEmployeeLogin(employeeUser);
}

/**
 * @deprecated Use clearEmployeeLogin() instead
 * Clear login data on logout
 */
export function clearAttendantLogin(): void {
  clearEmployeeLogin();
}

/**
 * @deprecated Use getStoredEmployeeEmail() instead
 * Get stored email (for pre-filling login form)
 */
export function getStoredEmail(): string | null {
  return getStoredEmployeeEmail();
}

// ============================================================================
// Utility functions to check which type of user is logged in
// ============================================================================

/**
 * Check if a Rider is logged in (uses separate storage)
 */
export function isRiderLoggedIn(): boolean {
  if (typeof window === 'undefined') return false;
  const token = localStorage.getItem(STORAGE_KEYS.RIDER_TOKEN);
  return token !== null && token !== '';
}

/**
 * Check if a BLE Device Manager is logged in (uses GraphQL auth)
 */
export function isBleDeviceManagerLoggedIn(): boolean {
  if (typeof window === 'undefined') return false;
  const token = localStorage.getItem(STORAGE_KEYS.BLE_ACCESS_TOKEN);
  return token !== null && token !== '';
}

/**
 * Get the currently active user type across all login systems
 */
export function getActiveUserType(): UserType | null {
  if (isEmployeeLoggedIn()) {
    return getEmployeeUserType();
  }
  if (isRiderLoggedIn()) {
    return 'rider';
  }
  if (isBleDeviceManagerLoggedIn()) {
    return 'ble_device_manager';
  }
  return null;
}

/**
 * Clear all authentication data (logout from all systems)
 */
export function clearAllAuth(): void {
  if (typeof window === 'undefined') return;
  
  // Clear employee auth
  clearEmployeeLogin();
  
  // Clear rider auth
  localStorage.removeItem(STORAGE_KEYS.RIDER_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.RIDER_EMAIL);
  
  // Clear BLE Device Manager auth
  localStorage.removeItem(STORAGE_KEYS.BLE_ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.BLE_REFRESH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.BLE_DISTRIBUTOR_ID);
  localStorage.removeItem(STORAGE_KEYS.BLE_USER);
}
