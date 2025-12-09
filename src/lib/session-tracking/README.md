# Session Tracking Backend API Data Structures

This document defines the JSON data structures for persisting session state to a backend. These structures enable complete session recovery - allowing the app to restore to the exact step and state if interrupted.

## Design Principles

1. **Complete State Capture**: Every piece of state needed to restore the UI is captured
2. **Step-by-Step Tracking**: Each step has its own completion status
3. **Idempotency**: Sessions have unique IDs and versions for safe retries
4. **Audit Trail**: Timestamps track when each action occurred
5. **Recovery-First**: Structure optimized for easy restoration logic

---

## 1. Sales Flow Session Data

The Sales flow is a 7-step process for registering new customers:
1. **Customer Info** - Collect customer details
2. **Package Selection** - Select product package (bike + privilege)
3. **Subscription Selection** - Choose subscription plan
4. **Preview** - Review order before payment
5. **Payment** - Collect payment
6. **Battery Assignment** - Scan and assign battery
7. **Success** - Show completion receipt

### Complete Sales Session JSON

```json
{
  "session_id": "sales-sess-abc123-def456",
  "session_type": "SALES_REGISTRATION",
  "version": 3,
  "created_at": "2025-12-09T10:30:00.000Z",
  "updated_at": "2025-12-09T10:45:30.000Z",
  "expires_at": "2025-12-10T10:30:00.000Z",
  
  "device_info": {
    "device_id": "device-uuid-12345",
    "app_version": "1.2.3",
    "platform": "ios",
    "locale": "en"
  },
  
  "actor": {
    "type": "salesperson",
    "id": "emp-456",
    "name": "John Doe",
    "station": "STATION_001",
    "company_id": 1
  },
  
  "flow_state": {
    "current_step": 5,
    "max_step_reached": 5,
    "total_steps": 7,
    "steps_completed": [1, 2, 3, 4],
    "step_statuses": {
      "1": { "status": "completed", "completed_at": "2025-12-09T10:32:00.000Z" },
      "2": { "status": "completed", "completed_at": "2025-12-09T10:34:00.000Z" },
      "3": { "status": "completed", "completed_at": "2025-12-09T10:36:00.000Z" },
      "4": { "status": "completed", "completed_at": "2025-12-09T10:38:00.000Z" },
      "5": { "status": "in_progress", "started_at": "2025-12-09T10:38:00.000Z" },
      "6": { "status": "pending" },
      "7": { "status": "pending" }
    }
  },
  
  "customer_data": {
    "form_data": {
      "first_name": "Jane",
      "last_name": "Smith",
      "phone": "254712345678",
      "email": "jane.smith@example.com",
      "street": "123 Main Street",
      "city": "Nairobi",
      "zip": "00100"
    },
    "form_validated": true,
    "form_errors": {}
  },
  
  "registration_result": {
    "customer_id": 12345,
    "partner_id": 67890,
    "customer_session_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "registered_at": "2025-12-09T10:32:00.000Z"
  },
  
  "package_selection": {
    "selected_package_id": "pkg-101",
    "package_details": {
      "odoo_package_id": 101,
      "name": "E-Bike Standard Package",
      "price": 15000,
      "currency": "KES",
      "currency_symbol": "KES",
      "components": [
        {
          "id": 201,
          "name": "E-Bike Model A",
          "type": "main_service",
          "price_unit": 12000,
          "quantity": 1
        },
        {
          "id": 202,
          "name": "Battery Swap Privilege",
          "type": "battery_swap",
          "price_unit": 3000,
          "quantity": 1
        }
      ]
    },
    "selected_at": "2025-12-09T10:34:00.000Z"
  },
  
  "plan_selection": {
    "selected_plan_id": "plan-301",
    "plan_details": {
      "odoo_product_id": 301,
      "name": "Monthly Subscription",
      "price": 500,
      "period": "monthly",
      "currency": "KES",
      "currency_symbol": "KES"
    },
    "selected_at": "2025-12-09T10:36:00.000Z"
  },
  
  "subscription_data": {
    "id": 5001,
    "subscription_code": "SUB-8847-KE",
    "status": "draft",
    "product_name": "Monthly Subscription",
    "price_at_signup": 500,
    "currency": "KES",
    "currency_symbol": "KES",
    "created_at": "2025-12-09T10:38:00.000Z"
  },
  
  "order_data": {
    "order_id": 7001,
    "sale_order_name": "SO/2025/0001",
    "total_amount": 15500,
    "currency": "KES",
    "created_at": "2025-12-09T10:38:00.000Z"
  },
  
  "payment_state": {
    "payment_initiated": true,
    "payment_confirmed": false,
    "payment_input_mode": "manual",
    "stk_push_sent": true,
    "stk_push_response": {
      "transaction_id": "txn-abc123",
      "checkout_request_id": "ws_CO_123456789",
      "merchant_request_id": "mrq-987654",
      "instructions": "Check your phone for M-Pesa prompt"
    },
    "payment_request": {
      "order_id": 7001,
      "amount_required": 15500,
      "description": "E-Bike Standard Package + Monthly Subscription"
    },
    "payment_confirmation": null,
    "amount_expected": 15500,
    "amount_paid": 0,
    "amount_remaining": 15500,
    "payment_incomplete": false,
    "manual_payment_id": "",
    "confirmed_subscription_code": null,
    "payment_reference": null
  },
  
  "battery_assignment": {
    "scanned_battery_pending": null,
    "assigned_battery": null,
    "ble_connection_state": {
      "is_scanning": false,
      "is_connecting": false,
      "is_reading_energy": false,
      "connected_device": null,
      "detected_devices": [],
      "connection_progress": 0,
      "error": null
    }
  },
  
  "service_completion": {
    "is_completing_service": false,
    "service_completion_error": null,
    "mqtt_correlation_id": null,
    "service_completed_at": null
  },
  
  "completion_data": {
    "registration_id": null,
    "completed_at": null,
    "receipt_data": null
  },
  
  "metadata": {
    "last_action": "PAYMENT_INITIATED",
    "last_action_at": "2025-12-09T10:38:30.000Z",
    "error_count": 0,
    "retry_count": 0,
    "session_duration_seconds": 930
  }
}
```

