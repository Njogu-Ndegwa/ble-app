import type { OrderEntity, DeliveryState } from './types';

export interface PipelineStep {
  label: string;
  iconName: string;
}

export const PIPELINE_STEPS: PipelineStep[] = [
  { label: 'Quotation', iconName: 'ClipboardList' },
  { label: 'Approval',  iconName: 'ShieldCheck'   },
  { label: 'Delivery',  iconName: 'Truck'          },
  { label: 'Invoice',   iconName: 'FileText'       },
  { label: 'Payment',   iconName: 'CreditCard'     },
];

// Delivery is "done" when every delivery on the order is in state 'done',
// OR when the order has no physical (storable) lines at all (service-only orders skip delivery).
export function isDeliveryDone(order: OrderEntity): boolean {
  if (!order.deliveries || order.deliveries.length === 0) {
    // No delivery created yet — assume it's pending if the order is confirmed
    if (order.state === 'sale' || order.state === 'done') return false;
    return true; // draft/sent orders: don't count against delivery
  }
  return order.deliveries.every(
    (d) => d.state === 'done' || d.state === 'cancel',
  );
}

export function getDeliveryState(order: OrderEntity): DeliveryState | null {
  if (!order.deliveries || order.deliveries.length === 0) return null;
  // Return the "worst" state (most pending)
  const priority: DeliveryState[] = ['waiting', 'confirmed', 'assigned', 'done', 'cancel', 'draft'];
  for (const s of priority) {
    if (order.deliveries.some((d) => d.state === s)) return s;
  }
  return order.deliveries[0].state;
}

export function getOrderStepIndex(order: OrderEntity): number {
  // Step 0 — draft/sent quotation with no approval action yet
  if (
    (order.state === 'draft' || order.state === 'sent') &&
    order.approvalStatus === 'none'
  ) return 0;

  // Step 1 — approval in flight (pending, approved-but-not-confirmed, or rejected)
  if (order.state === 'draft' || order.state === 'sent') return 1;

  // Order confirmed (state = sale / done)
  if (order.state === 'sale' || order.state === 'done') {
    if (order.paymentStatus === 'paid') return 4;
    if (order.invoices.some((inv) => inv.state === 'posted')) return 4; // payment step
    if (isDeliveryDone(order)) return 3;                                // invoice step
    return 2;                                                           // delivery step
  }

  return 0;
}
