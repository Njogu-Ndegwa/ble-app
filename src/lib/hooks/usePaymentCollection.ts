/**
 * usePaymentCollection - React hook for managing payment collection flow
 *
 * Encapsulates the complete payment collection logic for battery swaps:
 * - Payment request creation with Odoo
 * - STK push initiation (optional)
 * - Payment confirmation (QR scan or manual entry)
 * - Publishing payment_and_service via MQTT
 *
 * Usage:
 * ```typescript
 * const {
 *   paymentState,
 *   initiatePayment,
 *   confirmPayment,
 *   skipPayment,
 *   resetPayment,
 * } = usePaymentCollection({
 *   customerData,
 *   swapData,
 *   dynamicPlanId,
 *   customerType,
 *   attendantInfo,
 *   electricityServiceId,
 *   onSuccess: () => advanceToStep(6),
 *   onError: (msg) => toast.error(msg),
 * });
 * ```
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
  createPaymentRequest,
  confirmPaymentManual,
  initiatePayment as initiateOdooPayment,
  type PaymentRequestData,
} from '@/lib/odoo-api';
import {
  usePaymentAndService,
  type PublishPaymentAndServiceParams,
} from '@/lib/services/hooks';
import type { CustomerData, SwapData, PaymentInitiation } from '@/app/(mobile)/attendant/attendant/components/types';

// ============================================================================
// Types
// ============================================================================

export interface PaymentCollectionState {
  /** Whether payment has been confirmed */
  paymentConfirmed: boolean;
  /** Receipt/transaction ID from payment */
  paymentReceipt: string | null;
  /** Whether STK push has been sent */
  paymentInitiated: boolean;
  /** STK push response data */
  paymentInitiationData: PaymentInitiation | null;
  /** Whether payment request/ticket has been created in Odoo */
  paymentRequestCreated: boolean;
  /** Payment request data from Odoo */
  paymentRequestData: PaymentRequestData | null;
  /** Order ID from payment request (used for confirmation) */
  paymentRequestOrderId: number | null;
  /** Expected amount customer needs to pay (rounded down from swapData.cost) */
  expectedPaymentAmount: number;
  /** Remaining amount to pay (from Odoo confirmation response) */
  paymentAmountRemaining: number;
  /** Actual amount paid by customer */
  actualAmountPaid: number;
  /** Input mode for payment step */
  paymentInputMode: 'scan' | 'manual';
  /** Manual payment ID input */
  manualPaymentId: string;
  /** Transaction ID (same as receipt, for display) */
  transactionId: string;
  /** Whether payment/service publish is in progress */
  isPublishing: boolean;
}

export interface UsePaymentCollectionOptions {
  /** Customer data (for phone number and subscription info) */
  customerData: CustomerData | null;
  /** Swap data (for amounts and battery info) */
  swapData: SwapData;
  /** Dynamic plan ID (subscription code from QR) */
  dynamicPlanId: string;
  /** Customer type (first-time or returning) */
  customerType: 'first-time' | 'returning' | null;
  /** Attendant info for actor data */
  attendantInfo: { id: string; station: string };
  /** Electricity service ID */
  electricityServiceId?: string;
  /** 
   * Session order ID from backend session management.
   * When provided, payment confirmation will use this orderId instead of 
   * creating a new payment request. The payment amount should be reported
   * via the session update endpoint before calling confirmPayment.
   */
  sessionOrderId?: number | null;
  /** Callback when swap completes successfully */
  onSuccess?: (isIdempotent: boolean) => void;
  /** Callback when an error occurs */
  onError?: (message: string) => void;
}

