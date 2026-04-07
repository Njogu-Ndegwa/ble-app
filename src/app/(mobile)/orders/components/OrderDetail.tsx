'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ClipboardList,
  RefreshCw,
  ShieldCheck,
  CreditCard,
  FileCheck,
  User,
  Package,
  ArrowLeft,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { StepProgress } from '@/components/ui/Progress';
import { LoadingState } from '@/components/ui/State';
import {
  getOrder,
  sendOrder as restSendOrder,
  confirmOrder as restConfirmOrder,
  requestApproval as restRequestApproval,
  approveOrder as restApproveOrder,
  rejectOrder as restRejectOrder,
  registerPayment as restRegisterPayment,
  formatCurrency,
} from '@/lib/portal/order-api';
import {
  PIPELINE_STEPS,
  getOrderStepIndex,
  STEP_ACTIONS,
} from '@/lib/portal/order-constants';
import type { OrderEntity, PaymentStatus } from '@/lib/portal/types';

const STEP_ICONS = [ClipboardList, RefreshCw, ShieldCheck, CreditCard, FileCheck];

const STATE_BADGES: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'list-card-badge list-card-badge--default' },
  sent: { label: 'Sent', cls: 'list-card-badge list-card-badge--progress' },
  sale: { label: 'Confirmed', cls: 'list-card-badge list-card-badge--completed' },
  done: { label: 'Done', cls: 'list-card-badge list-card-badge--completed' },
  cancel: { label: 'Cancelled', cls: 'list-card-badge list-card-badge--default' },
};

interface OrderDetailProps {
  orderId: number;
  onBack: () => void;
}

