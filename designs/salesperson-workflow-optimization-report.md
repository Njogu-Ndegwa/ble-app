# SalesPerson Workflow Refactoring Report

## Executive Summary

The `SalesFlow.tsx` file is **2,129 lines** - the largest file in the Sales workflow by a significant margin. This report identifies key sections that can be extracted into reusable hooks and components, ranked by potential impact on file size reduction and code maintainability.

---

## Current File Structure

| File | Lines | Purpose |
|------|-------|---------|
| **SalesFlow.tsx** | 2,129 | Main orchestration flow ⚠️ |
| CustomerAcquisitionForm.tsx | 523 | Standalone form (unused?) |
| Step4AssignBattery.tsx | 280 | Battery assignment step |
| Step2SelectProduct.tsx | 232 | Product selection (deprecated) |
| Step4Preview.tsx | 218 | Order preview |
| Step1CustomerForm.tsx | 189 | Customer form |
| Step2SelectPackage.tsx | 162 | Package selection |
| Step2SelectPlan.tsx | 157 | Plan selection |
| SalesTimeline.tsx | 122 | Timeline component |
| SalesActionBar.tsx | 107 | Action bar |
| page.tsx | 105 | Entry page |
| Step3Payment.tsx | 79 | Payment collection |
| Step5Success.tsx | 74 | Success receipt |

---

## 🎯 Refactoring Opportunities (Ranked by Impact)

### 1. **Service Completion Logic** → `useServiceCompletion` Hook
**Lines: ~330 (lines 1337-1670)**  
**Impact: HIGH** 🔴

The `handleCompleteService` function and its MQTT request/response handling is the largest single function. It handles:
- MQTT subscription and message routing
- Service completion payload construction
- Response parsing with signal-based success/error detection
- Timeout management
- Error handling with specific error messages

**Extraction:**
```typescript
// New hook: /src/lib/hooks/useServiceCompletion.ts
const {
  completeService,
  isCompleting,
  error,
  resetError,
} = useServiceCompletion({
  onSuccess: (battery) => { ... },
  onError: (message) => { ... },
});
```

**Benefits:**
- Reusable for any service completion flow
- Testable in isolation
- Reduces SalesFlow.tsx by ~330 lines (15% reduction)

---

### 2. **Payment Processing Logic** → `useSalesPayment` Hook
**Lines: ~175 (lines 1081-1268)**  
**Impact: HIGH** 🔴

Payment logic includes:
- `initiateOdooPayment` - STK push to customer phone
- `handlePaymentQrScan` - Payment QR scanning
- `handleManualPayment` - Manual payment confirmation
- Payment amount tracking (paid, expected, remaining)
- Incomplete payment state handling

**Extraction:**
```typescript
// New hook: /src/lib/hooks/useSalesPayment.ts
const {
  initiatePayment,
  confirmPayment,
  scanPaymentQr,
  paymentState: { amountPaid, amountExpected, amountRemaining, isIncomplete },
  isProcessing,
} = useSalesPayment({ subscriptionData, orderInfo });
```

**Benefits:**
- Cleanly separates payment concerns from flow orchestration
- Could be shared with other payment flows
- Reduces SalesFlow.tsx by ~175 lines (8% reduction)

---

### 3. **Product/Package/Plan Fetching** → `useProductCatalog` Hook  
**Lines: ~200 (lines 648-843)**  
**Impact: MEDIUM-HIGH** 🟠

The `fetchProductsAndPlans` function handles:
- Loading products, packages, and subscription plans from Odoo
- Parsing and transforming API responses
- Error state management
- Default selection logic

**Extraction:**
```typescript
// New hook: /src/lib/hooks/useProductCatalog.ts
const {
  products, packages, plans,
  isLoading: { products, packages, plans },
  errors: { products, packages, plans },
  refetch,
  selectedProduct, setSelectedProduct,
  selectedPackage, setSelectedPackage,
  selectedPlan, setSelectedPlan,
} = useProductCatalog({ employeeToken });
```

**Benefits:**
- Self-contained data fetching with built-in caching potential
- Reduces SalesFlow.tsx by ~200 lines (9% reduction)
- Could be reused in product display views

---

### 4. **Session Persistence Logic** → `useSalesSessionPersistence` Hook
**Lines: ~120 (lines 270-385)**  
**Impact: MEDIUM** 🟡

Session management includes:
- `restoreSession` - Load saved session
- `discardSession` - Start fresh
- Auto-save effect with debouncing
- Resume prompt state

**Extraction:**
```typescript
// New hook: /src/lib/hooks/useSalesSessionPersistence.ts
const {
  savedSessionSummary,
  showResumePrompt,
  restoreSession,
  discardSession,
  markSessionRestored,
} = useSalesSessionPersistence({
  currentState: { currentStep, formData, ... },
  onRestore: (data) => { /* restore state */ },
});
```

