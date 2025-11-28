// Shared authentication utility for Attendant and Sales roles
// This is separate from the JWT-based auth in (auth)/context

const STORAGE_KEYS = {
  USER_EMAIL: 'oves-user-email',
  USER_DATA: 'oves-user-data',
} as const;

export interface AttendantUser {
  id: number;
  name: string;
  email: string;
  phone?: string;
}

/**
 * Check if a user is logged in
 */
export function isAttendantLoggedIn(): boolean {
  if (typeof window === 'undefined') return false;
  const userData = localStorage.getItem(STORAGE_KEYS.USER_DATA);
  return userData !== null;
}

/**
 * Get the currently logged-in user
 */
export function getAttendantUser(): AttendantUser | null {
  if (typeof window === 'undefined') return null;
  const userData = localStorage.getItem(STORAGE_KEYS.USER_DATA);
  if (!userData) return null;
  
  try {
    return JSON.parse(userData) as AttendantUser;
  } catch {
    return null;
  }
}

/**
 * Save user data after successful login
 */
export function saveAttendantLogin(user: AttendantUser): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.USER_EMAIL, user.email);
  localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
}

/**
 * Clear login data on logout
 */
export function clearAttendantLogin(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEYS.USER_EMAIL);
  localStorage.removeItem(STORAGE_KEYS.USER_DATA);
}

/**
 * Get stored email (for pre-filling login form)
 */
export function getStoredEmail(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEYS.USER_EMAIL);
}