### Sales Session - Step-by-Step State Changes

#### After Step 1 (Customer Info Completed)
```json
{
  "flow_state": {
    "current_step": 2,
    "max_step_reached": 2,
    "steps_completed": [1]
  },
  "customer_data": {
    "form_data": { "first_name": "Jane", "last_name": "Smith", ... },
    "form_validated": true
  },
  "registration_result": {
    "customer_id": 12345,
    "partner_id": 67890,
    "customer_session_token": "eyJ..."
  }
}
```

#### After Step 4 (Preview - Order Created)
```json
{
  "flow_state": {
    "current_step": 5,
    "max_step_reached": 5,
    "steps_completed": [1, 2, 3, 4]
  },
  "subscription_data": {
    "subscription_code": "SUB-8847-KE",
    "status": "draft"
  },
  "order_data": {
    "order_id": 7001,
    "total_amount": 15500
  },
  "payment_state": {
    "payment_initiated": true,
    "payment_request": { "order_id": 7001, "amount_required": 15500 }
  }
}
```

#### After Step 5 (Payment Confirmed)
```json
{
  "flow_state": {
    "current_step": 6,
    "max_step_reached": 6,
    "steps_completed": [1, 2, 3, 4, 5]
  },
  "payment_state": {
    "payment_confirmed": true,
    "amount_paid": 15500,
    "amount_remaining": 0,
    "payment_reference": "MPESA_REF_123456",
    "confirmed_subscription_code": "SUB-8847-KE"
  }
}
```

#### After Step 6 (Battery Assigned)
```json
{
  "flow_state": {
    "current_step": 7,
    "max_step_reached": 7,
    "steps_completed": [1, 2, 3, 4, 5, 6]
  },
  "battery_assignment": {
    "assigned_battery": {
      "id": "B0723025100049",
      "short_id": "100049",
      "charge_level": 85,
      "energy": 2545,
      "mac_address": "AA:BB:CC:DD:EE:FF"
    }
  },
  "service_completion": {
    "service_completed_at": "2025-12-09T10:48:00.000Z"
  },
  "completion_data": {
    "registration_id": "#REG-847392",
    "completed_at": "2025-12-09T10:48:00.000Z"
  }
}
```

---

## 2. Attendant Flow Session Data

The Attendant flow is a 6-step process for battery swaps:
1. **Customer Scan** - Identify customer via QR or manual entry
2. **Return Battery** - Scan old battery being returned
3. **New Battery** - Scan new battery being issued
4. **Review** - Review swap details and cost
5. **Payment** - Collect payment (or skip if quota available)
6. **Success** - Show completion receipt

### Complete Attendant Session JSON

