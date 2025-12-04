# Rider App API Endpoints Documentation

This document outlines all the API endpoints consumed (or needed) throughout the rider workflow. The base URL is: `https://crm-omnivoltaic.odoo.com/api`

## Authentication Endpoints

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

## Summary of Endpoint Status

| Endpoint | Status | Notes |
|----------|--------|-------|
| POST /auth/login | ✅ Available | Working |
| POST /auth/register | ✅ Available | Working |
| POST /auth/change-password | ✅ Available | Working |
| GET /customer/dashboard | ✅ Available | Returns subscription data |
| GET /stations/nearby | ⚠️ Needed | Not implemented - using mock data |
| GET /stations/{id} | ⚠️ Needed | Not implemented |
| GET /customer/activity | ⚠️ Needed | Activity history - using mock |
| GET /customer/swaps | ⚠️ Needed | Swap history |
| GET /customer/payments | ⚠️ Needed | Payment history |
| POST /payments/verify | ⚠️ Needed | Transaction verification |
| POST /customer/topup | ⚠️ Needed | Balance top-up |
| GET /customer/vehicle | ⚠️ Needed | Vehicle details |
| GET /customer/subscription | ⚠️ Needed | Active subscription |
| GET /customer/balance | ⚠️ Needed | Account balance |
| POST /support/tickets | ✅ Available | Create support ticket |
| GET /support/tickets | ✅ Available | List tickets |

---

## Data Gaps Identified

1. **Payment Records**: No dedicated endpoint to fetch payment/transaction history for the rider
2. **Service Records (Swaps)**: No endpoint to fetch swap/service history
3. **Account Balance**: No dedicated endpoint for real-time balance
4. **Station Data**: No endpoint for nearby stations with live availability
5. **Vehicle Details**: No endpoint to fetch rider's assigned vehicle information

## Recommendations

1. Create `/customer/activity` endpoint that aggregates swaps, payments, and top-ups
2. Create `/customer/balance` endpoint for real-time balance
3. Create `/stations/nearby` endpoint with geolocation support
4. Extend `/customer/dashboard` to include:
   - Current balance
   - Vehicle info
   - Recent activity summary
   - Nearest station preview