**Benefits:**
- Clean separation of session logic
- Reusable pattern for other workflows (Attendant?)
- Reduces SalesFlow.tsx by ~120 lines (6% reduction)

---

### 5. **Subscription Purchase Logic** → `useSubscriptionPurchase` Hook
**Lines: ~110 (lines 966-1076)**  
**Impact: MEDIUM** 🟡

The `purchaseCustomerSubscription` function handles:
- Multi-product order creation
- Subscription cycle configuration
- Order ID extraction for payment

**Extraction:**
```typescript
// New hook: /src/lib/hooks/useSubscriptionPurchase.ts
const {
  purchaseSubscription,
  subscriptionData,
  orderId,
  isPurchasing,
  error,
} = useSubscriptionPurchase({
  customerId: createdPartnerId,
  selectedPackage,
  selectedPlan,
});
```

**Benefits:**
- Isolates complex purchase logic
- Reduces SalesFlow.tsx by ~110 lines (5% reduction)

---

### 6. **Customer Registration Logic** → `useCustomerRegistration` Hook
**Lines: ~75 (lines 889-962)**  
**Impact: MEDIUM** 🟡

The `createCustomerInOdoo` function handles:
- Form data preparation for Odoo
- Phone number formatting
- Customer creation API call
- Storing customer/partner IDs

**Extraction:**
```typescript
// New hook: /src/lib/hooks/useCustomerRegistration.ts
const {
  registerCustomer,
  customerId,
  partnerId,
  customerToken,
  isRegistering,
  error,
} = useCustomerRegistration();
```

**Benefits:**
- Reusable for other registration contexts
- Reduces SalesFlow.tsx by ~75 lines (4% reduction)

---

### 7. **Bridge Initialization & QR Handlers** → `useQrScanner` Hook
**Lines: ~140 (lines 434-633)**  
**Impact: MEDIUM** 🟡

Bridge/scanner logic includes:
- QR scanner initialization
- Scanner timeout management
- `scanQrcodeResultCallBack` handler
- Routing results to battery or payment handlers

**Extraction:**
```typescript
// New hook: /src/lib/hooks/useQrScanner.ts
const {
  startScan,
  isScannerOpening,
  scanType,
  setScanType,
} = useQrScanner({
  onBatteryScan: (qrData) => { ... },
  onPaymentScan: (paymentId) => { ... },
});
```

**Benefits:**
- Encapsulates WebViewJavascriptBridge complexity
- Reduces SalesFlow.tsx by ~140 lines (7% reduction)

---

### 8. **Main Action Handler** → Extract to Separate File
**Lines: ~130 (lines 1679-1837)**  
**Impact: LOW-MEDIUM** 🟢

The `handleMainAction` switch statement could be extracted or simplified by:
- Moving step-specific logic to step components
- Using a configuration-driven approach

**Benefits:**
- Cleaner main component
- Each step handles its own action

---

### 9. **Resume Session Modal** → `<ResumeSessionModal />` Component
**Lines: ~50 (lines 2075-2119)**  
**Impact: LOW** 🟢

The resume session prompt UI could be a standalone component.

**Extraction:**
```typescript
// New component: /src/components/shared/ResumeSessionModal.tsx
<ResumeSessionModal
  isOpen={showResumePrompt}
  sessionSummary={savedSessionSummary}
  onResume={restoreSession}
  onDiscard={discardSession}
/>
```

---

### 10. **CustomerAcquisitionForm.tsx Cleanup**
**Lines: 523 (entire file)**  
**Impact: LOW** 🟢

This file appears to be **unused/legacy code** based on:
- Not imported or used anywhere in the flow
- Has different styling approach (Tailwind utility classes)
- Duplicates functionality of Step1CustomerForm.tsx

**Recommendation:** Verify unused and delete to reduce codebase clutter.

---

## 📊 Impact Summary

| Refactoring | Lines Saved | % Reduction | Priority |
|-------------|-------------|-------------|----------|
| Service Completion Hook | ~330 | 15% | 🔴 HIGH |
| Payment Processing Hook | ~175 | 8% | 🔴 HIGH |
| Product Catalog Hook | ~200 | 9% | 🟠 MEDIUM-HIGH |
| Session Persistence Hook | ~120 | 6% | 🟡 MEDIUM |
| Subscription Purchase Hook | ~110 | 5% | 🟡 MEDIUM |
| Customer Registration Hook | ~75 | 4% | 🟡 MEDIUM |
| QR Scanner Hook | ~140 | 7% | 🟡 MEDIUM |
| Resume Session Modal | ~50 | 2% | 🟢 LOW |
| **Total Potential** | **~1,200** | **~56%** | - |

---

## ✅ Completed Refactoring