```json
{
  "session_id": "att-sess-xyz789-uvw012",
  "session_type": "ATTENDANT_SWAP",
  "version": 3,
  "created_at": "2025-12-09T14:00:00.000Z",
  "updated_at": "2025-12-09T14:12:30.000Z",
  "expires_at": "2025-12-10T14:00:00.000Z",
  
  "device_info": {
    "device_id": "device-uuid-67890",
    "app_version": "1.2.3",
    "platform": "android",
    "locale": "en"
  },
  
  "actor": {
    "type": "attendant",
    "id": "attendant-789",
    "name": "Alice Johnson",
    "station": "STATION_002"
  },
  
  "flow_state": {
    "current_step": 4,
    "max_step_reached": 4,
    "total_steps": 6,
    "steps_completed": [1, 2, 3],
    "step_statuses": {
      "1": { "status": "completed", "completed_at": "2025-12-09T14:02:00.000Z" },
      "2": { "status": "completed", "completed_at": "2025-12-09T14:05:00.000Z" },
      "3": { "status": "completed", "completed_at": "2025-12-09T14:08:00.000Z" },
      "4": { "status": "in_progress", "started_at": "2025-12-09T14:08:00.000Z" },
      "5": { "status": "pending" },
      "6": { "status": "pending" }
    }
  },
  
  "customer_identification": {
    "input_mode": "scan",
    "manual_subscription_id": null,
    "qr_code_raw": "SUB-8847-KE",
    "dynamic_plan_id": "SUB-8847-KE",
    "mqtt_correlation_id": "att-customer-id-1733752800000-abc123",
    "identified_at": "2025-12-09T14:02:00.000Z"
  },
  
  "customer_data": {
    "id": "customer-12345",
    "name": "Jane Smith",
    "subscription_id": "SUB-8847-KE",
    "subscription_type": "Monthly Swap Plan",
    "phone": "254712345678",
    "swap_count": 15,
    "last_swap": "2025-12-05",
    "energy_remaining": 45.5,
    "energy_total": 100,
    "energy_value": 5460,
    "energy_unit_price": 120,
    "swaps_remaining": 6,
    "swaps_total": 21,
    "has_infinite_energy_quota": false,
    "has_infinite_swap_quota": false,
    "payment_state": "CURRENT",
    "service_state": "BATTERY_ISSUED",
    "current_battery_id": "B0723025100042"
  },
  
  "service_states": [
    {
      "service_id": "service-electricity-monthly",
      "name": "Electricity Service",
      "used": 54.5,
      "quota": 100,
      "current_asset": null,
      "usage_unit_price": 120
    },
    {
      "service_id": "service-swap-count-monthly",
      "name": "Swap Count Service",
      "used": 15,
      "quota": 21,
      "current_asset": null,
      "usage_unit_price": null
    },
    {
      "service_id": "service-battery-fleet",
      "name": "Battery Fleet Service",
      "used": 0,
      "quota": 1,
      "current_asset": "B0723025100042",
      "usage_unit_price": null
    }
  ],
  
  "customer_type": "returning",
  
  "old_battery": {
    "id": "B0723025100042",
    "short_id": "100042",
    "charge_level": 12,
    "energy": 450,
    "mac_address": "11:22:33:44:55:66",
    "scanned_at": "2025-12-09T14:05:00.000Z",
    "ble_connection_succeeded": true
  },
  
  "new_battery": {
    "id": "B0723025100049",
    "short_id": "100049",
    "charge_level": 95,
    "energy": 2850,
    "mac_address": "AA:BB:CC:DD:EE:FF",
    "scanned_at": "2025-12-09T14:08:00.000Z",
    "ble_connection_succeeded": true
  },
  
  "swap_data": {
    "energy_diff": 2.4,
    "quota_deduction": 2.4,
    "chargeable_energy": 0,
    "cost": 0,
    "rate": 120,
    "currency_symbol": "KES"
  },
  
  "payment_state": {
    "has_sufficient_quota": true,
    "payment_skipped": false,
    "payment_skip_reason": null,
    "payment_request_created": false,
    "payment_request_data": null,
    "payment_request_order_id": null,
    "expected_payment_amount": 0,
    "payment_initiated": false,
    "payment_initiation_data": null,
    "payment_input_mode": "scan",
    "manual_payment_id": "",
    "payment_confirmed": false,
    "payment_receipt": null,
    "actual_amount_paid": 0,
    "payment_amount_remaining": 0
  },
  
  "ble_state": {
    "handlers_ready": true,
    "is_scanning": false,
    "is_connecting": false,
    "is_reading_energy": false,
    "connected_device": null,
    "detected_devices": [
      { "mac_address": "AA:BB:CC:DD:EE:FF", "name": "OVES BATT 100049", "rssi": "-45db ~ 2m", "raw_rssi": -45 },
      { "mac_address": "11:22:33:44:55:66", "name": "OVES BATT 100042", "rssi": "-52db ~ 4m", "raw_rssi": -52 }
    ],
    "connection_progress": 0,
    "error": null,
    "connection_failed": false,
    "requires_bluetooth_reset": false,
    "pending_battery_id": null
  },
  
  "flow_error": null,
  
  "service_completion": {
    "payment_and_service_status": "idle",
    "mqtt_correlation_id": null,
    "is_quota_based": false,
    "is_zero_cost_rounding": false,
    "service_completed_at": null
  },
  
  "completion_data": {
    "transaction_id": null,
    "completed_at": null,
    "receipt_data": null
  },
  
  "metadata": {
    "last_action": "NEW_BATTERY_SCANNED",
    "last_action_at": "2025-12-09T14:08:00.000Z",
    "error_count": 0,
    "retry_count": 0,
    "session_duration_seconds": 480
  }
}
```