export default function OrderDetail({ orderId, onBack }: OrderDetailProps) {
  const [order, setOrder] = useState<OrderEntity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [backendStep, setBackendStep] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);

  const [payAmount, setPayAmount] = useState('');
  const [payMemo, setPayMemo] = useState('');
  const [approvalNotes, setApprovalNotes] = useState('');

  const fetchOrderData = useCallback(async () => {
    try {
      const data = await getOrder(orderId);
      setOrder(data);
      const step = getOrderStepIndex(data);
      setBackendStep(step);
      setActiveStep(step);
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load order.');
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrderData();
  }, [fetchOrderData]);

  const refreshOrder = useCallback(
    async (minStep?: number) => {
      try {
        const fresh = await getOrder(orderId);
        setOrder(fresh);
        const computed = getOrderStepIndex(fresh);
        const step = minStep != null ? Math.max(minStep, computed) : computed;
        setBackendStep(step);
        setActiveStep(step);
      } catch {
        /* keep current */
      }
    },
    [orderId],
  );

  const handleAction = useCallback(
    async (actionFn: () => Promise<any>, successMsg: string, minStep?: number) => {
      setActionLoading(true);
      try {
        await actionFn();
        toast.success(successMsg);
        await refreshOrder(minStep);
      } catch (err: any) {
        toast.error(err?.message ?? 'Operation failed');
      } finally {
        setActionLoading(false);
      }
    },
    [refreshOrder],
  );

  const handleSend = useCallback(() => {
    return handleAction(() => restSendOrder(orderId), 'Quotation sent.', 1);
  }, [handleAction, orderId]);

  const handleConfirm = useCallback(() => {
    return handleAction(
      async () => {
        await restConfirmOrder(orderId);
        await restRequestApproval(orderId);
      },
      'Order confirmed & submitted for approval.',
      2,
    );
  }, [handleAction, orderId]);

  const handleApprove = useCallback(() => {
    return handleAction(
      () => restApproveOrder(orderId, approvalNotes || undefined),
      'Order approved.',
    );
  }, [handleAction, orderId, approvalNotes]);

  const handleReject = useCallback(() => {
    return handleAction(
      () => restRejectOrder(orderId, approvalNotes || undefined),
      'Order rejected.',
    );
  }, [handleAction, orderId, approvalNotes]);

  const handleRegisterPayment = useCallback(async () => {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) {
      toast.error('Enter a valid payment amount.');
      return;
    }
    setActionLoading(true);
    try {
      const result = await restRegisterPayment(orderId, amount, payMemo || undefined);
      toast.success('Payment registered.');

      let updated: OrderEntity;
      try {
        updated = await getOrder(orderId);
      } catch {
        updated = { ...order! };
      }

      if (result.orderPaymentStatus) {
        updated.paymentStatus = result.orderPaymentStatus as PaymentStatus;
      }
      if (result.paidAmount != null) updated.paidAmount = result.paidAmount;
      if (result.remainingAmount != null) updated.remainingAmount = result.remainingAmount;

      setOrder(updated);
      const computed = getOrderStepIndex(updated);
      setBackendStep(computed);
      setActiveStep(computed);
      setPayAmount('');
      setPayMemo('');
    } catch (err: any) {
      toast.error(err?.message ?? 'Payment failed.');
    } finally {
      setActionLoading(false);
    }
  }, [orderId, payAmount, payMemo, order]);

  const handleStepAction = useCallback(async () => {
    switch (backendStep) {
      case 0:
        await handleSend();
        break;
      case 1:
        await handleConfirm();
        break;
      default:
        await refreshOrder();
        break;
    }
  }, [backendStep, handleSend, handleConfirm, refreshOrder]);

  if (loading) {
    return <LoadingState message="Loading order..." />;
  }

  if (error || !order) {
    return (
      <div className="p-4">
        <div
          className="rounded-xl p-4 text-sm"
          style={{ background: 'var(--color-error-soft)', color: 'var(--color-error)' }}
        >
          {error ?? 'Order not found.'}
        </div>
      </div>
    );
  }

  const st = STATE_BADGES[order.state] ?? STATE_BADGES.draft;
  const isViewingPastStep = activeStep < backendStep;
  const sa = STEP_ACTIONS[activeStep];
  const needsFullPayment = activeStep === 3 && order.paymentStatus !== 'paid';
  const nextDisabled = actionLoading || needsFullPayment;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-3 pb-2">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-lg hover:bg-bg-elevated transition-colors"
          aria-label="Back"
        >
          <ArrowLeft size={20} className="text-text-primary" />
        </button>
        <h2 className="text-lg font-semibold text-text-primary">{order.name}</h2>
        <span className="flex-1" />
        <span className={st.cls}>{st.label}</span>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {/* Order summary card */}
        <div className="rounded-xl border border-border bg-bg-tertiary p-4 mb-4">
          <p className="text-sm text-text-secondary mb-3">{order.partnerName}</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] uppercase font-medium text-text-muted">Total</p>
              <p className="text-sm font-bold text-text-primary" style={{ fontFamily: 'var(--font-mono)' }}>
                {formatCurrency(order.amountTotal)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-medium text-text-muted">Paid</p>
              <p className="text-sm font-bold" style={{ color: 'var(--color-success)', fontFamily: 'var(--font-mono)' }}>
                {formatCurrency(order.paidAmount)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-medium text-text-muted">Remaining</p>
              <p className="text-sm font-bold" style={{ color: 'var(--color-warning)', fontFamily: 'var(--font-mono)' }}>
                {formatCurrency(order.remainingAmount)}
              </p>
            </div>
          </div>
        </div>

        {/* Step progress bar */}
        <div className="mb-4">
          <StepProgress
            currentStep={activeStep + 1}
            totalSteps={PIPELINE_STEPS.length}
            showLabel
          />
        </div>

        {/* Pipeline step buttons */}
        <div className="rounded-xl border border-border bg-bg-tertiary p-3 mb-4">
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            {PIPELINE_STEPS.map((step, i) => {
              const Icon = STEP_ICONS[i];
              const isActive = i === activeStep;
              const isCompleted = i < backendStep;
              const isClickable = i <= backendStep;
              return (
                <button
                  key={i}
                  onClick={() => isClickable && setActiveStep(i)}
                  disabled={!isClickable}
                  className="flex flex-col items-center gap-1 px-2 py-2 rounded-lg min-w-[64px] text-center transition-all"
                  style={
                    isActive
                      ? { backgroundColor: 'var(--color-brand)', color: 'var(--text-inverse)' }
                      : isCompleted
                        ? { backgroundColor: 'var(--color-success-soft)', color: 'var(--color-success)' }
                        : { color: 'var(--text-muted)' }
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-[9px] font-medium leading-tight">{step.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step content */}
        <div className="rounded-xl border border-border bg-bg-tertiary overflow-hidden mb-4">
          {activeStep === 0 && (
            <div>
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <User size={15} className="text-text-muted" />
                <span className="text-sm font-semibold text-text-primary">Customer</span>
              </div>
              <div className="px-4 py-3">
                <p className="text-sm font-medium text-text-primary">{order.partnerName}</p>
                {order.partnerEmail && <p className="text-xs text-text-secondary">{order.partnerEmail}</p>}
                {order.partnerPhone && <p className="text-xs text-text-secondary">{order.partnerPhone}</p>}
              </div>
              <OrderLines lines={order.lines} />
            </div>
          )}

          {activeStep === 1 && (
            <div>
              <div className="px-4 py-3 border-b border-border">
                <span className="text-sm font-semibold text-text-primary">Revise & Confirm</span>
              </div>
              <OrderLines lines={order.lines} />
              <div className="px-4 py-3 border-t border-border">
                <OrderSummary order={order} />
              </div>
            </div>
          )}

          {activeStep === 2 && (
            <div className="p-4 space-y-3">
              <p className="text-sm font-semibold text-text-primary">Approval</p>
              {order.approvalStatus === 'pending' && (
                <div className="rounded-lg p-3 text-xs" style={{ background: 'var(--color-warning-soft)', color: 'var(--color-warning)' }}>
                  Awaiting approval from manager.
                </div>
              )}
              {order.approvalStatus === 'approved' && (
                <div className="rounded-lg p-3 text-xs" style={{ background: 'var(--color-success-soft)', color: 'var(--color-success)' }}>
                  Order has been approved.
                </div>
              )}
              {order.approvalStatus === 'rejected' && (
                <div className="rounded-lg p-3 text-xs" style={{ background: 'var(--color-error-soft)', color: 'var(--color-error)' }}>
                  Order was rejected. {order.approval?.notes && `Reason: ${order.approval.notes}`}
                </div>
              )}
              {!isViewingPastStep && order.approvalStatus === 'pending' && (
                <>
                  <textarea
                    placeholder="Approval notes (optional)..."
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-border bg-bg-tertiary p-2 text-sm text-text-primary outline-none resize-none placeholder:text-text-muted"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleApprove}
                      disabled={actionLoading}
                      className="flex-1 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                      style={{ backgroundColor: 'var(--color-success)' }}
                    >
                      Approve
                    </button>
                    <button
                      onClick={handleReject}
                      disabled={actionLoading}
                      className="flex-1 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                      style={{ backgroundColor: 'var(--color-error)' }}
                    >
                      Reject
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {activeStep === 3 && (
            <div className="p-4 space-y-3">
              <p className="text-sm font-semibold text-text-primary">Payment</p>
              <OrderSummary order={order} />
              {order.payments.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-text-secondary">Payment History</p>
                  {order.payments.map((pay) => (
                    <div key={pay.id} className="flex items-center justify-between rounded-lg p-2 border border-border text-xs">
                      <span className="text-text-primary" style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrency(pay.amount)}</span>
                      <span className="text-text-muted">{pay.paymentDate}</span>
                    </div>
                  ))}
                </div>
              )}
              {!isViewingPastStep && order.paymentStatus !== 'paid' && (
                <div className="space-y-2 pt-2 border-t border-border">
                  <input
                    type="number"
                    placeholder="Payment amount"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="w-full rounded-lg border border-border bg-bg-tertiary p-2.5 text-sm text-text-primary outline-none placeholder:text-text-muted"
                  />
                  <input
                    type="text"
                    placeholder="Memo (optional)"
                    value={payMemo}
                    onChange={(e) => setPayMemo(e.target.value)}
                    className="w-full rounded-lg border border-border bg-bg-tertiary p-2.5 text-sm text-text-primary outline-none placeholder:text-text-muted"
                  />
                  <button
                    onClick={handleRegisterPayment}
                    disabled={actionLoading}
                    style={{ backgroundColor: 'var(--color-brand)' }}
                    className="w-full py-2.5 rounded-lg text-sm font-medium text-black disabled:opacity-50"
                  >
                    {actionLoading ? 'Processing...' : 'Register Payment'}
                  </button>
                </div>
              )}
            </div>
          )}

          {activeStep === 4 && (
            <div className="p-4 space-y-3">
              <p className="text-sm font-semibold text-text-primary">Final Invoice</p>
              {order.invoices.length > 0 ? (
                <div className="space-y-2">
                  {order.invoices.map((inv) => (
                    <div key={inv.id} className="rounded-lg p-3 border border-border">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-text-primary">{inv.name}</span>
                        <span className={inv.state === 'posted' ? 'list-card-badge list-card-badge--completed' : 'list-card-badge list-card-badge--default'}>
                          {inv.state}
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary mt-1">
                        Total: {formatCurrency(inv.amountTotal)} · Residual: {formatCurrency(inv.amountResidual)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg p-3 text-xs text-center text-text-muted">
                  No invoices yet.
                </div>
              )}
              <OrderSummary order={order} />
            </div>
          )}
        </div>

        {/* Timeline */}
        {order.timeline.length > 0 && (
          <div className="rounded-xl border border-border bg-bg-tertiary p-4 mb-4">
            <p className="text-sm font-semibold text-text-primary mb-3">Timeline</p>
            <div className="space-y-3">
              {order.timeline.map((event, i) => (
                <div key={i} className="flex gap-3">
                  <div
                    className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                    style={{
                      backgroundColor:
                        event.color === 'green'
                          ? 'var(--color-success)'
                          : event.color === 'blue'
                            ? 'var(--color-info, #3b82f6)'
                            : event.color === 'orange'
                              ? 'var(--color-warning)'
                              : event.color === 'purple'
                                ? '#8b5cf6'
                                : 'var(--text-muted)',
                    }}
                  />
                  <div>
                    <p className="text-xs font-medium text-text-primary">{event.title}</p>
                    {event.description && <p className="text-[11px] text-text-secondary">{event.description}</p>}
                    <p className="text-[10px] text-text-muted">{event.meta}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom step navigation */}
      <div className="px-4 py-3 border-t border-border flex items-center justify-between gap-3">
        {activeStep > 0 ? (
          <button
            onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm border border-border text-text-secondary active:scale-[0.98] transition-transform"
          >
            <ChevronLeft size={16} />
            {PIPELINE_STEPS[activeStep - 1]?.label || 'Back'}
          </button>
        ) : (
          <div />
        )}

        {isViewingPastStep ? (
          <button
            onClick={() => setActiveStep(activeStep + 1)}
            style={{ backgroundColor: 'var(--color-brand)' }}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium text-black active:scale-[0.98] transition-transform"
          >
            {PIPELINE_STEPS[activeStep + 1]?.label ?? 'Next'}
            <ChevronRight size={16} />
          </button>
        ) : activeStep < 4 && sa.nextLabel ? (
          <button
            onClick={handleStepAction}
            disabled={nextDisabled}
            style={{ backgroundColor: 'var(--color-brand)' }}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium text-black disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            {actionLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                {sa.nextLabel}
                <ChevronRight size={16} />
              </>
            )}
          </button>
        ) : activeStep === 4 ? (
          <button
            onClick={onBack}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium text-white active:scale-[0.98] transition-transform"
            style={{ backgroundColor: 'var(--color-success)' }}
          >
            <CheckCircle2 size={16} />
            Done
          </button>
        ) : null}
      </div>
    </div>
  );
}

function OrderLines({ lines }: { lines: OrderEntity['lines'] }) {
  if (lines.length === 0) {
    return (
      <div className="px-4 py-6 text-center">
        <Package size={24} className="mx-auto mb-2 text-text-muted" />
        <p className="text-xs text-text-muted">No product lines.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <Package size={15} className="text-text-muted" />
        <span className="text-sm font-semibold text-text-primary">Lines ({lines.length})</span>
      </div>
      <div className="divide-y divide-border">
        {lines.map((line) => (
          <div key={line.id} className="px-4 py-3 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">{line.productName}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {line.sku && (
                  <span className="text-[10px] text-text-muted" style={{ fontFamily: 'var(--font-mono)' }}>
                    {line.sku}
                  </span>
                )}
                {line.puCategory && (
                  <span className={`list-card-badge ${line.puCategory === 'physical' ? 'list-card-badge--progress' : 'list-card-badge--default'}`}>
                    {line.puCategory}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right shrink-0 ml-3">
              <p className="text-sm font-semibold text-text-primary" style={{ fontFamily: 'var(--font-mono)' }}>
                {formatCurrency(line.priceSubtotal)}
              </p>
              <p className="text-[10px] text-text-muted" style={{ fontFamily: 'var(--font-mono)' }}>
                {line.quantity} x {formatCurrency(line.priceUnit)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OrderSummary({ order }: { order: OrderEntity }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-text-secondary">Subtotal</span>
        <span className="font-semibold text-text-primary" style={{ fontFamily: 'var(--font-mono)' }}>
          {formatCurrency(order.amountUntaxed)}
        </span>
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-text-secondary">Tax</span>
        <span className="font-semibold text-text-primary" style={{ fontFamily: 'var(--font-mono)' }}>
          {formatCurrency(order.amountTax)}
        </span>
      </div>
      <div className="flex justify-between text-sm pt-1.5 border-t border-border">
        <span className="font-bold text-text-primary">Total</span>
        <span className="font-bold" style={{ color: 'var(--color-success)', fontFamily: 'var(--font-mono)' }}>
          {formatCurrency(order.amountTotal)}
        </span>
      </div>
    </div>
  );
}
