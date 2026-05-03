# Applet Visibility — How Signup & Service Accounts Drive the Frontend

> **Target audience:** Portal / back-office developers who need to understand what controls which applets an employee sees after logging in.

---

## Glossary

| Term | Meaning |
|------|---------|
| **SA** | **Service Account** — a logical account grouping (e.g. a branch, partner, or business unit) that an employee can be a member of. One employee can belong to multiple SAs. |
| **Applet** | A functional module (e.g. `rider`, `orders`, `attendant`). Represented on the frontend as a tile in the role grid and as menu items in the sidebar. |
| **Applet slug** | A short, lowercase string that identifies an applet (e.g. `"customer-management"`, `"assets"`). The backend stores these on each SA; the frontend maps them to UI components. |

> **Note on "signup":** The word *signup* appears in the codebase in pricing/subscription contexts only (`price_at_signup` on customer/rider records). It has **no effect** on applet visibility. Applet access is controlled entirely by the **Service Account** the employee selects after login.

---

## High-Level Data Flow

```
Employee login (email/password  OR  Microsoft SSO)
        │
        ▼
Odoo REST API  ──────────────────────────────────────────────────────────────────
POST /api/employee/login                         GET /api/me/service-accounts
        │                                                    │
        │   OdooLoginResponse                                │  (used after MS SSO
        │   └─ session                                       │   when session_data
        │       ├─ token                                     │   is not embedded)
        │       ├─ employee { id, name, email, … }           │
        │       ├─ auto_selected                             │
        │       └─ service_accounts[]  ◄────────────────────┘
        │             └─ ServiceAccount
        │                 ├─ id
        │                 ├─ name
        │                 ├─ my_role  ('admin' | 'staff' | 'agent')
        │                 └─ applets  ['rider', 'orders', …]   ← KEY FIELD
        │
        ▼
saveOdooEmployeeSession()  (src/lib/ov-auth.ts)
  • localStorage['ov-employee-token']          = token
  • localStorage['ov-service-accounts']        = JSON array of SAs
  • localStorage['ov_sa_applets_<SA id>']      = JSON array of slugs  (one key per SA)
  • If auto_selected && exactly 1 SA → calls selectServiceAccount() immediately
        │
        ▼
User picks an SA  (SelectSA screen — src/components/roles/SelectSA.tsx)
  → selectServiceAccount(sa)
        • localStorage['ov-selected-sa-id']    = chosen SA's id
        • Mirrors token into legacy keys (oves-attendant-token, oves-sales-token, …)
        │
        ▼
SelectRole screen  (src/components/roles/SelectRole.tsx)
  → getActiveSAApplets()
        • Reads localStorage['ov-selected-sa-id']
        • Reads localStorage['ov_sa_applets_<id>']  → string[]
  → Filters ALL_ROLES by slug membership  →  visible role tiles
        │
        ▼
Sidebar  (src/components/sidebar/sidebar.tsx)
  → useMenuVisibility()  (src/lib/auth.tsx)
        • Same getActiveSAApplets() call
        • Maps slugs → sidebar menu IDs via APPLET_MENU_IDS
```

---

## Step-by-Step Detail

### 1. Login — Where Applets Come From

Two login paths both eventually produce the same `ServiceAccount[]` shape.

**Path A — Email / phone login**

```
POST https://crm-omnivoltaic.odoo.com/api/employee/login
Body: { email, password }  (or { phone, password })
```

The response (`OdooLoginResponse`) contains a `session` object. Each item in `session.service_accounts` carries an `applets` array:

```json
{
  "success": true,
  "session": {
    "token": "<bearer>",
    "expires_at": "2026-05-10T...",
    "auto_selected": false,
    "service_accounts": [
      {
        "id": 42,
        "name": "Nairobi Branch",
        "my_role": "staff",
        "applets": ["rider", "keypad", "attendant"]
      },
      {
        "id": 17,
        "name": "Mombasa Ops",
        "my_role": "admin",
        "applets": ["customer-management", "orders", "products", "assets"]
      }
    ]
  }
}
```

**Path B — Microsoft SSO**

The OAuth redirect lands back on the root page (`src/app/page.tsx`) with URL params including an optional `session_data` param (a base64-encoded `OdooEmployeeSession` JSON blob). If present, it is decoded and fed into `saveOdooEmployeeSession()` — identical to Path A. If absent, `GET /api/me/service-accounts` is called lazily by `SelectSA` via `fetchAndCacheServiceAccounts()`.

### 2. Caching — localStorage Layout

`saveOdooEmployeeSession()` writes one key **per SA** so applet lookups are zero-round-trip:

| Key | Value |
|-----|-------|
| `ov-employee-token` | Bearer token string |
| `ov-employee-data` | Employee JSON (`{id, name, email, …}`) |
| `ov-employee-token-expires` | ISO expiry timestamp |
| `ov-service-accounts` | Full `ServiceAccount[]` JSON |
| `ov_sa_applets_<id>` | `string[]` of applet slugs for that SA (one key per SA) |
| `ov-selected-sa-id` | ID of the SA the employee chose (set at SA selection, not login) |

### 3. SA Selection

`SelectSA` lists all `service_accounts` stored locally (or fetched live after MS SSO). Each card shows an **app count** badge (`sa.applets.length`). When the employee taps a card:

