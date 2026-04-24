/**
 * Domain types for the Rider app.
 *
 * These types are used across the Rider shell, hooks, and components.
 * Kept in one place so callers don't duplicate shapes.
 */

export interface RiderCustomer {
  id: number;
  name: string;
  email: string;
  phone: string;
  partner_id?: number;
  company_id?: number;
}

export type SubscriptionStatus = 'active' | 'inactive' | 'pending' | 'overdue' | string;

export interface RiderSubscription {
  id: number;
  subscription_code: string;
  status: SubscriptionStatus;
  product_id: number;
  product_name: string;
  price?: number;
  price_at_signup?: number;
  currency?: string;
  currency_symbol?: string;
  start_date?: string;
  next_cycle_date?: string;
  cycle_interval?: number;
  cycle_unit?: string;
  create_date?: string;
}

export type PaymentState =
  | 'PAID'
  | 'RENEWAL_DUE'
  | 'OVERDUE'
  | 'PENDING'
  | 'active'
  | 'inactive'
  | string;

export interface RiderBikeInfo {
  model: string;
  vehicleId: string | null;
  totalSwaps: number;
  lastSwap: string | null;
  paymentState: PaymentState;
  currentBatteryId?: string;
  imageUrl?: string;
}

export interface RiderStation {
  id: number;
  name: string;
  address?: string;
  distance: string;
  batteries: number;
  batteriesTotal?: number;
  waitTime?: string;
  lat?: number;
  lng?: number;
  fleetId?: string;
}

export interface RiderActivityItem {
  id: string;
  type: 'swap' | 'topup' | 'payment';
  title: string;
  subtitle: string;
  amount: number;
  currency?: string;
  isPositive?: boolean;
  time: string;
  date: string;
}

export interface RiderTicket {
  id: number;
  number: string;
  subject: string;
  description?: string;
  priority: string;
  partner_id: number;
  customer: string;
  create_date: string;
  state?: string;
}

export interface GeoLocation {
  lat: number;
  lng: number;
  heading?: number | null;
  accuracy?: number;
}

/**
 * High-level navigation state for the rider's stations map.
 *
 * - `idle`      No destination chosen. Map behaves like a regular explorer
 *               map (rider drags/zooms freely, camera never auto-moves).
 * - `preview`   A destination is set and the route is visible on the map,
 *               but the rider hasn't started navigating yet. The camera is
 *               fit to the full route once, then stays put. Rider can
 *               change destination or cancel freely.
 * - `following` Turn-by-turn-style follow mode. The camera tracks the
 *               rider's live location, rotates with heading, and tilts
 *               into a "driving perspective". User drag/zoom gestures
 *               temporarily pause the auto-follow until Recenter is
 *               tapped; tapping End exits back to idle.
 */
export type NavMode = 'idle' | 'preview' | 'following';

export type RiderScreen =
  | 'home'
  | 'stations'
  | 'activity'
  | 'profile'
  | 'selectSubscription'
  | 'transactions'
  | 'plans'
  | 'tickets'
  | 'paymentQR';
