// Remembered Device Manager login credentials.
//
// The DM login form pre-fills these on the next visit so a returning user does
// not have to retype their email & password every time. Stored under
// DM-scoped localStorage keys, separate from the auth tokens and from the
// main-app login. They intentionally survive logout (clearAllAuth in
// attendant-auth.ts only removes the *-token keys, not these) so the login
// screen still comes back pre-filled.
//
// NOTE: the password is kept in plain text in localStorage. That is acceptable
// in this WebView app — the access/refresh tokens already live in localStorage
// on the same origin — and it matches the product ask to remember the
// password, not just the email. The functions take an optional Storage so the
// behaviour can be unit-tested without a browser.

export const BLE_DM_REMEMBER_EMAIL_KEY = 'ble-dm-remember-email';
export const BLE_DM_REMEMBER_PASSWORD_KEY = 'ble-dm-remember-password';

export interface RememberedCredentials {
  email: string;
  password: string;
}

// The subset of the Web Storage API we actually use — lets tests pass a fake.
type CredentialStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

// `undefined` → fall back to window.localStorage (browser). `null` → no storage
// (SSR / storage disabled). Anything else → use the provided store (tests).
function resolveStore(store?: CredentialStore | null): CredentialStore | null {
  if (store !== undefined) return store;
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readRememberedCredentials(
  store?: CredentialStore | null,
): RememberedCredentials {
  const s = resolveStore(store);
  if (!s) return { email: '', password: '' };
  try {
    return {
      email: s.getItem(BLE_DM_REMEMBER_EMAIL_KEY) ?? '',
      password: s.getItem(BLE_DM_REMEMBER_PASSWORD_KEY) ?? '',
    };
  } catch {
    return { email: '', password: '' };
  }
}

export function saveRememberedCredentials(
  email: string,
  password: string,
  store?: CredentialStore | null,
): void {
  const s = resolveStore(store);
  if (!s) return;
  try {
    s.setItem(BLE_DM_REMEMBER_EMAIL_KEY, email);
    s.setItem(BLE_DM_REMEMBER_PASSWORD_KEY, password);
  } catch {
    /* storage unavailable / quota exceeded — non-fatal, login still proceeds */
  }
}

export function clearRememberedCredentials(store?: CredentialStore | null): void {
  const s = resolveStore(store);
  if (!s) return;
  try {
    s.removeItem(BLE_DM_REMEMBER_EMAIL_KEY);
    s.removeItem(BLE_DM_REMEMBER_PASSWORD_KEY);
  } catch {
    /* ignore */
  }
}
