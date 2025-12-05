# Library (`/src/lib`)

Core utilities, hooks, types, and constants for the application.

## Structure

```
/lib
├── constants.ts      # App configuration, feature flags, validation rules
├── utils.ts          # Generic utility functions
├── hooks.ts          # Custom React hooks
├── types.ts          # Domain/business types
├── index.ts          # Central exports
├── odoo-api.ts       # Odoo API service
├── apollo-client.ts  # GraphQL client
├── attendant-auth.ts # Attendant authentication
├── sales-session.ts  # Sales session management
└── auth.tsx          # Auth provider
```

## Quick Import

```tsx
import { 
  // Constants
  APP_CONFIG, FEATURES, VALIDATION, UI, STATUS,
  
  // Utilities
  formatCurrency, formatDate, getInitials, isValidEmail,
  
  // Hooks
  useDebounce, useLocalStorage, useOnline, useForm,
  
  // Types
  Customer, Battery, Transaction,
} from '@/lib';
```

---

## Constants (`constants.ts`)

### App Configuration

```tsx
import { APP_CONFIG } from '@/lib';

// API settings
APP_CONFIG.api.timeout    // 30000ms
APP_CONFIG.api.retryAttempts  // 3

// Storage keys
APP_CONFIG.storage.tokenKey  // 'oves_auth_token'
```

### Feature Flags

```tsx
import { FEATURES } from '@/lib';

if (FEATURES.enableBleScanner) {
  // Show BLE scanning UI
}

if (FEATURES.showDebugInfo) {
  // Show debug panel
}
```

### Validation Rules

```tsx
import { VALIDATION } from '@/lib';

VALIDATION.email.pattern.test(email)  // Validate email
VALIDATION.phone.pattern.test(phone)  // Validate phone
VALIDATION.batteryId.pattern.test(id) // Validate battery ID
```

### UI Constants

```tsx
import { UI } from '@/lib';

UI.debounce.search  // 300ms
UI.toast.success    // 3000ms
UI.animation.fast   // 150ms
```

### Status Enums

```tsx
import { STATUS } from '@/lib';

STATUS.service.BATTERY_ISSUED
STATUS.payment.CURRENT
STATUS.transaction.COMPLETED
```

---

## Utilities (`utils.ts`)

### String Utilities

```tsx
import { capitalize, titleCase, getInitials, truncate, slugify } from '@/lib';

capitalize('hello')           // 'Hello'
titleCase('john doe')         // 'John Doe'
getInitials('John Doe')       // 'JD'
getInitials('John', 'Doe')    // 'JD'
truncate('Long text...', 10)  // 'Long te...'
slugify('Hello World!')       // 'hello-world'
```

### Number Utilities

```tsx
import { formatCurrency, formatNumber, formatPercent, formatEnergy, clamp, round } from '@/lib';

formatCurrency(1000, 'KES')   // 'KES 1,000'
formatNumber(1234.56, 2)      // '1,234.56'
formatPercent(75.5)           // '76%'
formatEnergy(1500)            // '1.5 MWh'
clamp(150, 0, 100)            // 100
round(3.14159, 2)             // 3.14
```

### Date Utilities

```tsx
import { formatDate, formatTime, formatDateTime, formatRelativeTime, isToday } from '@/lib';

formatDate(new Date())              // 'Dec 5, 2024'
formatTime(new Date())              // '10:30 AM'
formatDateTime(new Date())          // 'Dec 5, 2024 10:30 AM'
formatRelativeTime(Date.now() - 3600000)  // '1h ago'
isToday(new Date())                 // true
```

### Phone Utilities

```tsx
import { formatPhone, normalizePhone } from '@/lib';

formatPhone('0712345678')           // '0712 345 678'
normalizePhone('0712345678', '254') // '+254712345678'
```

### Validation Utilities

```tsx
import { isValidEmail, isValidPhone, isValidBatteryId, isValidMacAddress } from '@/lib';

isValidEmail('test@example.com')  // true
isValidPhone('+254712345678')     // true
isValidBatteryId('BAT123456')     // true
isValidMacAddress('AA:BB:CC:DD:EE:FF')  // true
```

### Async Utilities