export interface UsePaymentCollectionReturn {
  /** Current payment state */
  paymentState: PaymentCollectionState;
  /** Set payment input mode (scan/manual) */
  setPaymentInputMode: (mode: 'scan' | 'manual') => void;
  /** Set manual payment ID */
  setManualPaymentId: (id: string) => void;
  /** Create payment request with Odoo (MUST be called before collecting payment) */
  initiatePayment: () => Promise<boolean>;
  /** Confirm payment with receipt (QR scan result or manual entry) */
  confirmPayment: (receipt: string) => Promise<void>;
  /** Skip payment (for quota-based or zero-cost swaps) */
  skipPayment: (isQuotaBased: boolean, isZeroCostRounding: boolean) => void;
  /** Reset all payment state for new swap */
  resetPayment: () => void;
  /** Whether payment/service operation is in progress */
  isProcessing: boolean;
  /** Payment and service publish status */
  publishStatus: 'idle' | 'pending' | 'success' | 'error';
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function usePaymentCollection(
  options: UsePaymentCollectionOptions
): UsePaymentCollectionReturn {
  const {
    customerData,
    swapData,
    dynamicPlanId,
    customerType,
    attendantInfo,
    electricityServiceId = 'service-electricity-default',
    sessionOrderId,
    onSuccess,
    onError,
  } = options;

  // ============================================================================
  // Payment State
  // ============================================================================

  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [paymentReceipt, setPaymentReceipt] = useState<string | null>(null);
  const [paymentInitiated, setPaymentInitiated] = useState(false);
  const [paymentInitiationData, setPaymentInitiationData] = useState<PaymentInitiation | null>(null);
  const [paymentRequestCreated, setPaymentRequestCreated] = useState(false);
  const [paymentRequestData, setPaymentRequestData] = useState<PaymentRequestData | null>(null);
  const [paymentRequestOrderId, setPaymentRequestOrderId] = useState<number | null>(null);
  const [expectedPaymentAmount, setExpectedPaymentAmount] = useState<number>(0);
  const [paymentAmountRemaining, setPaymentAmountRemaining] = useState<number>(0);
  const [actualAmountPaid, setActualAmountPaid] = useState<number>(0);
  const [paymentInputMode, setPaymentInputMode] = useState<'scan' | 'manual'>('scan');
  const [manualPaymentId, setManualPaymentId] = useState<string>('');
  const [transactionId, setTransactionId] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Use refs for callbacks to avoid stale closures
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  }, [onSuccess, onError]);

  // ============================================================================
  // Payment and Service Hook
  // ============================================================================

  const {
    publishPaymentAndService,
    status: publishStatus,
    reset: resetPublishStatus,
  } = usePaymentAndService({
    onSuccess: (isIdempotent) => {
      console.info('payment_and_service completed successfully!', isIdempotent ? '(idempotent)' : '');
      setIsProcessing(false);
      onSuccessRef.current?.(isIdempotent);
    },
    onError: (errorMsg) => {
      console.error('payment_and_service failed:', errorMsg);
      setIsProcessing(false);
      onErrorRef.current?.(errorMsg);
    },
  });

  // ============================================================================
  // Helper: Call publishPaymentAndService with current state
  // ============================================================================

  const callPublishPaymentAndService = useCallback(
    (paymentReference: string, isQuotaBased: boolean = false, isZeroCostRounding: boolean = false) => {
      const params: PublishPaymentAndServiceParams = {
        paymentReference,
        planId: dynamicPlanId,
        swapData: {
          oldBattery: swapData.oldBattery
            ? {
                id: swapData.oldBattery.id,
                actualBatteryId: swapData.oldBattery.actualBatteryId,
                energy: swapData.oldBattery.energy,
              }
            : null,
          newBattery: swapData.newBattery
            ? {
                id: swapData.newBattery.id,
                actualBatteryId: swapData.newBattery.actualBatteryId,
                energy: swapData.newBattery.energy,
              }
            : null,
          energyDiff: swapData.energyDiff,
          cost: swapData.cost,
          rate: swapData.rate,
          currencySymbol: swapData.currencySymbol,
        },
        customerType,
        serviceId: electricityServiceId,
        actor: {
          type: 'attendant',
          id: attendantInfo.id,
          station: attendantInfo.station,
        },
        isQuotaBased,
        isZeroCostRounding,
      };

      console.info('Calling publishPaymentAndService with params:', {
        paymentReference,
        isQuotaBased,
        isZeroCostRounding,
        planId: dynamicPlanId,
        customerType,
        serviceId: electricityServiceId,
        oldBatteryId: swapData.oldBattery?.actualBatteryId || swapData.oldBattery?.id,
        newBatteryId: swapData.newBattery?.actualBatteryId || swapData.newBattery?.id,
        energyDiff: swapData.energyDiff,
        cost: swapData.cost,
      });

      publishPaymentAndService(params);
    },
    [publishPaymentAndService, dynamicPlanId, swapData, customerType, electricityServiceId, attendantInfo]
  );

  // Ref for callPublishPaymentAndService to avoid stale closures in async callbacks
  const callPublishRef = useRef(callPublishPaymentAndService);
  useEffect(() => {
    callPublishRef.current = callPublishPaymentAndService;
  }, [callPublishPaymentAndService]);

  // ============================================================================
  // Initiate Payment (Prepare for payment collection)
  // ============================================================================
  // 
  // When sessionOrderId is provided (new flow):
  //   - Payment amount is reported via session update endpoint (updateSessionWithPayment)
  //   - We just set local state and optionally send STK push
  //   - confirmPayment will use sessionOrderId for validation
  //
  // When sessionOrderId is NOT provided (legacy flow):
  //   - Create a new payment request via /api/payment-request/create
  //   - confirmPayment will use the returned paymentRequestOrderId

  const initiatePayment = useCallback(async (): Promise<boolean> => {
    const subscriptionCode = customerData?.subscriptionId || dynamicPlanId;

    if (!subscriptionCode) {
      console.log('No subscription ID, skipping payment initiation');
      setPaymentInitiated(true);
      setPaymentRequestCreated(true);
      return true;
    }

    const phoneNumber = customerData?.phone || '';

    try {
      // Calculate amounts - rounded down for payment (customers can't pay decimals)
      const amountRequired = Math.floor(swapData.cost);
      setExpectedPaymentAmount(amountRequired);

      // NEW FLOW: When sessionOrderId is provided, payment is reported via session update
      // No need to create a separate payment request - just mark as ready for payment collection
      if (sessionOrderId) {
        console.log('Using session-based payment flow with orderId:', sessionOrderId);
        console.log('Payment amount:', amountRequired, 'will be confirmed against session order');
        
        setPaymentRequestCreated(true);
        // Use sessionOrderId for payment confirmation
        setPaymentRequestOrderId(sessionOrderId);
        toast.success('Payment ticket ready. Collect payment from customer.');

        // Optionally try to send STK push (don't block if it fails)
        if (phoneNumber) {
          try {
            console.log('Sending STK push to customer phone:', phoneNumber);
            const stkResponse = await initiateOdooPayment({
              subscription_code: subscriptionCode,
              phone_number: phoneNumber,
              amount: amountRequired,
            });

            if (stkResponse.success && stkResponse.data) {
              console.log('STK push sent:', stkResponse.data);
              setPaymentInitiationData({
                transactionId: stkResponse.data.transaction_id,
                checkoutRequestId: stkResponse.data.checkout_request_id,
                merchantRequestId: stkResponse.data.merchant_request_id,
                instructions: stkResponse.data.instructions,
              });
              toast.success(stkResponse.data.instructions || 'Check customer phone for M-Pesa prompt');
            }
          } catch (stkError) {
            console.warn('STK push failed (non-blocking):', stkError);
          }
        }

        setPaymentInitiated(true);
        return true;
      }

      // LEGACY FLOW: Create a new payment request when no sessionOrderId
      console.log('Creating payment request with Odoo (legacy flow):', {
        subscription_code: subscriptionCode,
        amount_calculated: swapData.cost,
        amount_required: amountRequired,
        description: `Battery swap service - Energy: ${swapData.energyDiff} Wh`,
      });

      const paymentRequestResponse = await createPaymentRequest({
        subscription_code: subscriptionCode,
        amount_required: amountRequired,
        description: `Battery swap service - Energy: ${swapData.energyDiff} Wh`,
      });

      if (paymentRequestResponse.success && paymentRequestResponse.payment_request) {
        console.log('Payment request created:', paymentRequestResponse.payment_request);
        setPaymentRequestCreated(true);
        setPaymentRequestData(paymentRequestResponse.payment_request);
        setPaymentRequestOrderId(paymentRequestResponse.payment_request.sale_order.id);
        toast.success('Payment ticket created. Collect payment from customer.');
      } else {
        console.error('Payment request creation failed:', paymentRequestResponse.error);

        let errorMessage = paymentRequestResponse.error || 'Failed to create payment request';

        if (paymentRequestResponse.existing_request) {
          const existingReq = paymentRequestResponse.existing_request;
          errorMessage = `${paymentRequestResponse.message || errorMessage}\n\nExisting request: ${swapData.currencySymbol} ${existingReq.amount_remaining} remaining (${existingReq.status})`;
          console.log('Existing request actions:', existingReq.actions);
        }

        if (paymentRequestResponse.instructions && paymentRequestResponse.instructions.length > 0) {
          console.log('Instructions:', paymentRequestResponse.instructions);
        }

        toast.error(errorMessage);
        return false;
      }

      // Step 2: Optionally try to send STK push (don't block if it fails)
      if (phoneNumber) {
        try {
          console.log('Sending STK push to customer phone:', phoneNumber);
          const stkResponse = await initiateOdooPayment({
            subscription_code: subscriptionCode,
            phone_number: phoneNumber,
            amount: amountRequired,
          });

          if (stkResponse.success && stkResponse.data) {
            console.log('STK push sent:', stkResponse.data);
            setPaymentInitiated(true);
            setPaymentInitiationData({
              transactionId: stkResponse.data.transaction_id,
              checkoutRequestId: stkResponse.data.checkout_request_id,
              merchantRequestId: stkResponse.data.merchant_request_id,
              instructions: stkResponse.data.instructions,
            });
            toast.success(stkResponse.data.instructions || 'Check customer phone for M-Pesa prompt');
          }
        } catch (stkError) {
          console.warn('STK push failed (non-blocking):', stkError);
        }
      }

      setPaymentInitiated(true);
      return true;
    } catch (error: any) {
      console.error('Failed to initiate payment:', error);
      toast.error(error.message || 'Failed to initiate payment. Please try again.');
      return false;
    }
  }, [customerData, dynamicPlanId, swapData.cost, swapData.energyDiff, swapData.currencySymbol, sessionOrderId]);

  // ============================================================================
  // Confirm Payment (QR or Manual)
  // ============================================================================

  const confirmPayment = useCallback(
    async (receipt: string) => {
      setIsProcessing(true);

      const orderId = paymentRequestOrderId;

      try {
        // Ensure payment request was created first
        if (!paymentRequestCreated) {
          const success = await initiatePayment();
          if (!success) {
            setIsProcessing(false);
            return;
          }
        }

        if (!orderId && !paymentRequestOrderId) {
          toast.error('Payment request not created. Please go back and try again.');
          setIsProcessing(false);
          return;
        }

        const finalOrderId = orderId || paymentRequestOrderId;
        console.log('Confirming payment with order_id:', { order_id: finalOrderId, receipt });
        const response = await confirmPaymentManual({ order_id: finalOrderId!, receipt });

        if (response.success) {
          const responseData = response.data || (response as any);
          const totalPaid = responseData.total_paid ?? responseData.amount_paid ?? 0;
          const remainingToPay = responseData.remaining_to_pay ?? responseData.amount_remaining ?? 0;

          console.log('Payment validation response:', {
            total_paid: totalPaid,
            remaining_to_pay: remainingToPay,
            expected_to_pay: responseData.expected_to_pay ?? responseData.amount_expected,
            order_id: responseData.order_id,
            expectedPaymentAmount,
          });

          setActualAmountPaid(totalPaid);
          setPaymentAmountRemaining(remainingToPay);

          // Check if payment is sufficient
          const requiredAmount = expectedPaymentAmount || Math.floor(swapData.cost);
          if (totalPaid < requiredAmount) {
            const shortfall = requiredAmount - totalPaid;
            toast.error(
              `Payment insufficient. Customer paid ${swapData.currencySymbol} ${totalPaid}, but needs to pay ${swapData.currencySymbol} ${requiredAmount}. Short by ${swapData.currencySymbol} ${shortfall}`
            );
            setIsProcessing(false);
            return;
          }

          // Payment sufficient - proceed with service completion
          setPaymentConfirmed(true);
          setPaymentReceipt(receipt);
          setTransactionId(receipt);
          toast.success('Payment confirmed successfully');

          // Report payment - uses original calculated cost for accurate quota tracking
          callPublishRef.current(receipt, false);
        } else {
          throw new Error('Payment confirmation failed');
        }
      } catch (err: any) {
        console.error('Payment confirmation error:', err);
        toast.error(err.message || 'Payment confirmation failed. Check network connection.');
        setIsProcessing(false);
      }
    },
    [
      paymentRequestOrderId,
      paymentRequestCreated,
      initiatePayment,
      expectedPaymentAmount,
      swapData.cost,
      swapData.currencySymbol,
    ]
  );

  // ============================================================================
  // Skip Payment (Quota-based or Zero-cost)
  // ============================================================================

  const skipPayment = useCallback(
    (isQuotaBased: boolean, isZeroCostRounding: boolean) => {
      const reason = isQuotaBased ? 'sufficient quota' : 'zero cost (rounded)';
      console.info(`Skipping payment step - ${reason}`, {
        isQuotaBased,
        isZeroCostRounding,
        cost: swapData.cost,
        roundedCost: Math.floor(swapData.cost),
      });

      toast.success(isQuotaBased ? 'Using quota credit - no payment required' : 'No payment required - zero cost');

      const skipReference = isZeroCostRounding ? `ZERO_COST_${Date.now()}` : `QUOTA_${Date.now()}`;
      setPaymentConfirmed(true);
      setPaymentReceipt(skipReference);
      setTransactionId(skipReference);

      callPublishRef.current(skipReference, isQuotaBased, isZeroCostRounding);
    },
    [swapData.cost]
  );

  // ============================================================================
  // Reset Payment State
  // ============================================================================

  const resetPayment = useCallback(() => {
    setPaymentConfirmed(false);
    setPaymentReceipt(null);
    setPaymentInitiated(false);
    setPaymentInitiationData(null);
    setPaymentRequestCreated(false);
    setPaymentRequestData(null);
    setPaymentRequestOrderId(null);
    setExpectedPaymentAmount(0);
    setPaymentAmountRemaining(0);
    setActualAmountPaid(0);
    setPaymentInputMode('scan');
    setManualPaymentId('');
    setTransactionId('');
    setIsProcessing(false);
    resetPublishStatus();
  }, [resetPublishStatus]);

  // ============================================================================
  // Return
  // ============================================================================

  const paymentState: PaymentCollectionState = {
    paymentConfirmed,
    paymentReceipt,
    paymentInitiated,
    paymentInitiationData,
    paymentRequestCreated,
    paymentRequestData,
    paymentRequestOrderId,
    expectedPaymentAmount,
    paymentAmountRemaining,
    actualAmountPaid,
    paymentInputMode,
    manualPaymentId,
    transactionId,
    isPublishing: publishStatus === 'pending',
  };

  return {
    paymentState,
    setPaymentInputMode,
    setManualPaymentId,
    initiatePayment,
    confirmPayment,
    skipPayment,
    resetPayment,
    isProcessing: isProcessing || publishStatus === 'pending',
    publishStatus,
  };
}
