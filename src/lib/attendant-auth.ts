// Shared authentication utility for Attendant and Sales roles
// Uses the Odoo Employee Login API: POST /api/employee/login
// This is separate from:
// - JWT-based auth in (auth)/context for BLE Device Manager (GraphQL ERM)
// - Rider auth which uses Odoo /api/auth/login
//
// IMPORTANT: Attendant and Sales are now treated as SEPARATE roles
// Each has its own storage keys and session management.
// Backend returns role: "salesattendant" for attendants, "salesrep" for sales reps

// User types for distinguishing between different login credentials
export type UserType = 'attendant' | 'sales' | 'rider' | 'ble_device_manager';

// Role names as returned by the backend API
export type BackendRole = 'salesattendant' | 'salesrep';

// Storage keys - each user type has distinct storage to avoid conflicts
// ATTENDANT and SALES now have SEPARATE storage keys
const STORAGE_KEYS = {
  // Attendant auth (role: salesattendant)
  ATTENDANT_USER_EMAIL: 'oves-attendant-email',
  ATTENDANT_USER_DATA: 'oves-attendant-data',
  ATTENDANT_ACCESS_TOKEN: 'oves-attendant-token',
  ATTENDANT_TOKEN_EXPIRES: 'oves-attendant-token-expires',
  
  // Sales auth (role: salesrep)
  SALES_USER_EMAIL: 'oves-sales-email',
  SALES_USER_DATA: 'oves-sales-data',
  SALES_ACCESS_TOKEN: 'oves-sales-token',
  SALES_TOKEN_EXPIRES: 'oves-sales-token-expires',
  
  // Legacy keys (deprecated - kept for backwards compatibility during migration)
  EMPLOYEE_USER_EMAIL: 'oves-employee-email',
  EMPLOYEE_USER_DATA: 'oves-employee-data',
  EMPLOYEE_ACCESS_TOKEN: 'oves-employee-token',
  EMPLOYEE_TOKEN_EXPIRES: 'oves-employee-token-expires',
  EMPLOYEE_USER_TYPE: 'oves-employee-type',
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
  role?: string; // Legacy role field
  backendRole?: BackendRole; // The actual role from backend: "salesattendant" or "salesrep"
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
      role: BackendRole; // "salesattendant" for attendants, "salesrep" for sales
      user_type: string; // e.g., "abs.employee"
    };
  };
  error?: string;
}

/**
 * Helper function to map backend role to userType
 */
function mapBackendRoleToUserType(backendRole: BackendRole): UserType {
  switch (backendRole) {
    case 'salesattendant':
      return 'attendant';
    case 'salesrep':
      return 'sales';
    default:
      console.warn(`[EmployeeAuth] Unknown backend role: ${backendRole}, defaulting to attendant`);
      return 'attendant';
  }
}

/**
 * Login using the Employee API (for Attendant and Sales Person)
 * Endpoint: POST https://crm-omnivoltaic.odoo.com/api/employee/login
 * 
 * IMPORTANT: Attendant and Sales are now SEPARATE roles with separate sessions.
 * The backend returns role: "salesattendant" for attendants, "salesrep" for sales reps.
 * Each role has its own storage keys and must log in separately.
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
 *       "role": "salesattendant", // or "salesrep"
 *       "user_type": "abs.employee"
 *     }
 *   }
 * }
 */