### Attendant Session - Step-by-Step State Changes

#### After Step 1 (Customer Identified)
```json
{
  "flow_state": {
    "current_step": 2,
    "max_step_reached": 2,
    "steps_completed": [1]
  },
  "customer_identification": {
    "dynamic_plan_id": "SUB-8847-KE",
    "identified_at": "2025-12-09T14:02:00.000Z"
  },
  "customer_data": {
    "id": "customer-12345",
    "name": "Jane Smith",
    "subscription_id": "SUB-8847-KE",
    "current_battery_id": "B0723025100042"
  },
  "customer_type": "returning"
}
```

#### After Step 2 (Old Battery Scanned)
```json
{
  "flow_state": {
    "current_step": 3,
    "max_step_reached": 3,
    "steps_completed": [1, 2]
  },
  "old_battery": {
    "id": "B0723025100042",
    "charge_level": 12,
    "energy": 450,
    "ble_connection_succeeded": true
  }
}
```

#### After Step 3 (New Battery Scanned)
```json
{
  "flow_state": {
    "current_step": 4,
    "max_step_reached": 4,
    "steps_completed": [1, 2, 3]
  },
  "new_battery": {
    "id": "B0723025100049",
    "charge_level": 95,
    "energy": 2850,
    "ble_connection_succeeded": true
  },
  "swap_data": {
    "energy_diff": 2.4,
    "quota_deduction": 2.4,
    "chargeable_energy": 0,
    "cost": 0
  }
}
```

#### After Step 4 (Review - Quota Used, Skip Payment)
```json
{
  "flow_state": {
    "current_step": 6,
    "max_step_reached": 6,
    "steps_completed": [1, 2, 3, 4]
  },
  "payment_state": {
    "has_sufficient_quota": true,
    "payment_skipped": true,
    "payment_skip_reason": "QUOTA_CREDIT",
    "payment_confirmed": true,
    "payment_receipt": "QUOTA_1733756400000"
  },
  "service_completion": {
    "payment_and_service_status": "success",
    "is_quota_based": true
  }
}
```

#### After Step 4 (Review - Payment Required)
```json
{
  "flow_state": {
    "current_step": 5,
    "max_step_reached": 5,
    "steps_completed": [1, 2, 3, 4]
  },
  "payment_state": {
    "has_sufficient_quota": false,
    "payment_request_created": true,
    "payment_request_order_id": 7002,
    "expected_payment_amount": 288,
    "payment_initiated": true
  }
}
```

#### After Step 5 (Payment Confirmed)
```json
{
  "flow_state": {
    "current_step": 6,
    "max_step_reached": 6,
    "steps_completed": [1, 2, 3, 4, 5]
  },
  "payment_state": {
    "payment_confirmed": true,
    "payment_receipt": "MPESA_REF_789012",
    "actual_amount_paid": 288,
    "payment_amount_remaining": 0
  },
  "service_completion": {
    "payment_and_service_status": "success"
  },
  "completion_data": {
    "transaction_id": "MPESA_REF_789012",
    "completed_at": "2025-12-09T14:15:00.000Z"
  }
}
```

---

## 3. Backend API Endpoints

### Save Session
```
POST /api/sessions
Content-Type: application/json
Authorization: Bearer <token>

{
  "session_id": "sales-sess-abc123-def456",
  "session_type": "SALES_REGISTRATION",
  ... // full session data
}

Response:
{
  "success": true,
  "session_id": "sales-sess-abc123-def456",
  "version": 3
}
```

