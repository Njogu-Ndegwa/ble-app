/**
 * useWorkflowSession - Reusable hook for backend session management
 * 
 * This hook manages workflow session persistence to the backend,
 * allowing users to resume interrupted workflows (Attendant or SalesPerson).
 * 
 * Key features:
 * - Creates session on customer identification (Step 1)
 * - Updates session on each step transition
 * - Supports payment reporting on specific steps
 * - Fetches and restores pending sessions
 * - Works for both Attendant and SalesPerson workflows
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  createWorkflowSession,
  updateWorkflowSession,
  updateWorkflowSessionWithPayment,
  getLatestPendingSession,
  type WorkflowSessionData,
  type CreateSessionResponse,
  type UpdateSessionResponse,
  type LatestPendingSessionResponse,
} from '@/lib/odoo-api';
import { getEmployeeToken } from '@/lib/attendant-auth';

// Session states for UI
export type SessionStatus = 
  | 'idle'           // No session
  | 'checking'       // Checking for pending session
  | 'has_pending'    // Found a pending session
  | 'creating'       // Creating new session
  | 'active'         // Session is active
  | 'updating'       // Updating session
  | 'error';         // Error occurred

// Hook configuration
export interface UseWorkflowSessionConfig {
  /** Type of workflow - determines session behavior */
  workflowType: 'attendant' | 'salesperson';
  /** Enable auto-save on session data changes */
  autoSave?: boolean;
  /** Debounce delay for auto-save (ms) */
  autoSaveDelay?: number;
  /** Callback when session is restored */
  onSessionRestored?: (sessionData: WorkflowSessionData, orderId: number) => void;
  /** Callback on error */
  onError?: (error: string) => void;
}

// Session summary for display (used in resume prompt)
export interface SessionSummary {
  orderId: number;
  orderName: string;
  currentStep: number;
  maxStepReached: number;
  customerName?: string;
  subscriptionCode?: string;
  savedAt?: string;
  workflowType: 'attendant' | 'salesperson';
}

// Return type for the hook
export interface UseWorkflowSessionReturn {
  // State
  status: SessionStatus;
  orderId: number | null;
  sessionData: WorkflowSessionData | null;
  pendingSession: SessionSummary | null;
  error: string | null;
  
  // Session lifecycle
  checkForPendingSession: () => Promise<boolean>;
  createSession: (subscriptionCode: string, initialData: WorkflowSessionData) => Promise<number | null>;
  updateSession: (data: WorkflowSessionData) => Promise<boolean>;
  updateSessionWithPayment: (data: WorkflowSessionData, description: string, amountRequired: number) => Promise<boolean>;
  
  // Session restoration
  restoreSession: () => Promise<WorkflowSessionData | null>;
  discardPendingSession: () => void;
  
  // Session management
  clearSession: () => void;
  
  // Loading states
  isLoading: boolean;
  isChecking: boolean;
  isCreating: boolean;
  isUpdating: boolean;
}

/**
 * Hook for managing workflow session persistence
 */