export async function employeeLogin(
  email: string,
  password: string,
  expectedUserType: 'attendant' | 'sales'
): Promise<{ success: boolean; user?: EmployeeUser; error?: string; wrongRole?: boolean }> {
  try {
    console.log(`[EmployeeAuth] Attempting ${expectedUserType} login for:`, email);
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

      // Get the role from the backend response
      const backendRole = employee.role;
      const actualUserType = mapBackendRoleToUserType(backendRole);
      
      console.log(`[EmployeeAuth] Backend role: ${backendRole}, mapped to userType: ${actualUserType}`);
      console.log(`[EmployeeAuth] Expected userType: ${expectedUserType}`);
      
      // Check if the user's role matches the expected role for this login flow
      if (actualUserType !== expectedUserType) {
        const roleLabel = actualUserType === 'attendant' ? 'Attendant' : 'Sales Rep';
        const expectedLabel = expectedUserType === 'attendant' ? 'Attendant' : 'Sales Rep';
        console.error(`[EmployeeAuth] Role mismatch: User is ${roleLabel} but tried to log in as ${expectedLabel}`);
        return { 
          success: false, 
          error: `This account is registered as ${roleLabel}. Please use the ${roleLabel} login.`,
          wrongRole: true
        };
      }

      const user: EmployeeUser = {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        accessToken: token,
        tokenExpiresAt: expires_at,
        userType: actualUserType,
        backendRole: backendRole,
        employeeId: employee.id,
        companyId: employee.company_id,
        odooUserType: employee.user_type,
      };

      // Save to role-specific storage keys
      saveRoleLogin(user);

      console.log('[EmployeeAuth] Login successful:', user.name);
      console.log('[EmployeeAuth] Role:', backendRole, '-> userType:', actualUserType);
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
 * @param userType - Optional: specify 'attendant' or 'sales' to get role-specific token info
 */
export function getEmployeeTokenInfo(userType?: 'attendant' | 'sales'): {
  companyId?: number;
  email?: string;
  exp?: number;
  iat?: number;
  sub?: number;
  type?: string;
  role?: string;
} | null {
  let token: string | null = null;
  
  if (userType === 'attendant') {
    token = localStorage.getItem(STORAGE_KEYS.ATTENDANT_ACCESS_TOKEN);
  } else if (userType === 'sales') {
    token = localStorage.getItem(STORAGE_KEYS.SALES_ACCESS_TOKEN);
  } else {
    // Legacy: check both, prefer attendant
    token = localStorage.getItem(STORAGE_KEYS.ATTENDANT_ACCESS_TOKEN) 
         || localStorage.getItem(STORAGE_KEYS.SALES_ACCESS_TOKEN)
         || localStorage.getItem(STORAGE_KEYS.EMPLOYEE_ACCESS_TOKEN);
  }
  
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
    role: payload.role,
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

// ============================================================================
// Role-Specific Authentication Functions
// Attendant and Sales are now SEPARATE roles with separate sessions
// ============================================================================

/**
 * Check if an Attendant (salesattendant) is logged in with a valid token
 */
export function isAttendantRoleLoggedIn(): boolean {
  if (typeof window === 'undefined') return false;
  
  const userData = localStorage.getItem(STORAGE_KEYS.ATTENDANT_USER_DATA);
  if (!userData) return false;
  
  const token = localStorage.getItem(STORAGE_KEYS.ATTENDANT_ACCESS_TOKEN);
  if (!token) return false;
  
  // Check if JWT token is expired by decoding and checking exp claim
  if (isJwtTokenExpired(token)) {
    console.log('[EmployeeAuth] Attendant JWT token expired, clearing session');
    clearAttendantRoleLogin();
    return false;
  }
  
  return true;
}

/**
 * Check if a Sales Rep (salesrep) is logged in with a valid token
 */
export function isSalesRoleLoggedIn(): boolean {
  if (typeof window === 'undefined') return false;
  
  const userData = localStorage.getItem(STORAGE_KEYS.SALES_USER_DATA);
  if (!userData) return false;
  
  const token = localStorage.getItem(STORAGE_KEYS.SALES_ACCESS_TOKEN);
  if (!token) return false;
  
  // Check if JWT token is expired by decoding and checking exp claim
  if (isJwtTokenExpired(token)) {
    console.log('[EmployeeAuth] Sales JWT token expired, clearing session');
    clearSalesRoleLogin();
    return false;
  }
  
  return true;
}

/**
 * @deprecated Use isAttendantRoleLoggedIn() or isSalesRoleLoggedIn() instead
 * Check if an employee (Attendant/Sales) is logged in with a valid (non-expired) token
 * This is kept for backwards compatibility but will check both roles
 */
export function isEmployeeLoggedIn(): boolean {
  return isAttendantRoleLoggedIn() || isSalesRoleLoggedIn();
}

/**
 * Get the logged-in Attendant user (returns null if not logged in or token expired)
 */
export function getAttendantRoleUser(): EmployeeUser | null {
  if (typeof window === 'undefined') return null;
  
  if (!isAttendantRoleLoggedIn()) return null;
  
  const userData = localStorage.getItem(STORAGE_KEYS.ATTENDANT_USER_DATA);
  if (!userData) return null;
  
  try {
    return JSON.parse(userData) as EmployeeUser;
  } catch {
    return null;
  }
}

/**
 * Get the logged-in Sales Rep user (returns null if not logged in or token expired)
 */
export function getSalesRoleUser(): EmployeeUser | null {
  if (typeof window === 'undefined') return null;
  
  if (!isSalesRoleLoggedIn()) return null;
  
  const userData = localStorage.getItem(STORAGE_KEYS.SALES_USER_DATA);
  if (!userData) return null;
  
  try {
    return JSON.parse(userData) as EmployeeUser;
  } catch {
    return null;
  }
}

/**
 * @deprecated Use getAttendantRoleUser() or getSalesRoleUser() instead
 * Get the currently logged-in employee user (returns null if token expired)
 * This checks both roles and returns whichever is logged in
 */
export function getEmployeeUser(): EmployeeUser | null {
  if (typeof window === 'undefined') return null;
  
  // Check attendant first, then sales
  const attendantUser = getAttendantRoleUser();
  if (attendantUser) return attendantUser;
  
  const salesUser = getSalesRoleUser();
  if (salesUser) return salesUser;
  
  return null;
}

/**
 * Get the Attendant access token (returns null if not logged in or expired)
 */
export function getAttendantRoleToken(): string | null {
  if (typeof window === 'undefined') return null;
  
  const token = localStorage.getItem(STORAGE_KEYS.ATTENDANT_ACCESS_TOKEN);
  
  if (isJwtTokenExpired(token)) {
    console.log('[EmployeeAuth] Attendant JWT token expired when getting token');
    clearAttendantRoleLogin();
    return null;
  }
  
  return token;
}

/**
 * Get the Sales Rep access token (returns null if not logged in or expired)
 */
export function getSalesRoleToken(): string | null {
  if (typeof window === 'undefined') return null;
  
  const token = localStorage.getItem(STORAGE_KEYS.SALES_ACCESS_TOKEN);
  
  if (isJwtTokenExpired(token)) {
    console.log('[EmployeeAuth] Sales JWT token expired when getting token');
    clearSalesRoleLogin();
    return null;
  }
  
  return token;
}

/**
 * @deprecated Use getAttendantRoleToken() or getSalesRoleToken() instead
 * Get the employee access token (returns null if expired)
 */
export function getEmployeeToken(): string | null {
  if (typeof window === 'undefined') return null;
  
  // Try attendant first, then sales, then legacy
  const attendantToken = getAttendantRoleToken();
  if (attendantToken) return attendantToken;
  
  const salesToken = getSalesRoleToken();
  if (salesToken) return salesToken;
  
  // Legacy fallback
  const legacyToken = localStorage.getItem(STORAGE_KEYS.EMPLOYEE_ACCESS_TOKEN);
  if (legacyToken && !isJwtTokenExpired(legacyToken)) {
    return legacyToken;
  }
  
  return null;
}

/**
 * Get the token expiration time for a specific role
 */
export function getEmployeeTokenExpiration(userType?: 'attendant' | 'sales'): string | null {
  if (typeof window === 'undefined') return null;
  
  if (userType === 'attendant') {
    return localStorage.getItem(STORAGE_KEYS.ATTENDANT_TOKEN_EXPIRES);
  } else if (userType === 'sales') {
    return localStorage.getItem(STORAGE_KEYS.SALES_TOKEN_EXPIRES);
  }
  
  // Legacy: return whichever exists
  return localStorage.getItem(STORAGE_KEYS.ATTENDANT_TOKEN_EXPIRES)
      || localStorage.getItem(STORAGE_KEYS.SALES_TOKEN_EXPIRES)
      || localStorage.getItem(STORAGE_KEYS.EMPLOYEE_TOKEN_EXPIRES);
}

/**
 * @deprecated Roles are now separate, use isAttendantRoleLoggedIn() or isSalesRoleLoggedIn()
 * Get the current user type for employee
 */
export function getEmployeeUserType(): UserType | null {
  if (typeof window === 'undefined') return null;
  
  if (isAttendantRoleLoggedIn()) return 'attendant';
  if (isSalesRoleLoggedIn()) return 'sales';
  
  // Legacy fallback
  const userType = localStorage.getItem(STORAGE_KEYS.EMPLOYEE_USER_TYPE);
  return userType as UserType | null;
}

/**
 * Save user data to role-specific storage after successful login
 * This is the primary function to use for new logins
 */
export function saveRoleLogin(user: EmployeeUser): void {
  if (typeof window === 'undefined') return;
  
  if (user.userType === 'attendant') {
    localStorage.setItem(STORAGE_KEYS.ATTENDANT_USER_EMAIL, user.email);
    localStorage.setItem(STORAGE_KEYS.ATTENDANT_USER_DATA, JSON.stringify(user));
    
    if (user.accessToken) {
      localStorage.setItem(STORAGE_KEYS.ATTENDANT_ACCESS_TOKEN, user.accessToken);
    }
    
    if (user.tokenExpiresAt) {
      localStorage.setItem(STORAGE_KEYS.ATTENDANT_TOKEN_EXPIRES, user.tokenExpiresAt);
    }
    
    console.log('[EmployeeAuth] Saved Attendant login to role-specific storage');
  } else if (user.userType === 'sales') {
    localStorage.setItem(STORAGE_KEYS.SALES_USER_EMAIL, user.email);
    localStorage.setItem(STORAGE_KEYS.SALES_USER_DATA, JSON.stringify(user));
    
    if (user.accessToken) {
      localStorage.setItem(STORAGE_KEYS.SALES_ACCESS_TOKEN, user.accessToken);
    }
    
    if (user.tokenExpiresAt) {
      localStorage.setItem(STORAGE_KEYS.SALES_TOKEN_EXPIRES, user.tokenExpiresAt);
    }
    
    console.log('[EmployeeAuth] Saved Sales login to role-specific storage');
  }
}

/**
 * Clear Attendant login data on logout
 */
export function clearAttendantRoleLogin(): void {
  if (typeof window === 'undefined') return;
  
  localStorage.removeItem(STORAGE_KEYS.ATTENDANT_USER_EMAIL);
  localStorage.removeItem(STORAGE_KEYS.ATTENDANT_USER_DATA);
  localStorage.removeItem(STORAGE_KEYS.ATTENDANT_ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.ATTENDANT_TOKEN_EXPIRES);
  
  console.log('[EmployeeAuth] Cleared Attendant login');
}

/**
 * Clear Sales Rep login data on logout
 */
export function clearSalesRoleLogin(): void {
  if (typeof window === 'undefined') return;
  
  localStorage.removeItem(STORAGE_KEYS.SALES_USER_EMAIL);
  localStorage.removeItem(STORAGE_KEYS.SALES_USER_DATA);
  localStorage.removeItem(STORAGE_KEYS.SALES_ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.SALES_TOKEN_EXPIRES);
  
  console.log('[EmployeeAuth] Cleared Sales login');
}

/**
 * @deprecated Use saveRoleLogin() instead
 * Save employee user data after successful login
 */
export function saveEmployeeLogin(user: EmployeeUser): void {
  if (typeof window === 'undefined') return;
  
  // Use role-specific storage
  saveRoleLogin(user);
  
  // Also save to legacy keys for backwards compatibility
  localStorage.setItem(STORAGE_KEYS.EMPLOYEE_USER_EMAIL, user.email);
  localStorage.setItem(STORAGE_KEYS.EMPLOYEE_USER_DATA, JSON.stringify(user));
  localStorage.setItem(STORAGE_KEYS.EMPLOYEE_USER_TYPE, user.userType);
  
  if (user.accessToken) {
    localStorage.setItem(STORAGE_KEYS.EMPLOYEE_ACCESS_TOKEN, user.accessToken);
  }
  
  if (user.tokenExpiresAt) {
    localStorage.setItem(STORAGE_KEYS.EMPLOYEE_TOKEN_EXPIRES, user.tokenExpiresAt);
  }
  
  localStorage.setItem(STORAGE_KEYS.USER_EMAIL, user.email);
  localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
}

/**
 * @deprecated Use clearAttendantRoleLogin() or clearSalesRoleLogin() instead
 * Clear employee login data on logout
 */
export function clearEmployeeLogin(): void {
  if (typeof window === 'undefined') return;
  
  // Clear role-specific keys
  clearAttendantRoleLogin();
  clearSalesRoleLogin();
  
  // Clear legacy keys
  localStorage.removeItem(STORAGE_KEYS.EMPLOYEE_USER_EMAIL);
  localStorage.removeItem(STORAGE_KEYS.EMPLOYEE_USER_DATA);
  localStorage.removeItem(STORAGE_KEYS.EMPLOYEE_ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.EMPLOYEE_TOKEN_EXPIRES);
  localStorage.removeItem(STORAGE_KEYS.EMPLOYEE_USER_TYPE);
  localStorage.removeItem(STORAGE_KEYS.USER_EMAIL);
  localStorage.removeItem(STORAGE_KEYS.USER_DATA);
}

/**
 * Get stored email for a specific role (for pre-filling login form)
 */
export function getStoredRoleEmail(userType: 'attendant' | 'sales'): string | null {
  if (typeof window === 'undefined') return null;
  
  if (userType === 'attendant') {
    return localStorage.getItem(STORAGE_KEYS.ATTENDANT_USER_EMAIL);
  } else if (userType === 'sales') {
    return localStorage.getItem(STORAGE_KEYS.SALES_USER_EMAIL);
  }
  
  return null;
}

/**
 * @deprecated Use getStoredRoleEmail() instead
 * Get stored email (for pre-filling login form)
 */
export function getStoredEmployeeEmail(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEYS.ATTENDANT_USER_EMAIL)
      || localStorage.getItem(STORAGE_KEYS.SALES_USER_EMAIL)
      || localStorage.getItem(STORAGE_KEYS.EMPLOYEE_USER_EMAIL);
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
 * Note: Both attendant and sales can be logged in simultaneously now
 */
export function getActiveUserType(): UserType | null {
  // Check role-specific logins first
  if (isAttendantRoleLoggedIn()) {
    return 'attendant';
  }
  if (isSalesRoleLoggedIn()) {
    return 'sales';
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
 * Get all currently active user types (since attendant and sales can be logged in simultaneously)
 */
export function getActiveUserTypes(): UserType[] {
  const types: UserType[] = [];
  
  if (isAttendantRoleLoggedIn()) types.push('attendant');
  if (isSalesRoleLoggedIn()) types.push('sales');
  if (isRiderLoggedIn()) types.push('rider');
  if (isBleDeviceManagerLoggedIn()) types.push('ble_device_manager');
  
  return types;
}

/**
 * Clear all authentication data (logout from all systems)
 */
export function clearAllAuth(): void {
  if (typeof window === 'undefined') return;
  
  // Clear role-specific auth
  clearAttendantRoleLogin();
  clearSalesRoleLogin();
  
  // Clear legacy employee auth
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
