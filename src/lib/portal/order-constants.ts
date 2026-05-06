import type { OrderEntity, DeliveryState } from './types';

export interface PipelineStep {
  label: string;
  iconName: string;
}

export const PIPELINE_STEPS: PipelineStep[] = [
  { label: 'Quotation', iconName: 'ClipboardList' },
  { label: 'Revise',    iconName: 'RefreshCw'    },
  { label: 'Approval',  iconName: 'ShieldCheck'  },
  { label: 'Delivery',  iconName: 'Truck'        },
  { label: 'Payment',   iconName: 'CreditCard'   },
  { label: 'Invoice',   iconName: 'FileCheck'    },
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
  if (order.state === 'draft') return 0;

  if (order.state === 'sent') {
    if (order.approvalStatus === 'rejected') return 1;
    if (order.approvalStatus === 'pending') return 2;
    return 1;
  }

  if (order.state === 'sale' || order.state === 'done') {
    if (order.paymentStatus === 'paid') return 5;
    if (order.paymentStatus === 'partial') return 4;
    if (order.approvalStatus === 'approved') {
      // After approval: show Delivery step unless delivery is complete
      return isDeliveryDone(order) ? 4 : 3;
    }
    if (order.approvalStatus === 'rejected') return 1;
    if (order.approvalStatus === 'pending') return 2;
    // Confirmed but no explicit approval recorded — go to Delivery
    return 3;
  }

  if (order.approvalStatus === 'approved') return 3;
  if (order.approvalStatus === 'pending') return 2;

  return 0;
}

export const STEP_ACTIONS: { backLabel: string; nextLabel: string }[] = [
  { backLabel: '',          nextLabel: 'Confirm Order'                 },
  { backLabel: 'Quotation', nextLabel: 'Confirm & Submit for Approval' },
  { backLabel: 'Revise',    nextLabel: ''                              },
  { backLabel: 'Approval',  nextLabel: ''                              }, // delivery action handled inline
  { backLabel: 'Delivery',  nextLabel: 'Create Final Invoice'          },
  { backLabel: 'Payment',   nextLabel: 'Order Complete'                },
];