### Update Session (Partial)
```
PATCH /api/sessions/{session_id}
Content-Type: application/json
Authorization: Bearer <token>

{
  "flow_state": { "current_step": 5 },
  "payment_state": { "payment_confirmed": true }
}

Response:
{
  "success": true,
  "session_id": "sales-sess-abc123-def456",
  "version": 4
}
```

### Get Session
```
GET /api/sessions/{session_id}
Authorization: Bearer <token>

Response:
{
  "success": true,
  "session": { ... }
}
```

### List Active Sessions (for a device/user)
```
GET /api/sessions?device_id={device_id}&status=active
Authorization: Bearer <token>

Response:
{
  "success": true,
  "sessions": [
    {
      "session_id": "sales-sess-abc123-def456",
      "session_type": "SALES_REGISTRATION",
      "current_step": 5,
      "customer_name": "Jane Smith",
      "updated_at": "2025-12-09T10:45:30.000Z"
    }
  ]
}
```

### Delete/Complete Session
```
DELETE /api/sessions/{session_id}
Authorization: Bearer <token>

Response:
{
  "success": true,
  "archived": true
}
```

---

## 4. Session Recovery Logic

### On App Start
```typescript
async function checkForRecoverableSessions() {
  // 1. Check local storage first (offline recovery)
  const localSession = loadLocalSession();
  
  // 2. Fetch any active sessions from backend
  const remoteSessions = await fetchActiveSessions(deviceId);
  
  // 3. Determine which session to offer for recovery
  // Prefer remote if newer, local if offline
  const sessionToRecover = determineRecoverySession(localSession, remoteSessions);
  
  if (sessionToRecover) {
    // Show recovery prompt
    showRecoveryPrompt(sessionToRecover);
  }
}
```

### Recovery Prompt Data
```json
{
  "session_id": "sales-sess-abc123-def456",
  "session_type": "SALES_REGISTRATION",
  "summary": {
    "customer_name": "Jane Smith",
    "current_step": 5,
    "step_name": "Payment",
    "last_action": "Payment initiated",
    "saved_ago": "15 minutes ago"
  },
  "can_resume": true,
  "resume_warnings": []
}
```

---

## 5. State Transition Events

For audit and debugging, track key events:

```json
{
  "session_id": "sales-sess-abc123-def456",
  "events": [
    {
      "event_id": "evt-001",
      "event_type": "SESSION_CREATED",
      "timestamp": "2025-12-09T10:30:00.000Z",
      "data": {}
    },
    {
      "event_id": "evt-002",
      "event_type": "STEP_COMPLETED",
      "timestamp": "2025-12-09T10:32:00.000Z",
      "data": { "step": 1, "step_name": "Customer Info" }
    },
    {
      "event_id": "evt-003",
      "event_type": "CUSTOMER_REGISTERED",
      "timestamp": "2025-12-09T10:32:00.000Z",
      "data": { "customer_id": 12345, "partner_id": 67890 }
    },
    {
      "event_id": "evt-004",
      "event_type": "PAYMENT_INITIATED",
      "timestamp": "2025-12-09T10:38:30.000Z",
      "data": { "order_id": 7001, "amount": 15500 }
    },
    {
      "event_id": "evt-005",
      "event_type": "SESSION_RECOVERED",
      "timestamp": "2025-12-09T11:00:00.000Z",
      "data": { "recovered_from_step": 5 }
    }
  ]
}
```

---

## 6. Error Handling

### Flow Error State
```json
{
  "flow_error": {
    "step": 2,
    "error_code": "BATTERY_MISMATCH",
    "message": "Battery does not belong to this customer",
    "details": "Scanned: ...100049 | Expected: ...100042",
    "timestamp": "2025-12-09T14:06:00.000Z",
    "recoverable": true,
    "recovery_action": "RESCAN_BATTERY"
  }
}
```

### Common Error Codes
- `CUSTOMER_NOT_FOUND` - Customer lookup failed
- `BATTERY_MISMATCH` - Wrong battery scanned
- `SAME_BATTERY_SCANNED` - Old and new battery are the same
- `PAYMENT_FAILED` - Payment confirmation failed
- `PAYMENT_INSUFFICIENT` - Amount paid less than required
- `SERVICE_COMPLETION_FAILED` - MQTT service completion failed
- `BLE_CONNECTION_FAILED` - Bluetooth connection failed
- `MQTT_TIMEOUT` - Backend response timeout

---

## 7. TypeScript Interfaces

See `/src/lib/session-tracking/types.ts` for complete TypeScript interfaces that match these JSON structures.