```tsx
import { sleep, retry, debounce, throttle } from '@/lib';

await sleep(1000);  // Wait 1 second

// Retry with exponential backoff
const data = await retry(fetchData, { attempts: 3, delay: 1000 });

// Debounced function
const debouncedSearch = debounce(search, 300);

// Throttled function
const throttledScroll = throttle(handleScroll, 100);
```

### Storage Utilities

```tsx
import { getStorageItem, setStorageItem, removeStorageItem } from '@/lib';

const user = getStorageItem('user', null);
setStorageItem('user', { id: 1, name: 'John' });
removeStorageItem('user');
```

---

## Hooks (`hooks.ts`)

### State Hooks

```tsx
import { useLocalStorage, useSessionStorage, useToggle } from '@/lib';

// Persist in localStorage
const [theme, setTheme] = useLocalStorage('theme', 'dark');

// Persist in sessionStorage
const [formData, setFormData] = useSessionStorage('form', {});

// Toggle boolean
const [isOpen, toggle, setOpen] = useToggle(false);
```

### Timing Hooks

```tsx
import { useDebounce, useDebouncedCallback, useThrottledCallback, useInterval, useTimeout } from '@/lib';

// Debounce a value
const debouncedSearch = useDebounce(searchTerm, 300);

// Debounced callback
const handleSearch = useDebouncedCallback((term) => {
  // Search logic
}, 300);

// Run at interval
useInterval(() => {
  refreshData();
}, 5000);  // Every 5 seconds

// Run after delay
useTimeout(() => {
  hideMessage();
}, 3000);  // After 3 seconds
```

### Lifecycle Hooks

```tsx
import { useMounted, useUnmount, usePrevious, useUpdateEffect } from '@/lib';

// Check if mounted
const mounted = useMounted();

// Cleanup on unmount
useUnmount(() => {
  cleanup();
});

// Get previous value
const prevCount = usePrevious(count);

// Skip first render
useUpdateEffect(() => {
  // Only runs on updates, not initial mount
}, [dependency]);
```

### DOM Hooks

```tsx
import { useWindowSize, useMediaQuery, useOnline, useClickOutside, useKeyPress } from '@/lib';

// Window dimensions
const { width, height } = useWindowSize();

// Media queries
const isMobile = useMediaQuery('(max-width: 768px)');

// Online status
const isOnline = useOnline();

// Click outside detection
const ref = useRef(null);
useClickOutside(ref, () => closeModal());

// Key press
useKeyPress('Escape', () => closeModal());
```

### Form Hook

```tsx
import { useForm } from '@/lib';

const {
  values,
  errors,
  touched,
  isSubmitting,
  handleChange,
  handleBlur,
  handleSubmit,
  reset,
} = useForm({
  initialValues: { email: '', password: '' },
  validate: (values) => {
    const errors = {};
    if (!values.email) errors.email = 'Required';
    return errors;
  },
  onSubmit: async (values) => {
    await login(values);
  },
});
```

---

## Types (`types.ts`)

### Domain Types

```tsx
import type { Customer, Battery, Transaction, Station } from '@/lib';

const customer: Customer = {
  id: 1,
  name: 'John Doe',
  email: 'john@example.com',
  phone: '+254712345678',
  serviceState: 'BATTERY_ISSUED',
  paymentState: 'CURRENT',
};
```

### Enums/States

```tsx
import type { ServiceState, PaymentState, TransactionStatus, BatteryStatus } from '@/lib';

const status: ServiceState = 'BATTERY_ISSUED';
const payment: PaymentState = 'CURRENT';
```

### UI Types

```tsx
import type { SelectOption, TabItem, MenuItem, Notification } from '@/lib';

const options: SelectOption[] = [
  { value: 'a', label: 'Option A' },
  { value: 'b', label: 'Option B', disabled: true },
];
```

### Utility Types

```tsx
import type { PartialExcept, RequiredFields, Nullable, ArrayElement } from '@/lib';

// Make all optional except 'id'
type PartialUser = PartialExcept<User, 'id'>;

// Make 'email' required
type UserWithEmail = RequiredFields<User, 'email'>;

// Get array element type
type Item = ArrayElement<typeof items>;
```

---

## Best Practices

1. **Use constants** instead of magic values
2. **Use utility functions** for formatting and validation
3. **Use hooks** for common patterns (debounce, storage, etc.)
4. **Use types** for domain objects
5. **Import from `@/lib`** for clean imports