### Phase 1: Highest Impact

#### 1. `useServiceCompletion` Hook - ✅ COMPLETED
**Status:** Extracted to `/src/lib/hooks/useServiceCompletion.ts`

| Metric | Before | After |
|--------|--------|-------|
| SalesFlow.tsx | 2,129 lines | 1,857 lines |
| Reduction | - | **272 lines (13%)** |
| New Hook | - | 532 lines |

**Features of the new hook:**
- MQTT request/response pattern encapsulation
- Correlation ID tracking for request matching
- Signal-based success/error detection
- Timeout management (30s default)
- User-friendly error messages for common failure types
- Reusable for both Sales (battery assignment) and Attendant (battery swap) flows

**Usage:**
```typescript
import { useServiceCompletion } from '@/lib/hooks/useServiceCompletion';

const {
  completeService,
  isCompleting,
  error,
  clearError,
  isComplete,
  reset,
} = useServiceCompletion({
  stationId: 'STATION_001',
  actorType: 'attendant',
  debug: true,
});

// Complete service
const result = await completeService({
  subscriptionId: 'SUB-123',
  battery: { id: 'BAT-001', energy: 2500, actualBatteryId: 'B0723025100049' },
});
```

---

## 🎯 Remaining Refactoring (Recommended Order)

### Phase 1 (continued): Highest Impact
2. **`useProductCatalog`** - Extract product/package/plan fetching

### Phase 2: Payment & Business Logic (Reduces SalesFlow by ~360 lines)
3. **`useSalesPayment`** - Extract payment processing
4. **`useSalesSessionPersistence`** - Extract session management
5. **`useSubscriptionPurchase`** - Extract purchase logic

### Phase 3: Infrastructure & Cleanup (Reduces SalesFlow by ~215 lines)
6. **`useQrScanner`** - Extract QR scanning logic
7. **`useCustomerRegistration`** - Extract registration logic
8. **`<ResumeSessionModal />`** - Extract modal component

### Phase 4: Cleanup
9. Delete `CustomerAcquisitionForm.tsx` if confirmed unused
10. Delete `Step2SelectProduct.tsx` if deprecated (replaced by Step2SelectPackage)

---

## 🏗️ Suggested File Structure After Refactoring

```
src/lib/hooks/
├── sales/
│   ├── useServiceCompletion.ts    (NEW - 330 lines)
│   ├── useSalesPayment.ts         (NEW - 175 lines)
│   ├── useProductCatalog.ts       (NEW - 200 lines)
│   ├── useSalesSession.ts         (NEW - 120 lines)
│   ├── useSubscriptionPurchase.ts (NEW - 110 lines)
│   ├── useCustomerRegistration.ts (NEW - 75 lines)
│   └── index.ts
├── ble/
│   └── useFlowBatteryScan.ts      (existing)
└── useQrScanner.ts                (NEW - 140 lines)

src/components/shared/
├── ResumeSessionModal.tsx         (NEW - 50 lines)
└── ... (existing components)

src/app/(mobile)/customers/customerform/
├── SalesFlow.tsx                  (reduced from 2,129 to ~900 lines)
├── page.tsx
└── components/
    ├── SalesTimeline.tsx
    ├── SalesActionBar.tsx
    ├── types.ts
    ├── index.ts
    └── steps/
        ├── Step1CustomerForm.tsx
        ├── Step2SelectPackage.tsx
        ├── Step2SelectPlan.tsx
        ├── Step3Payment.tsx
        ├── Step4Preview.tsx
        ├── Step4AssignBattery.tsx
        ├── Step5Success.tsx
        └── index.ts
```

---

## 🔍 Additional Observations

### State Management Complexity
`SalesFlow.tsx` has **40+ useState declarations**. Consider:
- Grouping related state with `useReducer` or a custom state hook
- Example: Payment state (paymentConfirmed, paymentReference, paymentInitiated, paymentAmountPaid, etc.) could be one object

### TypeScript Improvements
- Some callback refs could use better typing
- Consider stronger typing for MQTT payloads

### Testing Opportunities
By extracting to hooks:
- Each hook can be unit tested in isolation
- MQTT and API logic can be mocked easily
- Complex flows can be integration tested

---

## Conclusion

The SalesFlow.tsx file can be reduced by approximately **56%** (from 2,129 to ~900 lines) through strategic extraction of:
- **Custom hooks** for business logic (MQTT, payments, registration)
- **Data fetching hooks** for API interactions
- **UI components** for modals and reusable UI patterns

**Recommended first steps:**
1. Extract `useServiceCompletion` hook (highest complexity, biggest impact)
2. Extract `useProductCatalog` hook (clean data-fetching pattern)

These two extractions alone would reduce the file by ~25% and establish patterns for the remaining refactoring.