- `selectServiceAccount(sa)` writes `ov-selected-sa-id`.
- It also mirrors the token into legacy keys (`oves-attendant-token`, `oves-sales-token`, etc.) so individual applets that have their own auth checks continue to work without requiring a separate login.
- Auto-selection bypasses this screen entirely when: the login response sets `auto_selected = true` **and** the employee has exactly one SA.

### 4. Applet Grid — `SelectRole`

`SelectRole` (`src/components/roles/SelectRole.tsx`) is the home screen after an SA is selected.

**Static role registry (`ALL_ROLES`):**

| Role ID | Label | Applet Slug | Path |
|---------|-------|-------------|------|
| `customerManagement` | Customer Management | `customer-management` | `/customer-management` |
| `products` | Products | `products` | `/products` |
| `orders` | Orders | `orders` | `/orders` |
| `rider` | Rider | `rider` | `/rider/app` |
| `activator` | Activator | `activator` | `/activator` |
| `sales` | Sales Rep | `customers` | `/customers/customerform` |
| `attendant` | Attendant | `attendant` | `/attendant/attendant` |
| `keypad` | Keypad | `keypad` | `/keypad/keypad` |
| `bleDeviceManager` | BLE Device Manager | `assets` | `/assets/ble-devices` |

**Filtering logic (runs once on mount):**

```ts
const saApplets = getActiveSAApplets();   // reads localStorage

if (saApplets.length === 0) {
  // Graceful degradation: show every role.
  // This triggers if no SA is selected or the cache entry is missing.
  return ALL_ROLES;
}

return ALL_ROLES.filter(role => {
  const slug = role.appletSlug ?? APPLET_SLUG_MAP[role.id];
  if (!slug) return true;          // roles without a slug are always visible
  return saApplets.includes(slug); // show only slugs granted by the SA
});
```

**Effect:** The employee sees only the tiles whose slug appears in the selected SA's `applets` array.

> **Known limitation:** `visibleRoles` is computed with an empty dependency array (`useMemo(() => …, [])`), meaning the list is fixed at the time `SelectRole` first mounts. Switching SAs without remounting this component (e.g. via back-navigation) can show a stale grid. A full remount or navigation reset resolves this.

### 5. Sidebar Menu Visibility — `useMenuVisibility`

The sidebar uses `useMenuVisibility()` (`src/lib/auth.tsx`) to decide which menu items to render.

**`APPLET_MENU_IDS` mapping:**

| Applet slug | Sidebar menu IDs unlocked |
|-------------|--------------------------|
| `assets` | `assets`, `bledevices`, `fleetview`, `devicelocator` |
| `mydevices` | `mydevices`, `devices` |
| `ota` | `ota`, `deviceota`, `upload` |
| `keypad` | `keypad` |
| `rider` | `rider`, `app`, `serviceplan1` |
| `attendant` | `attendant` |
| `customers` | `customers`, `myportfolio`, `payments` |
| `customer-management` | `customer-management` |
| `orders` | `orders` |
| `products` | `products` |
| `activator` | `activator` |
| `ticketing` | `ticketing`, `support` |
| `location` | `location`, `routes` |

**Always-visible menu IDs** (regardless of applets): `logout`, `myaccount`, `resetpassword`, `settings`, and the three dividers.

**Legacy fallback:** When `getActiveSAApplets()` returns an empty array (no SA in cache), the hook falls back to a JWT `roleName`-based permission set (`SUPER_ADMIN`, `DISTRIBUTOR`, `GENERAL_AGENT`, `CUSTOMER`).

### 6. Logout / Session Clearing

`clearOdooEmployeeSession()` removes all `ov-*` keys **and** all `ov_sa_applets_*` keys (iterated dynamically), then calls the legacy clear helpers so per-applet auth checks also reset.

---

## What the Portal Needs to Control

From the portal's perspective, applet access is managed entirely via the **`applets` field on each Service Account** in Odoo. To give or restrict an employee's access to a module:

1. **Add or remove a slug** from the SA's `applets` list in Odoo.
2. The change takes effect the next time the employee logs in (or calls `/api/me/service-accounts`).
3. No code change is needed on the frontend — the slug mapping is already in place.

### Supported slug values (frontend-registered)

```
customer-management   products   orders   rider   activator
customers             attendant  keypad   assets
mydevices             ota        ticketing   location
```

Any slug not in the above list is fetched and cached correctly but will not surface a tile or sidebar entry until a corresponding entry is added to `ALL_ROLES` / `APPLET_MENU_IDS` in the frontend.

---

## Relevant Source Files

| File | Purpose |
|------|---------|
| `src/lib/sa-types.ts` | TypeScript types: `ServiceAccount`, `OdooEmployeeSession`, `OdooLoginResponse` |
| `src/lib/ov-auth.ts` | Login call, session persistence, `getActiveSAApplets()`, `selectServiceAccount()`, logout |
| `src/components/roles/SelectRole.tsx` | Applet grid — `ALL_ROLES`, `APPLET_SLUG_MAP`, `visibleRoles` filter |
| `src/components/roles/SelectSA.tsx` | SA picker screen; shows applet count per SA |
| `src/lib/auth.tsx` | `useMenuVisibility()`, `APPLET_MENU_IDS`, legacy JWT fallback |
| `src/app/page.tsx` | Root app shell — routes between splash, SA picker, and role grid |
