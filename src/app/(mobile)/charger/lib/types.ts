/** Shared shapes for the Charger Control applet. */

export interface GattCharacteristic {
  name: string;
  uuid: string;
  realVal?: unknown;
}

export interface GattService {
  serviceNameEnum?: string;
  uuid: string;
  characteristicList?: GattCharacteristic[];
}

/** A charger the operator has connected to, with its control service loaded. */
export interface ConnectedCharger {
  macAddress: string;
  name: string;
  controlService: GattService;
}

/**
 * A payment the rider has made on their phone, verified by Odoo and credited
 * to ABS. Its presence is what authorises dispensing — the dispense step never
 * moves money itself, so once this exists the rider has paid and any retry is
 * a retry of the BLE write alone.
 */
export interface PaidCharge {
  /** Mobile-money receipt / trade number. Doubles as the ABS idempotency key. */
  receipt: string;
  paymentMethod: string;
  orderId: number;
  /** Amount Odoo confirmed as paid — not necessarily the plan's list price. */
  totalPaid: number;
  quotaBefore: number;
  quotaAfter: number;
  /** True when ABS reported this credit had already been applied. */
  wasRetry: boolean;
}