export function useWorkflowSession(config: UseWorkflowSessionConfig): UseWorkflowSessionReturn {
  const { 
    workflowType, 
    autoSave = false, 
    autoSaveDelay = 1000,
    onSessionRestored,
    onError,
  } = config;
  
  // State
  const [status, setStatus] = useState<SessionStatus>('idle');
  const [orderId, setOrderId] = useState<number | null>(null);
  const [sessionData, setSessionData] = useState<WorkflowSessionData | null>(null);
  const [pendingSession, setPendingSession] = useState<SessionSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Refs for auto-save
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedDataRef = useRef<string>('');
  
  // Get auth token
  const getAuthToken = useCallback((): string | undefined => {
    return getEmployeeToken() || undefined;
  }, []);
  
  // Clear auto-save timer
  const clearAutoSaveTimer = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
  }, []);
  
  // Handle errors
  const handleError = useCallback((message: string) => {
    setError(message);
    setStatus('error');
    onError?.(message);
  }, [onError]);
  
  /**
   * Check for pending session from backend
   */
  const checkForPendingSession = useCallback(async (): Promise<boolean> => {
    const authToken = getAuthToken();
    if (!authToken) {
      console.warn('[useWorkflowSession] No auth token - cannot check for pending session');
      return false;
    }
    
    setStatus('checking');
    setError(null);
    
    try {
      const response = await getLatestPendingSession(authToken);
      
      // Note: Session is nested inside order.session, not at top level
      // Check if we have a valid pending session
      const session = response.order?.session;
      const isActiveSession = session?.state === 'active';
      
      if (response.success && response.order && session && isActiveSession) {
        // Check if the pending session is for the correct workflow type
        const sessionDataFromServer = session.session_data;
        
        // If session has workflow type and it doesn't match, ignore it
        if (sessionDataFromServer?.workflowType && sessionDataFromServer.workflowType !== workflowType) {
          console.info(`[useWorkflowSession] Found pending session but wrong type: ${sessionDataFromServer.workflowType} vs ${workflowType}`);
          setStatus('idle');
          return false;
        }
        
        // Check if the session is "effectively complete" and should not be resumed
        // This handles edge cases where the session was saved just before completion
        // (e.g., user was at Review step, clicked "Proceed", and app closed before MQTT response)
        if (isSessionEffectivelyComplete(sessionDataFromServer, workflowType)) {
          console.info('[useWorkflowSession] Found pending session but it appears effectively complete - ignoring:', {
            currentStep: sessionDataFromServer?.currentStep,
            maxStepReached: sessionDataFromServer?.maxStepReached,
            hasSwapData: !!(sessionDataFromServer?.swapData?.oldBattery && sessionDataFromServer?.swapData?.newBattery),
            cost: sessionDataFromServer?.swapData?.cost,
          });
          setStatus('idle');
          return false;
        }
        
        // Build session summary for UI
        const summary: SessionSummary = {
          orderId: response.order.id,
          orderName: response.order.name,
          currentStep: sessionDataFromServer?.currentStep || 1,
          maxStepReached: sessionDataFromServer?.maxStepReached || 1,
          customerName: sessionDataFromServer?.customerData?.name || session.partner_name,
          subscriptionCode: response.order.subscription_code || sessionDataFromServer?.dynamicPlanId,
          savedAt: sessionDataFromServer?.savedAt 
            ? formatTimestamp(sessionDataFromServer.savedAt) 
            : session.start_date,
          workflowType: sessionDataFromServer?.workflowType || workflowType,
        };
        
        setPendingSession(summary);
        setStatus('has_pending');
        
        console.info('[useWorkflowSession] Found pending session:', summary);
        return true;
      }
      
      setStatus('idle');
      return false;
    } catch (err: any) {
      console.error('[useWorkflowSession] Error checking for pending session:', err);
      // Don't treat as fatal error - just means no pending session
      setStatus('idle');
      return false;
    }
  }, [getAuthToken, workflowType]);
  
  /**
   * Create a new session (called after customer identification)
   */
  const createSession = useCallback(async (
    subscriptionCode: string,
    initialData: WorkflowSessionData
  ): Promise<number | null> => {
    const authToken = getAuthToken();
    
    setStatus('creating');
    setError(null);
    
    try {
      // Ensure workflow type is set
      const sessionPayload: WorkflowSessionData = {
        ...initialData,
        workflowType,
        savedAt: Date.now(),
        version: 1,
      };
      
      const response = await createWorkflowSession({
        subscription_code: subscriptionCode,
        session_data: sessionPayload,
      }, authToken);
      
      if (response.success && response.order_id) {
        setOrderId(response.order_id);
        setSessionData(sessionPayload);
        setStatus('active');
        lastSavedDataRef.current = JSON.stringify(sessionPayload);
        
        console.info('[useWorkflowSession] Session created with order_id:', response.order_id);
        return response.order_id;
      }
      
      throw new Error('Session creation failed - no order_id returned');
    } catch (err: any) {
      console.error('[useWorkflowSession] Error creating session:', err);
      handleError(err.message || 'Failed to create session');
      return null;
    }
  }, [getAuthToken, workflowType, handleError]);
  
  /**
   * Update session with new data (normal step transitions)
   */
  const updateSession = useCallback(async (data: WorkflowSessionData): Promise<boolean> => {
    if (!orderId) {
      console.warn('[useWorkflowSession] Cannot update session - no orderId');
      return false;
    }
    
    const authToken = getAuthToken();
    
    setStatus('updating');
    setError(null);
    
    try {
      // Ensure metadata is updated
      const sessionPayload: WorkflowSessionData = {
        ...data,
        workflowType,
        savedAt: Date.now(),
      };
      
      await updateWorkflowSession(orderId, {
        session_data: sessionPayload,
      }, authToken);
      
      setSessionData(sessionPayload);
      setStatus('active');
      lastSavedDataRef.current = JSON.stringify(sessionPayload);
      
      console.info('[useWorkflowSession] Session updated for order_id:', orderId);
      return true;
    } catch (err: any) {
      console.error('[useWorkflowSession] Error updating session:', err);
      handleError(err.message || 'Failed to update session');
      return false;
    }
  }, [orderId, getAuthToken, workflowType, handleError]);
  
  /**
   * Update session with payment information (Step 4 - payment reporting)
   */
  const updateSessionWithPayment = useCallback(async (
    data: WorkflowSessionData,
    description: string,
    amountRequired: number
  ): Promise<boolean> => {
    if (!orderId) {
      console.warn('[useWorkflowSession] Cannot update session with payment - no orderId');
      return false;
    }
    
    const authToken = getAuthToken();
    
    setStatus('updating');
    setError(null);
    
    try {
      // Ensure metadata is updated
      const sessionPayload: WorkflowSessionData = {
        ...data,
        workflowType,
        savedAt: Date.now(),
      };
      
      await updateWorkflowSessionWithPayment(orderId, {
        session_data: sessionPayload,
        description,
        amount_required: amountRequired,
      }, authToken);
      
      setSessionData(sessionPayload);
      setStatus('active');
      lastSavedDataRef.current = JSON.stringify(sessionPayload);
      
      console.info('[useWorkflowSession] Session updated with payment for order_id:', orderId);
      return true;
    } catch (err: any) {
      console.error('[useWorkflowSession] Error updating session with payment:', err);
      handleError(err.message || 'Failed to update session with payment');
      return false;
    }
  }, [orderId, getAuthToken, workflowType, handleError]);
  
  /**
   * Restore a pending session
   */
  const restoreSession = useCallback(async (): Promise<WorkflowSessionData | null> => {
    if (!pendingSession) {
      console.warn('[useWorkflowSession] No pending session to restore');
      return null;
    }
    
    const authToken = getAuthToken();
    if (!authToken) {
      console.warn('[useWorkflowSession] No auth token - cannot restore session');
      return null;
    }
    
    try {
      const response = await getLatestPendingSession(authToken);
      
      // Note: Session is nested inside order.session, not at top level
      const session = response.order?.session;
      
      if (response.success && response.order && session?.session_data) {
        const restoredData = session.session_data;
        
        setOrderId(response.order.id);
        setSessionData(restoredData);
        setPendingSession(null);
        setStatus('active');
        lastSavedDataRef.current = JSON.stringify(restoredData);
        
        console.info('[useWorkflowSession] Session restored for order_id:', response.order.id);
        
        // Notify callback
        onSessionRestored?.(restoredData, response.order.id);
        
        return restoredData;
      }
      
      return null;
    } catch (err: any) {
      console.error('[useWorkflowSession] Error restoring session:', err);
      handleError(err.message || 'Failed to restore session');
      return null;
    }
  }, [pendingSession, getAuthToken, onSessionRestored, handleError]);
  
  /**
   * Discard pending session (start fresh)
   */
  const discardPendingSession = useCallback(() => {
    setPendingSession(null);
    setStatus('idle');
    console.info('[useWorkflowSession] Pending session discarded');
  }, []);
  
  /**
   * Clear current session (workflow completed or cancelled)
   */
  const clearSession = useCallback(() => {
    clearAutoSaveTimer();
    setOrderId(null);
    setSessionData(null);
    setPendingSession(null);
    setStatus('idle');
    setError(null);
    lastSavedDataRef.current = '';
    console.info('[useWorkflowSession] Session cleared');
  }, [clearAutoSaveTimer]);
  
  // Auto-save effect
  useEffect(() => {
    if (!autoSave || !orderId || !sessionData) return;
    
    const currentDataString = JSON.stringify(sessionData);
    
    // Skip if data hasn't changed
    if (currentDataString === lastSavedDataRef.current) return;
    
    clearAutoSaveTimer();
    
    autoSaveTimerRef.current = setTimeout(async () => {
      console.info('[useWorkflowSession] Auto-saving session...');
      await updateSession(sessionData);
    }, autoSaveDelay);
    
    return clearAutoSaveTimer;
  }, [autoSave, orderId, sessionData, autoSaveDelay, updateSession, clearAutoSaveTimer]);
  
  // Cleanup on unmount
  useEffect(() => {
    return clearAutoSaveTimer;
  }, [clearAutoSaveTimer]);
  
  return {
    // State
    status,
    orderId,
    sessionData,
    pendingSession,
    error,
    
    // Session lifecycle
    checkForPendingSession,
    createSession,
    updateSession,
    updateSessionWithPayment,
    
    // Session restoration
    restoreSession,
    discardPendingSession,
    
    // Session management
    clearSession,
    
    // Loading states
    isLoading: status === 'checking' || status === 'creating' || status === 'updating',
    isChecking: status === 'checking',
    isCreating: status === 'creating',
    isUpdating: status === 'updating',
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a session is "effectively complete" and should not be resumed
 * 
 * This handles edge cases where:
 * 1. User was at the Review step (step 4) and clicked "Proceed"
 * 2. The swap was quota-based (cost <= 0) so payment was skipped
 * 3. The MQTT publish was triggered but app closed before response
 * 4. Session remains at step 4 but the swap may have already been recorded
 * 
 * In such cases, resuming could lead to duplicate swaps or confusing UX.
 * We consider a session "effectively complete" if:
 * - Session status is 'completed'
 * - Attendant workflow at step 6 (success)
 * - Attendant workflow at step 4+ with both batteries scanned and cost <= 0
 * - Attendant workflow at step 5+ (payment phase or later)
 * - SalesPerson workflow at the final registration step
 */
function isSessionEffectivelyComplete(
  sessionData: WorkflowSessionData | undefined,
  workflowType: 'attendant' | 'salesperson'
): boolean {
  if (!sessionData) return false;
  
  // If status is explicitly 'completed', don't resume
  if (sessionData.status === 'completed') {
    return true;
  }
  
  const currentStep = sessionData.currentStep || 1;
  const maxStepReached = sessionData.maxStepReached || 1;
  
  if (workflowType === 'attendant') {
    // For attendant workflow:
    // - Steps 1-3: Customer/Battery scanning - safe to resume
    // - Step 4 (Review): 
    //   - If cost <= 0 and both batteries present, likely completed without payment
    //   - If cost > 0, might be waiting for payment - could resume
    // - Step 5+ (Payment/Success): Already in final phase
    // - Step 6: Success step - definitely complete
    
    const swapData = sessionData.swapData;
    const hasBothBatteries = !!(swapData?.oldBattery && swapData?.newBattery);
    const cost = swapData?.cost ?? 0;
    const chargeableEnergy = swapData?.chargeableEnergy ?? 0;
    
    // Step 6 is the success step - definitely complete
    if (currentStep >= 6 || maxStepReached >= 6) {
      return true;
    }
    
    // Step 5 or higher - already past the point of no return (in payment phase)
    if (currentStep >= 5 || maxStepReached >= 5) {
      return true;
    }
    
    // Step 4 with both batteries and no payment needed (quota-based or zero cost)
    // This is the case where user clicked "Proceed" and skipPayment was called
    if (currentStep === 4 && maxStepReached === 4 && hasBothBatteries) {
      // Cost is 0 or negative means no payment was required
      if (cost <= 0) {
        return true;
      }
      
      // Chargeable energy is 0 or negative means quota covered everything
      if (chargeableEnergy <= 0) {
        return true;
      }
    }
    
    return false;
  }
  
  // For salesperson workflow, similar logic could be added if needed
  // For now, just check if at the final step
  if (workflowType === 'salesperson') {
    // Step 7 is the success step for salesperson
    if (currentStep >= 7 || maxStepReached >= 7) {
      return true;
    }
  }
  
  return false;
}

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp: number): string {
  const now = Date.now();
  const elapsed = now - timestamp;
  const minutes = Math.floor(elapsed / 60000);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else {
    return 'just now';
  }
}

