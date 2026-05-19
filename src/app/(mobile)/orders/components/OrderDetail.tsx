'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ClipboardList,
  ShieldCheck,
  Truck,
  CreditCard,
  FileText,
  User,
  Package,
  ArrowLeft,
  X,
  Download,
  Mail,
  Tag,
  ChevronDown,
  Check,
  MapPin,
  AlertCircle,
  Pencil,
  Search,
  Plus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { StepProgress } from '@/components/ui/Progress';
import { LoadingState, ErrorState } from '@/components/ui/State';
import {
  getOrder,
  sendOrder as restSendOrder,
  confirmOrder as restConfirmOrder,
  requestApproval as restRequestApproval,
  approveOrder as restApproveOrder,
  rejectOrder as restRejectOrder,
  registerPayment as restRegisterPayment,
  sendProformaPdf as restSendProforma,
  postInvoice as restPostInvoice,
  createInvoice as restCreateInvoice,
  formatCurrency,
  getPriceLists,
  getPriceListPrice,
  getDeliveries,
  getDelivery,
  validateDelivery,
  updateOrderLine,
  removeOrderLine,
  addOrderLines,
  getPaymentJournals,
  getStockLevels,
  aggregateStockByProduct,
  getLotsByProduct,
} from '@/lib/portal/order-api';
import type { ValidateDeliveryLine } from '@/lib/portal/order-api';
import { getProducts } from '@/lib/odoo-api';
import { getSalesRoleToken } from '@/lib/attendant-auth';
import {
  PIPELINE_STEPS,
  getOrderStepIndex,
  getDeliveryState,
  isDeliveryDone,
} from '@/lib/portal/order-constants';
import { mapOdooPriceList, type PriceList } from '@/lib/portal/price-list-data';
import type { OrderEntity, OrderLineEntity, PaymentStatus, DeliveryEntity, OdooJournal, OdooProduct } from '@/lib/portal/types';

const STEP_ICONS = [ClipboardList, ShieldCheck, Truck, FileText, CreditCard];

const FALLBACK_JOURNALS: OdooJournal[] = [
  { id: 0, name: 'Bank', type: 'bank' },
  { id: 0, name: 'Cash', type: 'cash' },
  { id: 0, name: 'Mobile', type: 'cash' },
];

const ORDER_STATE_META: Record<string, { label: string; variant: 'default' | 'warning' | 'success' | 'error' }> = {
  draft:  { label: 'Draft',     variant: 'default'  },
  sent:   { label: 'Sent',      variant: 'warning'  },
  sale:   { label: 'Confirmed', variant: 'success'  },
  done:   { label: 'Done',      variant: 'success'  },
  cancel: { label: 'Cancelled', variant: 'error'    },
};

