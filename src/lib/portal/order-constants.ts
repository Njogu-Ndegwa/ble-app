import type { OrderEntity } from './types';

export interface PipelineStep {
  label: string;
  iconName: string;
}

export const PIPELINE_STEPS: PipelineStep[] = [
  { label: 'Quotation', iconName: 'ClipboardList' },
  { label: 'Revise & Confirm', iconName: 'RefreshCw' },
  { label: 'Approval', iconName: 'ShieldCheck' },
  { label: 'Payment', iconName: 'CreditCard' },
  { label: 'Final Invoice', iconName: 'FileCheck' },
];

export function getOrderStepIndex(order: OrderEntity): number {
  if (order.state === 'draft') return 0;

  if (order.state === 'sent') {
    if (order.approvalStatus === 'rejected') return 1;
    if (order.approvalStatus === 'pending') return 2;
    return 1;
  }

  if (order.state === 'sale' || order.state === 'done') {
    if (order.paymentStatus === 'paid') return 4;
    if (order.paymentStatus === 'partial') return 3;
    if (order.approvalStatus === 'approved') return 3;
    if (order.approvalStatus === 'rejected') return 1;
    if (order.approvalStatus === 'pending') return 2;
    return 2;
  }

  if (order.approvalStatus === 'approved') return 3;
  if (order.approvalStatus === 'pending') return 2;

  return 0;
}

export const STEP_ACTIONS: { backLabel: string; nextLabel: string }[] = [
  { backLabel: '', nextLabel: 'Confirm Order' },
  { backLabel: 'Quotation', nextLabel: 'Confirm & Submit for Approval' },
  { backLabel: 'Revise & Confirm', nextLabel: '' },
  { backLabel: 'Approval', nextLabel: 'Create Final Invoice' },
  { backLabel: 'Payment', nextLabel: 'Order Complete' },
];