/**
 * Build session data from Attendant workflow state
 * Helper function to construct WorkflowSessionData from component state
 */
export function buildAttendantSessionData(state: {
  currentStep: number;
  maxStepReached: number;
  actor?: { id: string; station: string };
  inputMode: 'scan' | 'manual';
  manualSubscriptionId: string;
  dynamicPlanId: string;
  customerData: any | null;
  customerType: 'first-time' | 'returning' | null;
  serviceStates: any[];
  swapData: any;
  paymentState?: {
    inputMode: 'scan' | 'manual';
    manualPaymentId: string;
    requestCreated: boolean;
    requestOrderId: number | null;
    expectedAmount: number;
    amountRemaining: number;
    amountPaid: number;
    transactionId: string | null;
    skipped: boolean;
    skipReason: string | null;
  };
  flowError: any | null;
}): WorkflowSessionData {
  // Step 6 is the success/completion step for attendant workflow
  const isCompleted = state.currentStep >= 6;
  
  return {
    status: isCompleted ? 'completed' : 'in_progress',
    workflowType: 'attendant',
    currentStep: state.currentStep,
    maxStepReached: state.maxStepReached,
    actor: state.actor ? {
      employeeId: parseInt(state.actor.id.replace(/\D/g, '')) || undefined,
      station: state.actor.station,
    } : undefined,
    inputMode: state.inputMode,
    manualSubscriptionId: state.manualSubscriptionId,
    dynamicPlanId: state.dynamicPlanId,
    customerData: state.customerData ? {
      id: state.customerData.id,
      name: state.customerData.name,
      subscriptionId: state.customerData.subscriptionId,
      subscriptionType: state.customerData.subscriptionType,
      phone: state.customerData.phone,
      swapCount: state.customerData.swapCount,
      lastSwap: state.customerData.lastSwap,
      energyRemaining: state.customerData.energyRemaining,
      energyTotal: state.customerData.energyTotal,
      energyValue: state.customerData.energyValue,
      energyUnitPrice: state.customerData.energyUnitPrice,
      swapsRemaining: state.customerData.swapsRemaining,
      swapsTotal: state.customerData.swapsTotal,
      hasInfiniteEnergyQuota: state.customerData.hasInfiniteEnergyQuota,
      hasInfiniteSwapQuota: state.customerData.hasInfiniteSwapQuota,
      paymentState: state.customerData.paymentState,
      serviceState: state.customerData.serviceState,
      currentBatteryId: state.customerData.currentBatteryId,
    } : undefined,
    customerType: state.customerType || undefined,
    serviceStates: state.serviceStates.map(s => ({
      service_id: s.service_id,
      name: s.name,
      used: s.used,
      quota: s.quota,
      current_asset: s.current_asset,
      usageUnitPrice: s.usageUnitPrice,
    })),
    swapData: {
      oldBattery: state.swapData.oldBattery ? {
        id: state.swapData.oldBattery.id,
        shortId: state.swapData.oldBattery.shortId,
        actualBatteryId: state.swapData.oldBattery.actualBatteryId,
        chargeLevel: state.swapData.oldBattery.chargeLevel,
        energy: state.swapData.oldBattery.energy,
        macAddress: state.swapData.oldBattery.macAddress,
      } : null,
      newBattery: state.swapData.newBattery ? {
        id: state.swapData.newBattery.id,
        shortId: state.swapData.newBattery.shortId,
        actualBatteryId: state.swapData.newBattery.actualBatteryId,
        chargeLevel: state.swapData.newBattery.chargeLevel,
        energy: state.swapData.newBattery.energy,
        macAddress: state.swapData.newBattery.macAddress,
      } : null,
      energyDiff: state.swapData.energyDiff,
      quotaDeduction: state.swapData.quotaDeduction,
      chargeableEnergy: state.swapData.chargeableEnergy,
      grossEnergyCost: state.swapData.grossEnergyCost,
      quotaCreditValue: state.swapData.quotaCreditValue,
      cost: state.swapData.cost,
      rate: state.swapData.rate,
      currencySymbol: state.swapData.currencySymbol,
    },
    payment: state.paymentState ? {
      inputMode: state.paymentState.inputMode,
      manualPaymentId: state.paymentState.manualPaymentId,
      requestCreated: state.paymentState.requestCreated,
      requestOrderId: state.paymentState.requestOrderId,
      expectedAmount: state.paymentState.expectedAmount,
      amountRemaining: state.paymentState.amountRemaining,
      amountPaid: state.paymentState.amountPaid,
      transactionId: state.paymentState.transactionId,
      skipped: state.paymentState.skipped,
      skipReason: state.paymentState.skipReason,
    } : undefined,
    flowError: state.flowError ? {
      step: state.flowError.step,
      message: state.flowError.message,
      details: state.flowError.details,
    } : null,
    savedAt: Date.now(),
    version: 1,
  };
}