const DELIVERY_STATE_META: Record<string, { label: string; variant: 'default' | 'warning' | 'success' | 'error' }> = {
  draft:     { label: 'Draft',            variant: 'default'  },
  waiting:   { label: 'Waiting',          variant: 'warning'  },
  confirmed: { label: 'Confirmed',        variant: 'warning'  },
  assigned:  { label: 'Ready to Deliver', variant: 'success'  },
  done:      { label: 'Delivered',        variant: 'success'  },
  cancel:    { label: 'Cancelled',        variant: 'default'  },
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
  const [payJournalId, setPayJournalId] = useState<number | null>(null);
  const [payDate, setPayDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [payInvoiceId, setPayInvoiceId] = useState<number | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('');

  // Payment journals fetched from Odoo
  const [journals, setJournals] = useState<OdooJournal[]>([]);

  // Edit mode for draft quotation lines
  const [isEditingLines, setIsEditingLines] = useState(false);
  const [savingEdits, setSavingEdits] = useState(false);
  const [showEditProductPicker, setShowEditProductPicker] = useState(false);
  const [editProductSearch, setEditProductSearch] = useState('');
  const [debouncedEditProductSearch, setDebouncedEditProductSearch] = useState('');
  const [editProducts, setEditProducts] = useState<OdooProduct[]>([]);
  const [editProductsLoading, setEditProductsLoading] = useState(false);

  // Step tab container ref for scroll-into-view
  const stepTabsRef = useRef<HTMLDivElement | null>(null);

  // Editable lines state for the Revise & Confirm step
  const [editableLines, setEditableLines] = useState<OrderLineEntity[]>([]);

  // Pricelist state for the Revise & Confirm step
  const [revisePriceLists, setRevisePriceLists] = useState<PriceList[]>([]);
  const [revisePLLoading, setRevisePLLoading] = useState(true);
  const [selectedRevisePL, setSelectedRevisePL] = useState<PriceList | null>(null);
  const [showRevisePLPicker, setShowRevisePLPicker] = useState(false);
  const [linePriceLoadingIds, setLinePriceLoadingIds] = useState<Set<string>>(new Set());

  const editableLinesRef = useRef(editableLines);
  editableLinesRef.current = editableLines;
  const selectedRevisePLRef = useRef(selectedRevisePL);
  selectedRevisePLRef.current = selectedRevisePL;
  const reviseQtyTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Delivery step state
  const [deliveries, setDeliveries] = useState<DeliveryEntity[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryEntity | null>(null);
  const [deliveryDetailLoading, setDeliveryDetailLoading] = useState(false);
  const [validatingDelivery, setValidatingDelivery] = useState(false);
  const [stockMap, setStockMap] = useState<Map<number, { qty_on_hand: number; qty_reserved: number; qty_available: number }>>(new Map());

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
      // Seed deliveries from order response if available
      if (data.deliveries?.length) {
        setDeliveries(data.deliveries);
      }
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await getPriceLists();
        if (cancelled || raw.length === 0) return;
        setRevisePriceLists(raw.map(mapOdooPriceList));
      } catch { /* ignore */ } finally {
        if (!cancelled) setRevisePLLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    return () => {
      Object.values(reviseQtyTimers.current).forEach(clearTimeout);
    };
  }, []);

  // Fetch payment journals once on mount
  useEffect(() => {
    let cancelled = false;
    getPaymentJournals()
      .then((list) => { if (!cancelled && list.length > 0) setJournals(list); })
      .catch(() => { /* keep fallback */ });
    return () => { cancelled = true; };
  }, []);

  // Debounce edit-mode product search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedEditProductSearch(editProductSearch), 300);
    return () => clearTimeout(t);
  }, [editProductSearch]);

  // Fetch products when edit product picker is open
  useEffect(() => {
    if (!showEditProductPicker) return;
    let cancelled = false;
    (async () => {
      setEditProductsLoading(true);
      try {
        const token = getSalesRoleToken();
        const data = await getProducts(
          { limit: 20, search: debouncedEditProductSearch || undefined },
          token || undefined,
        );
        if (!cancelled) setEditProducts(data.products ?? []);
      } catch {
        if (!cancelled) setEditProducts([]);
      } finally {
        if (!cancelled) setEditProductsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [showEditProductPicker, debouncedEditProductSearch]);

  // Scroll active step tab into view
  useEffect(() => {
    if (!stepTabsRef.current) return;
    const tab = stepTabsRef.current.children[activeStep] as HTMLElement | undefined;
    if (tab) tab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [activeStep]);

  // Fetch stock levels once when the Delivery step is first opened
  useEffect(() => {
    if (activeStep !== 2) return;
    let cancelled = false;
    getStockLevels({ limit: 500 })
      .then((data) => { if (!cancelled) setStockMap(aggregateStockByProduct(data.levels)); })
      .catch(() => { /* show delivery without stock context */ });
    return () => { cancelled = true; };
  }, [activeStep]);

  // Load deliveries when user navigates to the Delivery step (step 2)
  useEffect(() => {
    if (activeStep !== 2) return;
    let cancelled = false;
    (async () => {
      setDeliveriesLoading(true);
      try {
        const result = await getDeliveries({ sale_order_id: orderId, limit: 10 });
        if (!cancelled) {
          // If the API returned nothing, keep any deliveries already seeded from the order response
          const list = result.deliveries.length > 0 ? result.deliveries : undefined;
          if (list) setDeliveries(list);

          const effective = list ?? deliveries;
          if (effective.length > 0 && !selectedDelivery) {
            const active =
              effective.find((d) => d.state !== 'done' && d.state !== 'cancel') ??
              effective[0];
            setSelectedDelivery(active);
          }
        }
      } catch {
        // API failed — auto-select from whatever was seeded from the order response
        if (!cancelled && deliveries.length > 0 && !selectedDelivery) {
          const active =
            deliveries.find((d) => d.state !== 'done' && d.state !== 'cancel') ??
            deliveries[0];
          setSelectedDelivery(active);
        }
      } finally {
        if (!cancelled) setDeliveriesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep, orderId]);

  // Load delivery line detail when a delivery is selected
  useEffect(() => {
    if (!selectedDelivery || selectedDelivery.lines !== undefined) return;
    let cancelled = false;
    (async () => {
      setDeliveryDetailLoading(true);
      try {
        const detail = await getDelivery(selectedDelivery.id);
        if (cancelled) return;

        // Resolve numeric lot_ids → serial name strings if lot_names aren't already populated
        if (detail.lines) {
          const needsLotResolution = detail.lines.some(
            (l) => l.lot_ids.length > 0 && l.lot_names.length === 0,
          );
          if (needsLotResolution) {
            // Collect unique product IDs that need lot resolution
            const productIds = [...new Set(
              detail.lines
                .filter((l) => l.lot_ids.length > 0 && l.lot_names.length === 0)
                .map((l) => l.product.id),
            )];
            // Fetch lot name maps per product
            const lotMaps = new Map<number, string>();
            await Promise.allSettled(
              productIds.map(async (pid) => {
                try {
                  const lots = await getLotsByProduct(pid);
                  lots.forEach((lt) => lotMaps.set(lt.id, lt.serial));
                } catch { /* ignore */ }
              }),
            );
            // Inject lot_names into lines
            detail.lines = detail.lines.map((l) => ({
              ...l,
              lot_names:
                l.lot_names.length > 0
                  ? l.lot_names
                  : l.lot_ids.map((id) => lotMaps.get(id) ?? `#${id}`),
            }));
          }
        }

        if (!cancelled) {
          setSelectedDelivery(detail);
          setDeliveries((prev) => prev.map((d) => (d.id === detail.id ? detail : d)));
        }
      } catch {
        /* keep summary */
      } finally {
        if (!cancelled) setDeliveryDetailLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedDelivery?.id]);

  const refreshOrder = useCallback(
    async (minStep?: number) => {
      try {
        const fresh = await getOrder(orderId);
        setOrder(fresh);
        setEditableLines(fresh.lines.map((l) => ({ ...l })));
        if (fresh.deliveries?.length) setDeliveries(fresh.deliveries);
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
    return handleAction(() => restSendOrder(orderId), 'Quotation sent.', 0);
  }, [handleAction, orderId]);

  const handleRequestApproval = useCallback(() => {
    return handleAction(() => restRequestApproval(orderId), 'Submitted for approval.', 1);
  }, [handleAction, orderId]);

  // Fixed: approval must come BEFORE confirm per Odoo workflow
  // Uses a longer delay (2.5s) because Odoo triggers stock.picking creation synchronously
  // but the SA-scoped delivery query needs the picking to be fully written first.
  const handleConfirm = useCallback(async () => {
    setActionLoading(true);
    try {
      await restConfirmOrder(orderId);
    } catch (err: any) {
      toast.error(err?.message ?? 'Operation failed');
      setActionLoading(false);
      return;
    }
    toast.success('Order confirmed — delivery order is being created…');
    await new Promise((r) => setTimeout(r, 2500));
    try {
      await refreshOrder(2);
    } catch {
      await new Promise((r) => setTimeout(r, 2500));
      try { await refreshOrder(2); } catch { /* ignore */ }
    } finally {
      setActionLoading(false);
    }
  }, [orderId, refreshOrder]);

  const handleApprove = useCallback(() => {
    return handleAction(
      () => restApproveOrder(orderId, approvalNotes || undefined),
      'Order approved.',
      1,
    );
  }, [handleAction, orderId, approvalNotes]);

  const handleReject = useCallback(() => {
    return handleAction(
      () => restRejectOrder(orderId, approvalNotes || undefined),
      'Order rejected.',
      1,
    );
  }, [handleAction, orderId, approvalNotes]);

  const handlePostInvoice = useCallback((invoiceId: string) => {
    return handleAction(
      () => restPostInvoice(orderId, invoiceId),
      'Invoice posted.',
      4,
    );
  }, [handleAction, orderId]);

  const handleCreateInvoice = useCallback(() => {
    return handleAction(
      () => restCreateInvoice(orderId),
      'Invoice created.',
      3,
    );
  }, [handleAction, orderId]);

  const handleValidateDelivery = useCallback(async (
    lines: ValidateDeliveryLine[],
    forceBackorder: boolean,
  ) => {
    if (!selectedDelivery) return;
    setValidatingDelivery(true);
    try {
      const result = await validateDelivery(
        selectedDelivery.id,
        lines.length > 0 ? lines : undefined,
        forceBackorder,
      );
      if (!result.success) {
        toast.error(result.message ?? 'Delivery validation failed.');
        return;
      }
      const msg = forceBackorder
        ? 'Partial delivery validated — backorder created for remaining units.'
        : 'Delivery validated — stock decremented.';
      toast.success(msg);
      try {
        const [fresh, deliResult] = await Promise.all([
          getOrder(orderId),
          getDeliveries({ sale_order_id: orderId, limit: 10 }),
        ]);
        setOrder(fresh);
        setDeliveries(deliResult.deliveries);
        setSelectedDelivery(
          result.delivery ??
          deliResult.deliveries.find((d) => d.id === selectedDelivery.id) ??
          null,
        );
        const computed = getOrderStepIndex(fresh);
        setBackendStep(computed);
        setActiveStep(computed);
      } catch {
        await refreshOrder();
      }
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to validate delivery.');
    } finally {
      setValidatingDelivery(false);
    }
  }, [selectedDelivery, orderId, refreshOrder]);

  const handleRegisterPayment = useCallback(async () => {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) {
      toast.error('Enter a valid payment amount.');
      return;
    }
    setActionLoading(true);
    try {
      const selectedJournal = journals.find((j) => j.id === payJournalId);
      const paymentSource = selectedJournal?.type === 'cash'
        ? selectedJournal.name.toLowerCase().replace(/\s+/g, '_')
        : selectedJournal?.type;
      const result = await restRegisterPayment(orderId, {
        amount,
        journalId: payJournalId ?? undefined,
        paymentDate: payDate || undefined,
        memo: payMemo || undefined,
        invoiceId: payInvoiceId ?? undefined,
        paymentSource: paymentSource || undefined,
      });
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
  }, [orderId, payAmount, payMemo, payJournalId, payDate, payInvoiceId, journals, order]);


  // Pricelist selection handler — re-compute all line prices
  const handleRevisePLSelect = useCallback(async (pl: PriceList) => {
    setSelectedRevisePL(pl);
    setShowRevisePLPicker(false);

    Object.values(reviseQtyTimers.current).forEach(clearTimeout);
    reviseQtyTimers.current = {};

    const currentLines = editableLinesRef.current;
    if (currentLines.length === 0 || !pl.odooId) return;

    setLinePriceLoadingIds(new Set(currentLines.map((l) => l.id)));

    const priceMap = new Map<string, number>();

    await Promise.allSettled(
      currentLines.map(async (line) => {
        try {
          const result = await getPriceListPrice(pl.odooId!, line.productId, line.quantity);
          priceMap.set(line.id, result.unit_price);
        } catch {
          /* keep existing price */
        }
      }),
    );

    setEditableLines((prev) =>
      prev.map((l) => {
        const newPrice = priceMap.get(l.id);
        if (newPrice !== undefined) {
          return { ...l, priceUnit: newPrice, priceSubtotal: newPrice * l.quantity };
        }
        return l;
      }),
    );
    setLinePriceLoadingIds(new Set());
  }, []);

  const handleLineQtyChange = useCallback((lineId: string, quantity: number) => {
    const safeQty = Math.max(1, quantity);

    setEditableLines((prev) =>
      prev.map((l) =>
        l.id === lineId ? { ...l, quantity: safeQty, priceSubtotal: l.priceUnit * safeQty } : l,
      ),
    );

    const pl = selectedRevisePLRef.current;
    if (!pl?.odooId) return;

    setLinePriceLoadingIds((prev) => new Set(prev).add(lineId));

    if (reviseQtyTimers.current[lineId]) {
      clearTimeout(reviseQtyTimers.current[lineId]);
    }

    reviseQtyTimers.current[lineId] = setTimeout(async () => {
      const line = editableLinesRef.current.find((l) => l.id === lineId);
      if (!line) return;

      try {
        const result = await getPriceListPrice(pl.odooId!, line.productId, safeQty);
        setEditableLines((prev) =>
          prev.map((l) =>
            l.id === lineId
              ? { ...l, priceUnit: result.unit_price, priceSubtotal: result.unit_price * safeQty }
              : l,
          ),
        );
      } catch {
        /* keep existing */
      }

      setLinePriceLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(lineId);
        return next;
      });
    }, 500);
  }, []);

  const handleRemoveLine = useCallback((lineId: string) => {
    setEditableLines((prev) => prev.filter((l) => l.id !== lineId));
    if (reviseQtyTimers.current[lineId]) {
      clearTimeout(reviseQtyTimers.current[lineId]);
      delete reviseQtyTimers.current[lineId];
    }
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

  const handleRefreshDeliveries = useCallback(async () => {
    setDeliveriesLoading(true);
    try {
      const result = await getDeliveries({ sale_order_id: orderId, limit: 10 });
      if (result.deliveries.length > 0) {
        setDeliveries(result.deliveries);
        if (!selectedDelivery) {
          const active =
            result.deliveries.find((d) => d.state !== 'done' && d.state !== 'cancel') ??
            result.deliveries[0];
          setSelectedDelivery(active);
        }
      }
    } catch { /* ignore */ } finally {
      setDeliveriesLoading(false);
    }
  }, [orderId, selectedDelivery]);

  const handleToggleEditMode = useCallback(() => {
    setIsEditingLines((prev) => {
      if (prev) {
        // Cancelling — reset editable lines from server state
        setEditableLines(order ? order.lines.map((l) => ({ ...l })) : []);
        setShowEditProductPicker(false);
        setEditProductSearch('');
      }
      return !prev;
    });
  }, [order]);

  const handleAddEditProduct = useCallback(
    async (p: OdooProduct) => {
      const existing = editableLines.find((l) => l.productId === p.id);
      if (existing) {
        handleLineQtyChange(existing.id, existing.quantity + 1);
      } else {
        const tempId = `new-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        let priceUnit = p.list_price;
        const pl = selectedRevisePLRef.current;
        if (pl?.odooId) {
          try {
            const result = await getPriceListPrice(pl.odooId, p.id, 1);
            priceUnit = result.unit_price;
          } catch { /* fallback to list_price */ }
        }
        setEditableLines((prev) => [
          ...prev,
          {
            id: tempId,
            productId: p.id,
            productName: p.name,
            sku: p.default_code || null,
            puCategory: (p.pu_category as string) || null,
            puMetric: null,
            serviceType: null,
            contractType: null,
            description: null,
            quantity: 1,
            priceUnit,
            priceSubtotal: priceUnit,
            durationMonths: null,
          },
        ]);
      }
      setShowEditProductPicker(false);
      setEditProductSearch('');
    },
    [editableLines, handleLineQtyChange],
  );

  const handleSaveEdits = useCallback(async () => {
    if (!order) return;
    setSavingEdits(true);
    try {
      const editableIds = new Set(
        editableLines.filter((l) => !l.id.startsWith('new-')).map((l) => l.id),
      );

      const toRemove = order.lines.filter((l) => !editableIds.has(l.id));
      const toUpdate = editableLines.filter((l) => !l.id.startsWith('new-')).filter((l) => {
        const orig = order.lines.find((ol) => ol.id === l.id);
        return orig && (orig.quantity !== l.quantity || orig.priceUnit !== l.priceUnit);
      });
      const toAdd = editableLines.filter((l) => l.id.startsWith('new-'));

      const ops: Promise<any>[] = [];
      toRemove.forEach((l) => ops.push(removeOrderLine(Number(order.id), l.id)));
      toUpdate.forEach((l) =>
        ops.push(updateOrderLine(Number(order.id), l.id, { quantity: l.quantity, price_unit: l.priceUnit })),
      );
      if (toAdd.length > 0) {
        ops.push(
          addOrderLines(
            Number(order.id),
            toAdd.map((l) => ({
              product_id: l.productId,
              quantity: l.quantity,
              price_unit: l.priceUnit,
            })),
          ),
        );
      }

      if (ops.length === 0) {
        toast('No changes to save.');
        setIsEditingLines(false);
        return;
      }

      await Promise.all(ops);
      toast.success('Changes saved.');
      setIsEditingLines(false);
      setShowEditProductPicker(false);
      await fetchOrderData();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to save changes.');
    } finally {
      setSavingEdits(false);
    }
  }, [order, editableLines, fetchOrderData]);

  if (loading) {
    return <LoadingState message="Loading order..." />;
  }

  if (error || !order) {
    return (
      <ErrorState
        message={error ?? 'Order not found.'}
        onRetry={fetchOrderData}
      />
    );
  }

  const st = ORDER_STATE_META[order.state] ?? ORDER_STATE_META.draft;
  const isViewingPastStep = activeStep < backendStep;

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
        <Badge variant={st.variant} size="sm">{st.label}</Badge>
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

          {/* Delivery status badge if order is confirmed */}
          {(order.state === 'sale' || order.state === 'done') && (
            <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
              <Truck size={13} className="text-text-muted shrink-0" />
              <span className="text-[11px] text-text-muted">Delivery:</span>
              <DeliveryStatusBadge order={order} />
            </div>
          )}
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
          <div ref={stepTabsRef} className="flex gap-1 overflow-x-auto no-scrollbar">
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
                  className="flex flex-col items-center gap-1 px-2 py-2 rounded-lg min-w-[56px] text-center transition-all"
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

          {/* ── Step 0: Quotation ── */}
          {activeStep === 0 && (
            <div>
              {/* Customer section */}
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <User size={15} className="text-text-muted" />
                <span className="text-sm font-semibold text-text-primary">Customer</span>
                {(order.state === 'draft' || order.state === 'sent') && !isViewingPastStep && (
                  <button
                    onClick={handleToggleEditMode}
                    className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border border-border text-text-secondary active:scale-[0.97] transition-transform"
                  >
                    <Pencil size={11} />
                    {isEditingLines ? 'Cancel' : 'Edit Lines'}
                  </button>
                )}
              </div>
              <div className="px-4 py-3">
                <p className="text-sm font-medium text-text-primary">{order.partnerName}</p>
                {order.partnerEmail && <p className="text-xs text-text-secondary">{order.partnerEmail}</p>}
                {order.partnerPhone && <p className="text-xs text-text-secondary">{order.partnerPhone}</p>}
                {order.clientOrderRef && (
                  <p className="text-xs text-text-muted mt-1">Ref: {order.clientOrderRef}</p>
                )}
              </div>

              {/* Lines — read-only or editable */}
              {isEditingLines ? (
                <>
                  {/* Pricelist picker for repricing in edit mode */}
                  <div className="px-4 pb-2 border-t border-border pt-2">
                    <button
                      onClick={() => setShowRevisePLPicker((v) => !v)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-text-secondary active:scale-[0.97]"
                    >
                      <Tag size={11} />
                      {selectedRevisePL?.name ?? 'Reprice with pricelist…'}
                      <ChevronDown size={11} className="ml-1" style={{ transform: showRevisePLPicker ? 'rotate(180deg)' : undefined }} />
                    </button>
                    {showRevisePLPicker && (
                      <div className="mt-1 rounded-xl border border-border bg-bg-tertiary overflow-hidden shadow-lg">
                        {revisePLLoading ? (
                          <p className="text-xs text-center py-3 text-text-muted">Loading…</p>
                        ) : (
                          <div className="max-h-48 overflow-y-auto p-1.5 space-y-0.5">
                            {revisePriceLists.map((pl) => (
                              <button
                                key={pl.id}
                                onClick={() => handleRevisePLSelect(pl)}
                                className="w-full text-left px-3 py-2 rounded-lg text-xs flex items-center gap-2 hover:bg-bg-elevated"
                              >
                                <Check size={11} className={pl.id === selectedRevisePL?.id ? 'text-brand' : 'opacity-0'} />
                                {pl.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <EditableOrderLines
                    lines={editableLines}
                    onQtyChange={handleLineQtyChange}
                    onRemoveLine={handleRemoveLine}
                    loadingLineIds={linePriceLoadingIds}
                  />
                  {/* Add product button */}
                  <div className="px-4 pb-2">
                    <button
                      onClick={() => setShowEditProductPicker((v) => !v)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-border text-text-muted text-sm hover:bg-bg-elevated active:scale-[0.99]"
                    >
                      <Plus size={14} />
                      Add product
                    </button>
                    {showEditProductPicker && (
                      <div className="mt-1 rounded-xl border border-border bg-bg-tertiary overflow-hidden shadow-lg">
                        <div className="p-2">
                          <div className="relative">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                            <input
                              type="text"
                              placeholder="Search products…"
                              value={editProductSearch}
                              onChange={(e) => setEditProductSearch(e.target.value)}
                              autoFocus
                              className="w-full pl-8 pr-3 py-2 rounded-lg border border-border bg-bg-tertiary text-text-primary text-sm placeholder:text-text-muted focus:outline-none"
                            />
                          </div>
                        </div>
                        {editProductsLoading ? (
                          <p className="text-xs text-center py-3 text-text-muted">Loading…</p>
                        ) : editProducts.length === 0 ? (
                          <p className="text-xs text-center py-3 text-text-muted">No products found.</p>
                        ) : (
                          <div className="max-h-52 overflow-y-auto px-2 pb-2 space-y-0.5">
                            {editProducts.map((p) => (
                              <button
                                key={p.id}
                                onClick={() => handleAddEditProduct(p)}
                                className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-bg-elevated"
                              >
                                <span className="font-medium text-text-primary">{p.name}</span>
                                {p.pu_category && (
                                  <span className="ml-2 text-[10px] text-text-muted">{p.pu_category as string}</span>
                                )}
                                <span className="ml-2 text-xs text-text-secondary" style={{ fontFamily: 'var(--font-mono)' }}>
                                  {formatCurrency(p.list_price)}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Save / Cancel */}
                  <div className="px-4 pb-4 pt-2 border-t border-border flex gap-2">
                    <Button variant="secondary" size="md" fullWidth onClick={handleToggleEditMode}>
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      size="md"
                      fullWidth
                      onClick={handleSaveEdits}
                      loading={savingEdits}
                      loadingText="Saving…"
                    >
                      Save Changes
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <OrderLines lines={order.lines} />
                  <div className="px-4 py-3 border-t border-border">
                    <OrderSummary order={order} />
                  </div>
                </>
              )}

              {/* Action buttons (only when not in edit mode) */}
              {!isEditingLines && !isViewingPastStep && order.approvalStatus === 'none' && (
                <div className="px-4 pb-4 pt-2 space-y-2 border-t border-border">
                  {order.state === 'draft' && (
                    <Button
                      variant="secondary"
                      size="lg"
                      fullWidth
                      onClick={handleSend}
                      disabled={actionLoading}
                    >
                      Send to Customer
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    size="lg"
                    fullWidth
                    onClick={handleRequestApproval}
                    disabled={actionLoading}
                    loading={actionLoading}
                    loadingText="Submitting…"
                  >
                    Request Approval
                  </Button>
                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    onClick={handleConfirm}
                    disabled={actionLoading}
                    loading={actionLoading}
                    loadingText="Confirming…"
                  >
                    Confirm Order
                  </Button>
                </div>
              )}
              {!isEditingLines && !isViewingPastStep && order.approvalStatus !== 'none' && (
                <div className="px-4 pb-4 pt-2 border-t border-border">
                  <Button variant="secondary" size="lg" fullWidth onClick={() => setActiveStep(1)}>
                    View Approval Status →
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* ── Step 1: Approval ── */}
          {activeStep === 1 && (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-text-primary">Approval</p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleDownloadPdf('proforma')}
                  disabled={!!pdfLoading}
                  loading={pdfLoading === 'proforma'}
                  leftIcon={<Download size={12} />}
                >
                  Proforma PDF
                </Button>
              </div>

              {order.approvalStatus === 'pending' && (
                <div className="rounded-lg p-3 text-xs" style={{ background: 'var(--color-warning-soft)', color: 'var(--color-warning)' }}>
                  <span className="font-semibold">Awaiting manager approval</span>
                  {order.approval?.submittedAt && ` — submitted ${order.approval.submittedAt.split('T')[0]}`}.
                </div>
              )}
              {order.approvalStatus === 'approved' && (
                <div className="rounded-lg p-3 text-xs" style={{ background: 'var(--color-success-soft)', color: 'var(--color-success)' }}>
                  <span className="font-semibold">Approved</span>
                  {order.approval?.approvedBy && ` by ${order.approval.approvedBy}`}
                  {order.approval?.approvedAt && ` on ${order.approval.approvedAt.split('T')[0]}`}.
                </div>
              )}
              {order.approvalStatus === 'rejected' && (
                <div className="rounded-lg p-3 text-xs" style={{ background: 'var(--color-error-soft)', color: 'var(--color-error)' }}>
                  <span className="font-semibold">Rejected</span>
                  {order.approval?.approvedBy && ` by ${order.approval.approvedBy}`}.
                  {order.approval?.notes && ` Reason: "${order.approval.notes}"`}
                </div>
              )}

              {/* Manager: approve / reject when pending */}
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
                    <Button variant="success" size="md" fullWidth onClick={handleApprove} disabled={actionLoading}>
                      Approve
                    </Button>
                    <Button variant="danger" size="md" fullWidth onClick={handleReject} disabled={actionLoading}>
                      Reject
                    </Button>
                  </div>
                </>
              )}

              {/* Agent: confirm once approved */}
              {!isViewingPastStep && order.approvalStatus === 'approved' && (
                <div className="space-y-2 pt-1">
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      fullWidth
                      onClick={handleSendProforma}
                      disabled={sendingProforma}
                      loading={sendingProforma}
                      loadingText="Sending…"
                      leftIcon={<Mail size={13} />}
                    >
                      Email Proforma
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleDownloadPdf('proforma')}
                      disabled={!!pdfLoading}
                      loading={pdfLoading === 'proforma'}
                      leftIcon={<Download size={13} />}
                    >
                      PDF
                    </Button>
                  </div>
                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    onClick={handleConfirm}
                    disabled={actionLoading}
                    loading={actionLoading}
                    loadingText="Confirming…"
                  >
                    Confirm as Sales Order
                  </Button>
                </div>
              )}

              {/* Agent: edit lines and resubmit when rejected */}
              {!isViewingPastStep && order.approvalStatus === 'rejected' && (
                <div className="space-y-3 pt-1">
                  {/* Pricelist re-pricer */}
                  <div>
                    <button
                      onClick={() => setShowRevisePLPicker((v) => !v)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-text-secondary active:scale-[0.97]"
                    >
                      <Tag size={11} />
                      {selectedRevisePL?.name ?? 'Reprice with pricelist…'}
                      <ChevronDown size={11} className="ml-1" style={{ transform: showRevisePLPicker ? 'rotate(180deg)' : undefined }} />
                    </button>
                    {showRevisePLPicker && (
                      <div className="mt-1 rounded-xl border border-border bg-bg-tertiary overflow-hidden shadow-lg">
                        {revisePLLoading ? (
                          <p className="text-xs text-center py-3 text-text-muted">Loading…</p>
                        ) : (
                          <div className="max-h-48 overflow-y-auto p-1.5 space-y-0.5">
                            {revisePriceLists.map((pl) => (
                              <button
                                key={pl.id}
                                onClick={() => handleRevisePLSelect(pl)}
                                className="w-full text-left px-3 py-2 rounded-lg text-xs flex items-center gap-2 hover:bg-bg-elevated"
                              >
                                <Check size={11} className={pl.id === selectedRevisePL?.id ? 'text-brand' : 'opacity-0'} />
                                {pl.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Editable lines */}
                  <div className="-mx-4 border-t border-border">
                    <EditableOrderLines
                      lines={editableLines}
                      onQtyChange={handleLineQtyChange}
                      onRemoveLine={handleRemoveLine}
                      loadingLineIds={linePriceLoadingIds}
                    />
                  </div>

                  {/* Save edits */}
                  <Button
                    variant="secondary"
                    size="lg"
                    fullWidth
                    onClick={handleSaveEdits}
                    loading={savingEdits}
                    loadingText="Saving…"
                  >
                    Save Line Edits
                  </Button>

                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    onClick={handleRequestApproval}
                    disabled={actionLoading}
                    loading={actionLoading}
                    loadingText="Submitting…"
                  >
                    Resubmit for Approval
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Delivery ── */}
          {activeStep === 2 && (
            <DeliveryStep
              order={order}
              deliveries={deliveries}
              deliveriesLoading={deliveriesLoading}
              selectedDelivery={selectedDelivery}
              detailLoading={deliveryDetailLoading}
              validating={validatingDelivery}
              isViewingPastStep={isViewingPastStep}
              stockMap={stockMap}
              onSelectDelivery={setSelectedDelivery}
              onValidate={handleValidateDelivery}
              onRefreshDeliveries={handleRefreshDeliveries}
            />
          )}

          {/* ── Step 3: Invoice ── */}
          {activeStep === 3 && (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-text-primary">Invoice</p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleDownloadPdf('invoice')}
                  disabled={!!pdfLoading}
                  loading={pdfLoading === 'invoice'}
                  leftIcon={<Download size={12} />}
                >
                  Invoice PDF
                </Button>
              </div>

              {order.invoices.length === 0 ? (
                <div className="rounded-lg p-3 space-y-3 border border-border">
                  <p className="text-xs text-center text-text-muted">
                    No invoice has been generated yet. Odoo normally creates one automatically on confirm or delivery; use the button below to create one manually if needed.
                  </p>
                  {(order.state === 'sale' || order.state === 'done') && !isViewingPastStep && (
                    <Button
                      variant="primary"
                      size="md"
                      fullWidth
                      onClick={handleCreateInvoice}
                      disabled={actionLoading}
                      loading={actionLoading}
                      loadingText="Creating…"
                    >
                      Create Invoice
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {order.invoices.map((inv) => (
                    <div key={inv.id} className="rounded-lg p-3 border border-border space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-text-primary">{inv.name}</span>
                        <Badge variant={inv.state === 'posted' ? 'success' : 'default'} size="xs">
                          {inv.state === 'posted' ? 'Posted' : 'Draft'}
                        </Badge>
                      </div>
                      <p className="text-xs text-text-secondary">
                        Total: {formatCurrency(inv.amountTotal)}
                        {inv.amountResidual > 0 && ` · Due: ${formatCurrency(inv.amountResidual)}`}
                      </p>
                      {inv.state !== 'posted' && !isViewingPastStep && (
                        <Button
                          variant="primary"
                          size="md"
                          fullWidth
                          onClick={() => handlePostInvoice(inv.id)}
                          disabled={actionLoading}
                          loading={actionLoading}
                          loadingText="Posting…"
                        >
                          Post Invoice
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <OrderSummary order={order} />
            </div>
          )}

          {/* ── Step 4: Payment ── */}
          {activeStep === 4 && (
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
                      <span className="text-text-muted">
                        {pay.paymentDate}{pay.paymentMethod ? ` · ${pay.paymentMethod}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {order.paymentStatus === 'paid' && (
                <div className="mx-4 rounded-lg p-3" style={{ background: 'var(--color-success-soft)', color: 'var(--color-success)' }}>
                  <p className="text-sm font-semibold text-center">Fully Paid</p>
                </div>
              )}
              {!isViewingPastStep && order.paymentStatus !== 'paid' && (
                <div className="px-4 pb-4 space-y-3 pt-2 border-t border-border">
                  {/* Invoice selector — only when multiple unpaid invoices exist */}
                  {(() => {
                    const unpaid = order.invoices.filter((inv) => (inv.amountResidual ?? 0) > 0);
                    if (unpaid.length <= 1) return null;
                    return (
                      <div>
                        <p className="text-xs font-medium text-text-secondary mb-2">Apply to Invoice</p>
                        <div className="space-y-1.5">
                          {unpaid.map((inv) => {
                            const isSelected = payInvoiceId === Number(inv.id);
                            return (
                              <button
                                key={inv.id}
                                onClick={() => setPayInvoiceId(isSelected ? null : Number(inv.id))}
                                className="w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-colors text-left"
                                style={{
                                  borderColor: isSelected ? 'var(--color-brand)' : 'var(--border-default)',
                                  backgroundColor: isSelected ? 'var(--color-brand-soft, rgba(255,200,0,0.1))' : 'var(--bg-tertiary)',
                                }}
                              >
                                <span className="text-xs font-medium text-text-primary truncate">{inv.name}</span>
                                <span className="text-xs text-text-muted shrink-0 ml-2" style={{ fontFamily: 'var(--font-mono)' }}>
                                  {formatCurrency(inv.amountResidual)}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                  {/* Payment method selector */}
                  <div>
                    <p className="text-xs font-medium text-text-secondary mb-2">Payment Method</p>
                    <div className="grid grid-cols-3 gap-2">
                      {(journals.length > 0 ? journals : FALLBACK_JOURNALS).map((j) => {
                        const isSelected = j.id !== 0 ? payJournalId === j.id : payJournalId === null && journals.length === 0;
                        return (
                          <button
                            key={j.id !== 0 ? j.id : j.name}
                            onClick={() => setPayJournalId(isSelected ? null : (j.id !== 0 ? j.id : null))}
                            className="py-2 rounded-lg text-xs font-medium border transition-colors active:scale-[0.97]"
                            style={{
                              borderColor: isSelected ? 'var(--color-brand)' : 'var(--border-default)',
                              backgroundColor: isSelected ? 'var(--color-brand-soft, rgba(255,200,0,0.1))' : 'var(--bg-tertiary)',
                              color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                            }}
                          >
                            {j.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {/* Payment date */}
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full rounded-lg border border-border bg-bg-tertiary p-2.5 text-sm text-text-primary outline-none"
                  />
                  <input
                    type="number"
                    placeholder={`Amount (remaining: ${formatCurrency(order.remainingAmount)})`}
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
                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    onClick={handleRegisterPayment}
                    disabled={actionLoading}
                    loading={actionLoading}
                    loadingText="Processing…"
                  >
                    Register Payment
                  </Button>
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
        ) : activeStep === 4 && order.paymentStatus === 'paid' ? (
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

/* ── Delivery status badge (in order summary card) ── */
function DeliveryStatusBadge({ order }: { order: OrderEntity }) {
  const state = getDeliveryState(order);
  if (!state) {
    return (
      <span className="text-[11px] text-text-muted">
        {order.state === 'sale' ? 'Pending creation' : '—'}
      </span>
    );
  }
  const meta = DELIVERY_STATE_META[state] ?? DELIVERY_STATE_META.waiting;
  return <Badge variant={meta.variant} size="xs">{meta.label}</Badge>;
}

/* ── Delivery step ── */
interface DeliveryStepProps {
  order: OrderEntity;
  deliveries: DeliveryEntity[];
  deliveriesLoading: boolean;
  selectedDelivery: DeliveryEntity | null;
  detailLoading: boolean;
  validating: boolean;
  isViewingPastStep: boolean;
  stockMap: Map<number, { qty_on_hand: number; qty_reserved: number; qty_available: number }>;
  onSelectDelivery: (d: DeliveryEntity) => void;
  onValidate: (lines: ValidateDeliveryLine[], forceBackorder: boolean) => void;
  onRefreshDeliveries: () => void;
}

function DeliveryStep({
  order,
  deliveries,
  deliveriesLoading,
  selectedDelivery,
  detailLoading,
  validating,
  isViewingPastStep,
  stockMap,
  onSelectDelivery,
  onValidate,
  onRefreshDeliveries,
}: DeliveryStepProps) {
  // qty_done per move line — keyed by line.id (the move id)
  const [qtyDoneMap, setQtyDoneMap] = useState<Record<number, number>>({});
  const [forceBackorder, setForceBackorder] = useState(false);

  // Initialise qty done from delivery lines when they load
  useEffect(() => {
    if (!selectedDelivery?.lines) return;
    const init: Record<number, number> = {};
    for (const l of selectedDelivery.lines) {
      init[l.id] = l.qty_done > 0 ? l.qty_done : l.qty_ordered;
    }
    setQtyDoneMap(init);
    setForceBackorder(false);
  }, [selectedDelivery?.id, selectedDelivery?.lines]);

  const isAssigned = selectedDelivery?.state === 'assigned';
  const canEdit = isAssigned && !isViewingPastStep;
  // Allow validate for any active state — the API will handle force-validation
  const canValidate =
    !isViewingPastStep &&
    selectedDelivery !== null &&
    selectedDelivery.state !== 'done' &&
    selectedDelivery.state !== 'cancel';

  const hasPartial = selectedDelivery?.lines?.some((l) => {
    const done = qtyDoneMap[l.id] ?? l.qty_ordered;
    return done < l.qty_ordered;
  }) ?? false;

  function buildValidateLines(): ValidateDeliveryLine[] {
    if (!selectedDelivery?.lines) return [];
    return selectedDelivery.lines.map((l) => ({
      move_id: l.id,
      qty_done: qtyDoneMap[l.id] ?? l.qty_ordered,
    }));
  }

  return (
    <div className="divide-y divide-border">
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-2">
        <Truck size={15} className="text-text-muted" />
        <span className="text-sm font-semibold text-text-primary">Delivery Orders</span>
        {deliveriesLoading && <Loader2 size={13} className="animate-spin text-text-muted ml-1" />}
      </div>

      {/* Delivery list / picker */}
      {!deliveriesLoading && deliveries.length === 0 && (
        <div className="px-4 py-8 text-center space-y-3">
          <Truck size={28} className="mx-auto text-text-muted" />
          <div>
            <p className="text-sm font-medium text-text-secondary">No deliveries found</p>
            <p className="text-[11px] text-text-muted max-w-[260px] mx-auto mt-1">
              Odoo may still be creating the picking. Tap Refresh in a few seconds — if it keeps showing empty, the order may only have service lines.
            </p>
          </div>
          <button
            onClick={onRefreshDeliveries}
            className="px-4 py-2 rounded-lg border border-border text-xs font-medium text-text-secondary active:scale-[0.98]"
          >
            Refresh
          </button>
        </div>
      )}

      {deliveries.length > 1 && (
        <div className="px-4 py-3 space-y-2">
          <p className="text-xs font-medium text-text-secondary">Select delivery</p>
          {deliveries.map((d) => {
            const meta = DELIVERY_STATE_META[d.state] ?? DELIVERY_STATE_META.waiting;
            const isSelected = selectedDelivery?.id === d.id;
            return (
              <button
                key={d.id}
                onClick={() => onSelectDelivery(d)}
                className="w-full text-left px-3 py-2.5 rounded-lg border transition-colors"
                style={{
                  borderColor: isSelected ? 'var(--color-brand)' : 'var(--border-default)',
                  backgroundColor: isSelected ? 'var(--color-brand-soft, rgba(255,200,0,0.06))' : 'var(--bg-elevated)',
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-text-primary">{d.name}</span>
                  <Badge variant={meta.variant} size="xs">{meta.label}</Badge>
                </div>
                {d.scheduled_date && (
                  <p className="text-[11px] text-text-muted mt-0.5">
                    Scheduled: {new Date(d.scheduled_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Selected delivery detail */}
      {selectedDelivery && (
        <div className="px-4 py-3 space-y-3">
          {/* Delivery header + status */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-primary">{selectedDelivery.name}</p>
              {selectedDelivery.origin && (
                <p className="text-[11px] text-text-muted">Origin: {selectedDelivery.origin}</p>
              )}
            </div>
            {(() => {
              const meta = DELIVERY_STATE_META[selectedDelivery.state] ?? DELIVERY_STATE_META.waiting;
              return <Badge variant={meta.variant} size="sm" className="shrink-0">{meta.label}</Badge>;
            })()}
          </div>

          {/* Location route */}
          {(selectedDelivery.location_from || selectedDelivery.location_to) && (
            <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
              <MapPin size={11} className="shrink-0" />
              <span>{selectedDelivery.location_from?.name ?? '—'}</span>
              <ChevronRight size={11} className="shrink-0" />
              <span>{selectedDelivery.location_to?.name ?? '—'}</span>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-2">
            {selectedDelivery.scheduled_date && (
              <div className="rounded-lg p-2.5" style={{ backgroundColor: 'var(--bg-elevated)' }}>
                <p className="text-[10px] uppercase font-medium text-text-muted">Scheduled</p>
                <p className="text-xs font-semibold text-text-primary mt-0.5">
                  {new Date(selectedDelivery.scheduled_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            )}
            {selectedDelivery.date_done && (
              <div className="rounded-lg p-2.5" style={{ backgroundColor: 'var(--color-success-soft)' }}>
                <p className="text-[10px] uppercase font-medium" style={{ color: 'var(--color-success)' }}>Delivered</p>
                <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--color-success)' }}>
                  {new Date(selectedDelivery.date_done).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            )}
          </div>

          {/* State explanation banners */}
          {selectedDelivery.state === 'done' && (
            <div className="rounded-lg p-3 text-xs flex items-center gap-2"
              style={{ background: 'var(--color-success-soft)', color: 'var(--color-success)' }}>
              <CheckCircle2 size={14} className="shrink-0" />
              <span>Delivery completed. Stock decremented from <strong>{selectedDelivery.location_from?.name ?? 'warehouse'}</strong>.</span>
            </div>
          )}
          {selectedDelivery.state === 'waiting' && (
            <div className="rounded-lg p-3 text-xs flex items-start gap-2"
              style={{ background: 'var(--color-warning-soft)', color: 'var(--color-warning)' }}>
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>
                <strong>Waiting on incoming stock.</strong> A prior receipt or production order must be validated before this delivery can be picked.
              </span>
            </div>
          )}
          {selectedDelivery.state === 'confirmed' && (
            <div className="rounded-lg p-3 text-xs flex items-start gap-2"
              style={{ background: 'var(--color-warning-soft)', color: 'var(--color-warning)' }}>
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>
                <strong>Availability not yet confirmed.</strong> Odoo has not reserved stock for this delivery. A warehouse manager can force-reserve from the Odoo backend.
              </span>
            </div>
          )}
          {selectedDelivery.state === 'assigned' && (
            <div className="rounded-lg p-3 text-xs flex items-center gap-2"
              style={{ background: 'var(--color-success-soft)', color: 'var(--color-success)' }}>
              <CheckCircle2 size={14} className="shrink-0" />
              <span>
                <strong>Stock reserved.</strong> Units are allocated in the warehouse and ready to dispatch.
              </span>
            </div>
          )}

          {/* Move lines */}
          {detailLoading ? (
            <div className="py-4"><LoadingState size="sm" inline /></div>
          ) : selectedDelivery.lines && selectedDelivery.lines.length > 0 ? (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="px-3 py-2 border-b border-border flex items-center gap-2"
                style={{ backgroundColor: 'var(--bg-elevated)' }}>
                <Package size={13} className="text-text-muted" />
                <span className="text-xs font-semibold text-text-secondary">
                  Products ({selectedDelivery.lines.length})
                </span>
                {canEdit && (
                  <span className="ml-auto text-[10px] text-text-muted">Set qty dispatched →</span>
                )}
              </div>
              <div className="divide-y divide-border">
                {selectedDelivery.lines.map((line) => {
                  const qtyDone = qtyDoneMap[line.id] ?? line.qty_ordered;
                  const isDone = qtyDone >= line.qty_ordered && line.qty_ordered > 0;
                  const isShort = qtyDone < line.qty_ordered;
                  const stockEntry = stockMap.get(line.product.id);
                  return (
                    <div key={line.id} className="px-3 py-3 space-y-2">
                      {/* Product name + done badge */}
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-text-primary">{line.product.name}</p>
                          {line.uom?.name && (
                            <p className="text-[10px] text-text-muted">{line.uom.name}</p>
                          )}
                        </div>
                        {isDone && !canEdit && (
                          <CheckCircle2 size={14} className="shrink-0 mt-0.5" style={{ color: 'var(--color-success)' }} />
                        )}
                      </div>

                      {/* Qty row — editable when assigned */}
                      <div className="flex items-center gap-3">
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <div className="rounded-lg px-2.5 py-2" style={{ backgroundColor: 'var(--bg-elevated)' }}>
                            <p className="text-[9px] uppercase font-medium text-text-muted">Demand</p>
                            <p className="text-sm font-bold text-text-primary">{line.qty_ordered}</p>
                          </div>
                          <div className="rounded-lg px-2.5 py-2"
                            style={{
                              backgroundColor: isDone ? 'var(--color-success-soft)' : isShort ? 'var(--color-warning-soft)' : 'var(--bg-elevated)',
                            }}>
                            <p className="text-[9px] uppercase font-medium"
                              style={{ color: isDone ? 'var(--color-success)' : isShort ? 'var(--color-warning)' : 'var(--text-muted)' }}>
                              {canEdit ? 'Dispatching' : 'Done'}
                            </p>
                            {canEdit ? (
                              <input
                                type="number"
                                min={0}
                                max={line.qty_ordered}
                                value={qtyDone === 0 ? '' : qtyDone}
                                onChange={(e) => {
                                  const v = parseInt(e.target.value, 10);
                                  setQtyDoneMap((prev) => ({ ...prev, [line.id]: Number.isNaN(v) ? 0 : Math.min(v, line.qty_ordered) }));
                                }}
                                onBlur={(e) => {
                                  if (e.target.value === '') {
                                    setQtyDoneMap((prev) => ({ ...prev, [line.id]: 0 }));
                                  }
                                }}
                                className="w-full text-sm font-bold outline-none bg-transparent"
                                style={{ color: isDone ? 'var(--color-success)' : isShort ? 'var(--color-warning)' : 'var(--text-primary)' }}
                              />
                            ) : (
                              <p className="text-sm font-bold"
                                style={{ color: isDone ? 'var(--color-success)' : isShort ? 'var(--color-warning)' : 'var(--text-primary)' }}>
                                {line.qty_done}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Stock context mini-card */}
                      {stockEntry && (
                        <div className="flex items-center gap-2 text-[10px] text-text-muted">
                          <span>Warehouse:</span>
                          <span className="font-medium" style={{ color: stockEntry.qty_available >= line.qty_ordered ? 'var(--color-success)' : stockEntry.qty_available > 0 ? 'var(--color-warning)' : 'var(--color-error)' }}>
                            {stockEntry.qty_available} avail
                          </span>
                          <span>·</span>
                          <span>{stockEntry.qty_reserved} reserved</span>
                          <span>·</span>
                          <span>{stockEntry.qty_on_hand} on hand</span>
                        </div>
                      )}

                      {/* Serial / lot chips */}
                      {line.lot_names.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-[9px] uppercase font-medium text-text-muted">Assigned serials</p>
                          <div className="flex flex-wrap gap-1">
                            {line.lot_names.map((sn) => (
                              <span
                                key={sn}
                                className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md border"
                                style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                              >
                                {sn}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {line.lot_names.length === 0 && (line.lot_ids.length > 0) && (
                        <p className="text-[10px] text-text-muted">
                          {line.lot_ids.length} serial{line.lot_ids.length !== 1 ? 's' : ''} assigned (names not returned by API)
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : !detailLoading && selectedDelivery.state !== 'done' ? (
            <p className="text-xs text-text-muted text-center py-2">Line detail not available — validate from Odoo desktop if needed.</p>
          ) : null}

          {/* Backorder toggle — only when partial quantities and in edit mode */}
          {canEdit && hasPartial && (
            <button
              onClick={() => setForceBackorder((v) => !v)}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl border transition-colors"
              style={{
                borderColor: forceBackorder ? 'var(--color-brand)' : 'var(--border-default)',
                backgroundColor: forceBackorder ? 'var(--color-brand-soft, rgba(255,200,0,0.06))' : 'var(--bg-elevated)',
              }}
            >
              <div
                className="w-4 h-4 rounded border-2 flex items-center justify-center shrink-0"
                style={{ borderColor: forceBackorder ? 'var(--color-brand)' : 'var(--border-default)', backgroundColor: forceBackorder ? 'var(--color-brand)' : 'transparent' }}
              >
                {forceBackorder && <Check size={10} className="text-black" />}
              </div>
              <div className="text-left">
                <p className="text-xs font-medium text-text-primary">Create backorder for remaining units</p>
                <p className="text-[10px] text-text-muted">Odoo will open a new delivery order for the shortfall</p>
              </div>
            </button>
          )}

          {/* Validate button */}
          {canValidate && (
            <Button
              variant="success"
              size="lg"
              fullWidth
              onClick={() => onValidate(buildValidateLines(), forceBackorder)}
              disabled={validating}
              loading={validating}
              loadingText="Validating…"
              leftIcon={<Truck size={16} />}
            >
              {forceBackorder ? 'Validate & Create Backorder' : 'Validate Delivery'}
            </Button>
          )}
        </div>
      )}
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
                  <Badge variant={line.puCategory === 'physical' ? 'warning' : 'default'} size="xs">
                    {line.puCategory}
                  </Badge>
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
  onQtyChange,
  onRemoveLine,
  loadingLineIds,
}: {
  lines: OrderLineEntity[];
  onQtyChange: (lineId: string, quantity: number) => void;
  onRemoveLine: (lineId: string) => void;
  loadingLineIds: Set<string>;
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
        {lines.map((line) => {
          const isLoading = loadingLineIds.has(line.id);
          return (
            <div key={line.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary truncate">{line.productName}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {line.sku && (
                      <span className="text-[10px] text-text-muted" style={{ fontFamily: 'var(--font-mono)' }}>
                        {line.sku}
                      </span>
                    )}
                    {line.puCategory && (
                      <Badge variant={line.puCategory === 'physical' ? 'warning' : 'default'} size="xs">
                        {line.puCategory}
                      </Badge>
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

              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-1 min-w-0">
                  {isLoading ? (
                    <Loader2 size={12} className="animate-spin text-text-muted" />
                  ) : (
                    <span
                      className="text-xs font-medium text-text-secondary"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      {formatCurrency(line.priceUnit)}
                    </span>
                  )}
                </div>
                <span className="text-xs text-text-muted">&times;</span>
                <input
                  type="number"
                  min="1"
                  value={line.quantity === 0 ? '' : line.quantity}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '') {
                      onQtyChange(line.id, 0);
                      return;
                    }
                    const n = parseInt(raw, 10);
                    if (!Number.isNaN(n)) onQtyChange(line.id, n);
                  }}
                  onBlur={(e) => {
                    const n = parseInt(e.target.value, 10);
                    if (e.target.value === '' || Number.isNaN(n) || n < 1) {
                      onQtyChange(line.id, 1);
                    }
                  }}
                  className="w-14 text-center text-xs font-medium rounded-lg border border-border py-1.5 outline-none bg-bg-tertiary text-text-primary"
                  style={{ fontFamily: 'var(--font-mono)' }}
                />
                <span className="text-xs text-text-muted">=</span>
                <span
                  className={`text-sm font-semibold text-text-primary ml-auto ${isLoading ? 'opacity-40' : ''}`}
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {formatCurrency(line.priceUnit * line.quantity)}
                </span>
              </div>
            </div>
          );
        })}
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
