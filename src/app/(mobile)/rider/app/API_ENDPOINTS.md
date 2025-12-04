# Rider App API Endpoints & Data Sources Documentation

This document outlines all the API endpoints and MQTT events consumed throughout the rider workflow.

---

## Data Architecture Overview

The rider app uses a **hybrid data architecture**:
1. **REST APIs** - For authentication and CRM data (Odoo)
2. **MQTT Events** - For real-time service plan data, swaps, and battery status (BSS Platform)

---

## Part 1: REST API Endpoints

Base URL: `https://crm-omnivoltaic.odoo.com/api`

### 1. Login
```
POST /auth/login
```
**Headers:**
- `Content-Type: application/json`
- `X-API-KEY: abs_connector_secret_key_2024`

**Request Body:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "success": true,
  "session": {
    "token": "string (JWT token)",
    "user": {
      "id": "number",
      "name": "string",
      "email": "string",
      "phone": "string",
      "partner_id": "number"
    }
  }
}
```

**Note:** After login, use the customer's subscription IDs to identify them via MQTT.

### 2. Register
```
POST /auth/register
```
**Headers:**
- `Content-Type: application/json`
- `X-API-KEY: abs_connector_secret_key_2024`

**Request Body:**
```json
{
  "name": "string",
  "email": "string",
  "phone": "string",
  "company_id": "string (e.g., '14')"
}
```

### 3. Change Password
```
POST /auth/change-password
```
**Headers:**
- `Content-Type: application/json`
- `X-API-KEY: abs_connector_secret_key_2024`
- `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "current_password": "string",
  "new_password": "string",
  "confirm_password": "string"
}
```

---

## Dashboard Endpoints

### 4. Get Customer Dashboard ✅ (Available)
```
GET /customer/dashboard
```
**Headers:**
- `Content-Type: application/json`
- `X-API-KEY: abs_connector_secret_key_2024`
- `Authorization: Bearer {token}`

**Response:**
```json
{
  "success": true,
  "summary": {
    "active_subscriptions": "number",
    "total_invoiced": "number",
    "total_outstanding": "number",
    "total_paid": "number",
    "total_orders": "number"
  },
  "active_subscriptions": [
    {
      "id": "number",
      "subscription_code": "string",
      "name": "string",
      "status": "string",
      "next_cycle_date": "string (ISO date)",
      "price_at_signup": "number",
      "product_id": ["number", "string"],
      "currency_symbol": "string"
    }
  ]
}
```

---

## Stations/Swap Endpoints

### 5. Get Nearby Stations ⚠️ (May need implementation)
```
GET /stations/nearby
```
**Headers:**
- `Content-Type: application/json`
- `X-API-KEY: abs_connector_secret_key_2024`
- `Authorization: Bearer {token}` (optional)

**Query Parameters:**
- `lat`: latitude (optional)
- `lng`: longitude (optional)
- `radius`: search radius in km (optional)

**Expected Response:**
```json
{
  "success": true,
  "stations": [
    {
      "id": "number",
      "name": "string",
      "address": "string",
      "distance": "string (e.g., '0.8 km')",
      "batteries": "number (available)",
      "waitTime": "string (e.g., '~3 min')",
      "lat": "number",
      "lng": "number",
      "status": "string ('open', 'closed')",
      "operatingHours": "string"
    }
  ]
}
```

### 6. Get Station Details ⚠️ (May need implementation)
```
GET /stations/{station_id}
```
**Expected Response:**
```json
{
  "success": true,
  "station": {
    "id": "number",
    "name": "string",
    "address": "string",
    "lat": "number",
    "lng": "number",
    "batteries_available": "number",
    "batteries_charging": "number",
    "total_slots": "number",
    "wait_time": "string",
    "operating_hours": "string",
    "contact_phone": "string"
  }
}
```

---

## Activity/Transaction Endpoints

### 7. Get Activity History ⚠️ (May need implementation)
```
GET /customer/activity
```
**Headers:**
- `Content-Type: application/json`
- `X-API-KEY: abs_connector_secret_key_2024`
- `Authorization: Bearer {token}`

**Query Parameters:**
- `type`: 'all' | 'swaps' | 'payments' | 'topups' (optional)
- `page`: page number (optional)
- `limit`: items per page (optional)
- `start_date`: ISO date (optional)
- `end_date`: ISO date (optional)

**Expected Response:**
```json
{
  "success": true,
  "activities": [
    {
      "id": "string",
      "type": "swap | topup | payment",
      "title": "string",
      "subtitle": "string (location/method)",
      "amount": "number",
      "currency": "string",
      "is_positive": "boolean",
      "time": "string (HH:mm)",
      "date": "string (ISO date)",
      "reference": "string (transaction ref)"
    }
  ],
  "pagination": {
    "page": "number",
    "total_pages": "number",
    "total_count": "number"
  }
}
```

### 8. Get Swap History ⚠️ (May need implementation)
```
GET /customer/swaps
```
**Headers:**
- `Content-Type: application/json`
- `X-API-KEY: abs_connector_secret_key_2024`
- `Authorization: Bearer {token}`

**Expected Response:**
```json
{
  "success": true,
  "swaps": [
    {
      "id": "number",
      "date": "string (ISO date)",
      "station_name": "string",
      "station_id": "number",
      "old_battery_id": "string",
      "new_battery_id": "string",
      "amount_charged": "number",
      "currency": "string",
      "status": "string"
    }
  ]
}
```

---

## Payment Endpoints

### 9. Get Payment History ⚠️ (May need implementation)
```
GET /customer/payments
```
**Headers:**
- `Content-Type: application/json`
- `X-API-KEY: abs_connector_secret_key_2024`
- `Authorization: Bearer {token}`

**Expected Response:**
```json
{
  "success": true,
  "payments": [
    {
      "id": "string",
      "plan_name": "string",
      "amount": "number",
      "currency": "string",
      "date": "string (ISO date)",
      "status": "completed | pending | failed",
      "payment_method": "string",
      "transaction_ref": "string"
    }
  ]
}
```

### 10. Verify Payment Transaction ⚠️ (May need implementation)
```
POST /payments/verify
```
**Headers:**
- `Content-Type: application/json`
- `X-API-KEY: abs_connector_secret_key_2024`
- `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "transaction_id": "string",
  "payment_method": "string (mtn_momo, flooz, bank_transfer)"
}
```

**Expected Response:**
```json
{
  "success": true,
  "verified": "boolean",
  "transaction": {
    "id": "string",
    "amount": "number",
    "currency": "string",
    "status": "string"
  }
}
```

### 11. Top Up Balance ⚠️ (May need implementation)
```
POST /customer/topup
```
**Headers:**
- `Content-Type: application/json`
- `X-API-KEY: abs_connector_secret_key_2024`
- `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "amount": "number",
  "payment_method": "string",
  "phone_number": "string (for mobile money)"
}
```

---

## Vehicle/Bike Endpoints

### 12. Get Customer Vehicle ⚠️ (May need implementation)
```
GET /customer/vehicle
```
**Headers:**
- `Content-Type: application/json`
- `X-API-KEY: abs_connector_secret_key_2024`
- `Authorization: Bearer {token}`

**Expected Response:**
```json
{
  "success": true,
  "vehicle": {
    "id": "number",
    "model": "string",
    "vehicle_id": "string (plate/registration)",
    "status": "active | inactive",
    "last_swap": "string (relative time or date)",
    "total_swaps": "number",
    "image_url": "string (optional)"
  }
}
```

---

## Subscription/Plan Endpoints

### 13. Get Subscription Plans ✅ (Available via serviceplan1)
```
GET /customer/subscription-plans
```
**Headers:**
- `Content-Type: application/json`
- `X-API-KEY: abs_connector_secret_key_2024`
- `Authorization: Bearer {token}`

**Response:**
```json
{
  "success": true,
  "plans": [
    {
      "id": "number",
      "name": "string",
      "price": "number",
      "currency_symbol": "string",
      "billing_frequency": "string",
      "features": ["string"]
    }
  ]
}
```

### 14. Get Current Subscription ⚠️ (May need implementation)
```
GET /customer/subscription
```
**Headers:**
- `Content-Type: application/json`
- `X-API-KEY: abs_connector_secret_key_2024`
- `Authorization: Bearer {token}`

**Expected Response:**
```json
{
  "success": true,
  "subscription": {
    "plan_name": "string",
    "status": "active | expired | suspended",
    "start_date": "string (ISO date)",
    "end_date": "string (ISO date)",
    "swaps_remaining": "number (if limited)",
    "price": "number",
    "currency": "string"
  }
}
```

---

## Account Balance Endpoint

### 15. Get Account Balance ⚠️ (May need implementation)
```
GET /customer/balance
```
**Headers:**
- `Content-Type: application/json`
- `X-API-KEY: abs_connector_secret_key_2024`
- `Authorization: Bearer {token}`

**Expected Response:**
```json
{
  "success": true,
  "balance": {
    "amount": "number",
    "currency": "string",
    "last_updated": "string (ISO date)"
  }
}
```

---

## Support/Ticketing Endpoints

### 16. Create Support Ticket ⚠️ (Available)
```
POST /support/tickets
```
**Headers:**
- `Content-Type: application/json`
- `X-API-KEY: abs_connector_secret_key_2024`
- `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "subject": "string",
  "description": "string",
  "category": "string",
  "priority": "low | medium | high"
}
```

### 17. Get Support Tickets ⚠️ (Available)
```
GET /support/tickets
```
**Headers:**
- `Content-Type: application/json`
- `X-API-KEY: abs_connector_secret_key_2024`
- `Authorization: Bearer {token}`

---

---

## Part 2: MQTT Event System (BSS Platform)

The BSS (Battery Swap Service) platform uses MQTT for real-time data. After login, use subscription IDs to identify customer.

### Customer Identification Event

**Topic:** `emit/uxi/attendant/plan/{plan_id}/identify_customer`

**Request Payload:**
```json
{
  "timestamp": "2025-01-15T09:00:00Z",
  "plan_id": "bss-plan-togo-7day-barebone-plan3",
  "correlation_id": "att-customer-id-001",
  "actor": {
    "type": "attendant",
    "id": "attendant-001"
  },
  "data": {
    "action": "IDENTIFY_CUSTOMER",
    "qr_code_data": "QR_CUSTOMER_TEST_001",
    "attendant_station": "STATION_001"
  }
}
```

**Response Payload (rich data available):**
```json
{
  "timestamp": "2025-11-29T14:27:07.096Z",
  "plan_id": "bss-plan-togo-7day-barebone-plan3",
  "correlation_id": "att-customer-id-1764426423555-xv5s4dtmf",
  "actor": {
    "type": "agent",
    "id": "bss-agent-v2"
  },
  "data": {
    "plan_id": "bss-plan-togo-7day-barebone-plan3",
    "success": true,
    "signals": ["CUSTOMER_IDENTIFIED_SUCCESS"],
    "metadata": {
      "customer_id": "customer-togo-001",
      "identification_method": "QR_CODE",
      "service_plan_data": {
        "servicePlanId": "bss-plan-togo-7day-barebone-plan3",
        "customerId": "customer-togo-001",
        "status": "ACTIVE",
        "serviceState": "BATTERY_ISSUED",
        "paymentState": "RENEWAL_DUE",
        "templateId": "template-togo-lome-7day-barebone-v3",
        "currency": "XOF",
        "serviceStates": [
          {
            "service_id": "service-swap-station-network-togo-lome",
            "used": 0,
            "quota": 10000000,
            "current_asset": null
          },
          {
            "service_id": "service-battery-fleet-togo-lome",
            "used": 0,
            "quota": 10000000,
            "current_asset": "B0723025100049"
          },
          {
            "service_id": "service-electricity-togo-1",
            "used": 300,
            "quota": 300,
            "current_asset": null
          },
          {
            "service_id": "service-swap-count-togo-2",
            "used": 2,
            "quota": 10000000,
            "current_asset": null
          }
        ],
        "quotaUsed": 302,
        "quotaLimit": 30000300
      },
      "service_bundle": {
        "bundleId": "bundle-togo-7day-barebone-2",
        "name": "Togo 7-Day Bare-bone Bundle",
        "services": [
          {
            "serviceId": "service-battery-fleet-togo-lome",
            "name": "Togo Lome Battery Fleet Access",
            "usageUnitPrice": 0
          },
          {
            "serviceId": "service-electricity-togo-1",
            "name": "Togo Electricity Service",
            "usageUnit": "kWh",
            "usageUnitPrice": 0.1
          },
          {
            "serviceId": "service-swap-count-togo-2",
            "name": "Togo Swap Count Service",
            "usageUnit": "swaps"
          }
        ]
      },
      "common_terms": {
        "serviceDurationDays": 7,
        "billingCycle": "WEEKLY",
        "billingCurrency": "XOF"
      }
    }
  }
}
```

### Data Extraction from MQTT Response

| UI Element | Data Path | Example Value |
|------------|-----------|---------------|
| **Plan Name** | `metadata.service_bundle.name` | "Togo 7-Day Bare-bone Bundle" |
| **Plan Status** | `metadata.service_plan_data.status` | "ACTIVE" |
| **Service State** | `metadata.service_plan_data.serviceState` | "BATTERY_ISSUED" |
| **Payment State** | `metadata.service_plan_data.paymentState` | "RENEWAL_DUE" |
| **Currency** | `metadata.service_plan_data.currency` | "XOF" |
| **Current Battery** | `serviceStates[battery-fleet].current_asset` | "B0723025100049" |
| **Swap Count** | `serviceStates[swap-count].used` | 2 |
| **Electricity Used** | `serviceStates[electricity].used` | 300 kWh |
| **Electricity Quota** | `serviceStates[electricity].quota` | 300 kWh |
| **Plan Duration** | `common_terms.serviceDurationDays` | 7 days |
| **Billing Cycle** | `common_terms.billingCycle` | "WEEKLY" |

---

## Summary: Data Source Mapping

### ✅ Available Data Sources

| Data Need | Source | Status |
|-----------|--------|--------|
| User Authentication | REST `/auth/login` | ✅ Available |
| User Registration | REST `/auth/register` | ✅ Available |
| Subscription List | REST `/customer/dashboard` | ✅ Available |
| Plan Status | MQTT `identify_customer` | ✅ Available |
| Current Battery ID | MQTT `identify_customer` | ✅ Available |
| Swap Count | MQTT `identify_customer` | ✅ Available |
| Electricity Usage | MQTT `identify_customer` | ✅ Available |
| Plan Duration | MQTT `identify_customer` | ✅ Available |
| Service Bundle Details | MQTT `identify_customer` | ✅ Available |
| Payment State | MQTT `identify_customer` | ✅ Available |
| Support Tickets | REST `/support/tickets` | ✅ Available |

### ⚠️ Still Missing / Unclear

| Data Need | Notes | Priority |
|-----------|-------|----------|
| **Swap History** | List of individual swap transactions with dates, stations, battery IDs | High |
| **Payment History** | List of payment transactions (not just current payment state) | High |
| **Account Balance (Money)** | XOF balance that can be topped up (not usage quotas) | High |
| **Nearby Stations** | Station locations, battery availability, wait times | High |
| **Vehicle Details** | Bike model, registration, image | Medium |
| **Top-up API** | Endpoint to add balance via mobile money | Medium |

---

## Recommended MQTT Topics to Add

Based on the existing architecture, these MQTT events would complete the rider experience:

### 1. Get Swap History
**Topic:** `emit/uxi/rider/plan/{plan_id}/swap_history`

**Expected Response:**
```json
{
  "data": {
    "swaps": [
      {
        "swap_id": "swap-001",
        "timestamp": "2025-11-29T14:27:06.815Z",
        "station_id": "station-lome-central",
        "station_name": "Lome Central Station",
        "old_battery_id": "B0723025100048",
        "new_battery_id": "B0723025100049",
        "electricity_consumed": 45,
        "swap_cost": 0
      }
    ]
  }
}
```

### 2. Get Nearby Stations
**Topic:** `emit/uxi/rider/stations/nearby`

**Request:**
```json
{
  "data": {
    "latitude": 6.1319,
    "longitude": 1.2228,
    "radius_km": 10,
    "network_id": "togo-lome-network"
  }
}
```

**Expected Response:**
```json
{
  "data": {
    "stations": [
      {
        "station_id": "station-lome-central",
        "name": "Lome Central Station",
        "address": "Rue du Commerce, Lome",
        "latitude": 6.1375,
        "longitude": 1.2123,
        "distance_km": 0.8,
        "batteries_available": 12,
        "estimated_wait_time": "~3 min",
        "operating_hours": "24/7",
        "status": "OPEN"
      }
    ]
  }
}
```

### 3. Get Balance & Top-up
**Topic:** `emit/uxi/rider/plan/{plan_id}/balance`

**Expected Response:**
```json
{
  "data": {
    "money_balance": 3100,
    "currency": "XOF",
    "last_topup": "2025-11-28T10:00:00Z",
    "payment_methods": [
      {"type": "MTN_MOMO", "phone": "+228 91 234 567", "default": true}
    ]
  }
}
```

---

## UI to Data Mapping

| Rider App Screen | Data Source | Implementation Status |
|-----------------|-------------|----------------------|
| **Home - Greeting** | REST login response (user name) | ✅ Implemented |
| **Home - Bike Card** | MQTT identify (battery ID) + need vehicle API | ⚠️ Partial |
| **Home - Balance Card** | Need dedicated balance endpoint | ⚠️ Mock data |
| **Home - Nearby Stations** | Need stations endpoint | ⚠️ Mock data |
| **Activity - Swap List** | Need swap history endpoint | ⚠️ Mock data |
| **Activity - Payment List** | Need payment history endpoint | ⚠️ Mock data |
| **Stations - Map View** | Need stations endpoint | ⚠️ Mock data |
| **Profile - Plan Info** | MQTT identify (plan details) | ✅ Available |
| **Profile - Swap Count** | MQTT identify (serviceStates) | ✅ Available |

---

## Integration Notes

1. **After Login Flow:**
   - User logs in via REST API → Get session token + subscription IDs
   - Use subscription ID (plan_id) to emit `identify_customer` via MQTT
   - Parse response to populate dashboard with real-time data

2. **Data Refresh:**
   - Subscribe to MQTT topics for real-time updates
   - Poll REST endpoints for less time-sensitive data

3. **Current Battery Display:**
   - Extract from `serviceStates` where `service_id` contains "battery-fleet"
   - `current_asset` field contains the battery ID (e.g., "B0723025100049")