/**
 * Restore Attendant workflow state from session data
 * Helper function to extract component state from WorkflowSessionData
 */
export function extractAttendantStateFromSession(sessionData: WorkflowSessionData): {
  currentStep: number;
  maxStepReached: number;
  inputMode: 'scan' | 'manual';
  manualSubscriptionId: string;
  dynamicPlanId: string;
  customerData: any | null;
  customerType: 'first-time' | 'returning' | null;
  serviceStates: any[];
  swapData: any;
  paymentState: {
    inputMode: 'scan' | 'manual';
    manualPaymentId: string;
    requestCreated: boolean;
    requestOrderId: number | null;
    expectedAmount: number;
    amountRemaining: number;
    amountPaid: number;
    transactionId: string | null;
    skipped: boolean;
    skipReason: string | null;
  };
  flowError: any | null;
} {
  return {
    currentStep: sessionData.currentStep || 1,
    maxStepReached: sessionData.maxStepReached || 1,
    inputMode: sessionData.inputMode || 'scan',
    manualSubscriptionId: sessionData.manualSubscriptionId || '',
    dynamicPlanId: sessionData.dynamicPlanId || '',
    customerData: sessionData.customerData ? {
      id: sessionData.customerData.id || '',
      name: sessionData.customerData.name || '',
      subscriptionId: sessionData.customerData.subscriptionId || '',
      subscriptionType: sessionData.customerData.subscriptionType || '',
      phone: sessionData.customerData.phone,
      swapCount: sessionData.customerData.swapCount,
      lastSwap: sessionData.customerData.lastSwap,
      energyRemaining: sessionData.customerData.energyRemaining,
      energyTotal: sessionData.customerData.energyTotal,
      energyValue: sessionData.customerData.energyValue,
      energyUnitPrice: sessionData.customerData.energyUnitPrice,
      swapsRemaining: sessionData.customerData.swapsRemaining,
      swapsTotal: sessionData.customerData.swapsTotal,
      hasInfiniteEnergyQuota: sessionData.customerData.hasInfiniteEnergyQuota,
      hasInfiniteSwapQuota: sessionData.customerData.hasInfiniteSwapQuota,
      paymentState: sessionData.customerData.paymentState,
      serviceState: sessionData.customerData.serviceState,
      currentBatteryId: sessionData.customerData.currentBatteryId,
    } : null,
    customerType: sessionData.customerType || null,
    serviceStates: sessionData.serviceStates || [],
    swapData: {
      oldBattery: sessionData.swapData?.oldBattery || null,
      newBattery: sessionData.swapData?.newBattery || null,
      energyDiff: sessionData.swapData?.energyDiff || 0,
      quotaDeduction: sessionData.swapData?.quotaDeduction || 0,
      chargeableEnergy: sessionData.swapData?.chargeableEnergy || 0,
      grossEnergyCost: sessionData.swapData?.grossEnergyCost || 0,
      quotaCreditValue: sessionData.swapData?.quotaCreditValue || 0,
      cost: sessionData.swapData?.cost || 0,
      rate: sessionData.swapData?.rate || 120,
      currencySymbol: sessionData.swapData?.currencySymbol || 'KES',
    },
    paymentState: {
      inputMode: sessionData.payment?.inputMode || 'scan',
      manualPaymentId: sessionData.payment?.manualPaymentId || '',
      requestCreated: sessionData.payment?.requestCreated || false,
      requestOrderId: sessionData.payment?.requestOrderId || null,
      expectedAmount: sessionData.payment?.expectedAmount || 0,
      amountRemaining: sessionData.payment?.amountRemaining || 0,
      amountPaid: sessionData.payment?.amountPaid || 0,
      transactionId: sessionData.payment?.transactionId || null,
      skipped: sessionData.payment?.skipped || false,
      skipReason: sessionData.payment?.skipReason || null,
    },
    flowError: sessionData.flowError || null,
  };
}

export default useWorkflowSession;
