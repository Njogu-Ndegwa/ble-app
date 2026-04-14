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
  Pencil,
  X,
  Download,
  Mail,
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
  sendProformaPdf as restSendProforma,
  formatCurrency,
} from '@/lib/portal/order-api';
import {
  PIPELINE_STEPS,
  getOrderStepIndex,
  STEP_ACTIONS,
} from '@/lib/portal/order-constants';
import type { OrderEntity, OrderLineEntity, PaymentStatus } from '@/lib/portal/types';

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

  // Editable lines state for the Revise & Confirm step
  const [editableLines, setEditableLines] = useState<OrderLineEntity[]>([]);

  // PDF download state
  const [pdfLoading, setPdfLoading] = useState<'proforma' | 'invoice' | null>(null);
  const [sendingProforma, setSendingProforma] = useState(false);

  const fetchOrderData = useCallback(async () => {
    try {
      const data = await getOrder(orderId);
      setOrder(data);
      setEditableLines(data.lines.map((l) => ({ ...l })));
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
        setEditableLines(fresh.lines.map((l) => ({ ...l })));
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
      } catch (err: any) {
        toast.error(err?.message ?? 'Operation failed');
        setActionLoading(false);
        return;
      }
      toast.success(successMsg);
      try {
        await new Promise((r) => setTimeout(r, 800));
        await refreshOrder(minStep);
      } catch {
        try {
          await new Promise((r) => setTimeout(r, 2000));
          await refreshOrder(minStep);
        } catch {
          /* action succeeded; user can pull-to-refresh or navigate back */
        }
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

  // Editable lines handlers
  const handleLineChange = useCallback(
    (lineId: string, field: 'quantity' | 'priceUnit', value: number) => {
      setEditableLines((prev) =>
        prev.map((l) =>
          l.id === lineId
            ? {
                ...l,
                [field]: value,
                priceSubtotal: field === 'quantity' ? l.priceUnit * value : value * l.quantity,
              }
            : l,
        ),
      );
    },
    [],
  );

  const handleRemoveLine = useCallback((lineId: string) => {
    setEditableLines((prev) => prev.filter((l) => l.id !== lineId));
  }, []);

  // PDF download handlers
  const handleDownloadPdf = useCallback(
    async (type: 'proforma' | 'invoice') => {
      if (!order) return;
      setPdfLoading(type);
      try {
        const { generateInvoicePdf } = await import('@/lib/portal/generate-invoice-pdf');
        await generateInvoicePdf(order, type, '/assets/Logo-Oves.png');
        toast.success(`${type === 'proforma' ? 'Proforma invoice' : 'Invoice'} downloaded.`);
      } catch (err: any) {
        toast.error(`Failed to generate PDF: ${err?.message ?? 'Unknown error'}`);
      } finally {
        setPdfLoading(null);
      }
    },
    [order],
  );

  const handleSendProforma = useCallback(async () => {
    setSendingProforma(true);
    try {
      const res = await restSendProforma(orderId);
      if (!res.success) throw new Error(res.message ?? 'Failed to send proforma');
      toast.success('Proforma invoice sent to customer.');
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to send proforma.');
    } finally {
      setSendingProforma(false);
    }
  }, [orderId]);

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
  const isReviseEditable = activeStep === 1 && !isViewingPastStep;

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
                  <span className="text-[9px] font-medium leading-tight max-w-full truncate">{step.label}</span>
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
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <span className="text-sm font-semibold text-text-primary">Revise & Confirm</span>
                {isReviseEditable && (
                  <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: 'var(--color-brand-soft, rgba(255,200,0,0.15))', color: 'var(--color-brand)' }}>
                    <Pencil size={10} /> Editable
                  </span>
                )}
                {isViewingPastStep && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full text-text-muted"
                    style={{ backgroundColor: 'var(--bg-elevated)' }}>
                    Read-only
                  </span>
                )}
              </div>

              {isReviseEditable && order.approvalStatus === 'rejected' && order.approval && (
                <div className="mx-4 mt-3 rounded-lg p-3 text-xs"
                  style={{ background: 'var(--color-error-soft)', color: 'var(--color-error)' }}>
                  <span className="font-semibold">Rejected</span>
                  {order.approval.approvedBy && ` by ${order.approval.approvedBy}`}.
                  {order.approval.notes && ` Reason: "${order.approval.notes}"`}
                  {' '}Please revise and re-confirm.
                </div>
              )}

              {isReviseEditable && order.approvalStatus !== 'rejected' && (
                <div className="mx-4 mt-3 rounded-lg p-3 text-xs flex items-start gap-2"
                  style={{ background: 'var(--color-brand-soft, rgba(255,200,0,0.1))', color: 'var(--text-primary)' }}>
                  <Pencil size={14} className="shrink-0 mt-0.5" style={{ color: 'var(--color-brand)' }} />
                  <span>
                    Quotation is <strong>editable</strong>. Update quantities and prices below, then tap <strong>Confirm</strong>.
                  </span>
                </div>
              )}

              {isReviseEditable ? (
                <EditableOrderLines
                  lines={editableLines}
                  onLineChange={handleLineChange}
                  onRemoveLine={handleRemoveLine}
                />
              ) : (
                <OrderLines lines={order.lines} />
              )}

              <div className="px-4 py-3 border-t border-border">
                <OrderSummary order={order} />
              </div>
            </div>
          )}

          {activeStep === 2 && (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-text-primary">Approval</p>
                {(order.approvalStatus === 'approved' || order.approvalStatus === 'pending') && (
                  <button
                    onClick={() => handleDownloadPdf('proforma')}
                    disabled={!!pdfLoading}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border border-border text-text-secondary active:scale-[0.97] transition-transform disabled:opacity-50"
                  >
                    {pdfLoading === 'proforma' ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Download size={12} />
                    )}
                    Proforma PDF
                  </button>
                )}
              </div>

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

              {order.approvalStatus === 'approved' && !isViewingPastStep && (
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleSendProforma}
                    disabled={sendingProforma}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                    style={{ backgroundColor: 'var(--color-brand)' }}
                  >
                    {sendingProforma ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                    Email to Customer
                  </button>
                  <button
                    onClick={() => handleDownloadPdf('proforma')}
                    disabled={!!pdfLoading}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-border text-text-secondary disabled:opacity-50"
                  >
                    {pdfLoading === 'proforma' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                    PDF
                  </button>
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
            <div className="space-y-3">
              <OrderLines lines={order.lines} />
              <div className="px-4">
                <OrderSummary order={order} />
              </div>
              {order.payments.length > 0 && (
                <div className="px-4 space-y-2">
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
                <div className="px-4 pb-4 space-y-2 pt-2 border-t border-border">
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
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-text-primary">Final Invoice</p>
                <button
                  onClick={() => handleDownloadPdf('invoice')}
                  disabled={!!pdfLoading}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border border-border text-text-secondary active:scale-[0.97] transition-transform disabled:opacity-50"
                >
                  {pdfLoading === 'invoice' ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Download size={12} />
                  )}
                  Invoice PDF
                </button>
              </div>
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

              {order.paymentStatus === 'paid' && (
                <div className="rounded-lg p-3 border border-border text-right space-y-1">
                  <p className="text-xs font-semibold" style={{ color: 'var(--color-success)' }}>
                    Paid{order.payments[0]?.paymentMethod ? ` (${order.payments[0].paymentMethod})` : ''}: -{formatCurrency(order.paidAmount)}
                  </p>
                  <p className="text-sm font-bold" style={{ color: 'var(--color-success)' }}>
                    Amount Due: {formatCurrency(0)}
                  </p>
                </div>
              )}
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

/* ── Read-only order lines ── */
function OrderLines({ lines }: { lines: OrderLineEntity[] }) {
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

/* ── Editable order lines for the Revise & Confirm step ── */
function EditableOrderLines({
  lines,
  onLineChange,
  onRemoveLine,
}: {
  lines: OrderLineEntity[];
  onLineChange: (lineId: string, field: 'quantity' | 'priceUnit', value: number) => void;
  onRemoveLine: (lineId: string) => void;
}) {
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
          <div key={line.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
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
              <button
                onClick={() => onRemoveLine(line.id)}
                className="p-1 rounded text-text-muted hover:text-red-500 transition-colors shrink-0"
                aria-label="Remove line"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex items-center gap-2 mt-2">
              <div className="flex-[3] min-w-0">
                <label className="text-[9px] uppercase font-medium text-text-muted block mb-0.5">Unit Price</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.priceUnit}
                  onChange={(e) => onLineChange(line.id, 'priceUnit', parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg border border-border bg-bg-tertiary px-2 py-1.5 text-xs text-text-primary outline-none text-right"
                  style={{ fontFamily: 'var(--font-mono)' }}
                />
              </div>
              <div className="flex-[2] min-w-0">
                <label className="text-[9px] uppercase font-medium text-text-muted block mb-0.5">Qty</label>
                <input
                  type="number"
                  min="1"
                  value={line.quantity}
                  onChange={(e) => onLineChange(line.id, 'quantity', parseInt(e.target.value) || 1)}
                  className="w-full rounded-lg border border-border bg-bg-tertiary px-2 py-1.5 text-xs text-text-primary outline-none text-right"
                  style={{ fontFamily: 'var(--font-mono)' }}
                />
              </div>
              <div className="flex-[2] min-w-0 text-right">
                <label className="text-[9px] uppercase font-medium text-text-muted block mb-0.5">Subtotal</label>
                <p className="text-xs font-semibold text-text-primary py-1.5" style={{ fontFamily: 'var(--font-mono)' }}>
                  {formatCurrency(line.priceUnit * line.quantity)}
                </p>
              </div>
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
