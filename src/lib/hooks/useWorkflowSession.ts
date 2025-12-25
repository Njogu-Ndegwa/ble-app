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
  createSalesWorkflowSession,
  updateWorkflowSessionWithProducts,
  type WorkflowSessionData,
  type CreateSessionResponse,
  type UpdateSessionResponse,
  type LatestPendingSessionResponse,
} from '@/lib/odoo-api';
import { getEmployeeToken, getSalesRoleToken } from '@/lib/attendant-auth';
import { PAYMENT } from '@/lib/constants';

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

// Product item for sales workflow
export interface SessionProductItem {
  product_id: number;
  quantity: number;
  price_unit: number;
}

// Result from updating session with products (includes subscription code from backend)
export interface UpdateSessionWithProductsResult {
  success: boolean;
  /** Subscription code created when products are added to order */
  subscriptionCode?: string;
  /** Array of subscriptions created (if multiple products created subscriptions) */
  subscriptionsCreated?: Array<{
    subscription_code: string;
    product_id: number;
    product_name: string;
  }>;
}

// Return type for the hook
export interface UseWorkflowSessionReturn {
  // State
  status: SessionStatus;
  orderId: number | null;
  sessionData: WorkflowSessionData | null;
  pendingSession: SessionSummary | null;
  error: string | null;
  
  // Session lifecycle - Attendant workflow
  checkForPendingSession: () => Promise<boolean>;
  createSession: (subscriptionCode: string, initialData: WorkflowSessionData) => Promise<number | null>;
  updateSession: (data: WorkflowSessionData) => Promise<boolean>;
  updateSessionWithPayment: (data: WorkflowSessionData, description: string, amountRequired: number) => Promise<boolean>;
  
  // Session lifecycle - Sales workflow
  /** Create a session for Sales workflow using customer_id instead of subscription_code */
  createSalesSession: (customerId: number, companyId: number, initialData: WorkflowSessionData) => Promise<number | null>;
  /** 
   * Update session with products (Sales workflow Step 4 - payment step)
   * Returns the subscription code created by the backend
   */
  updateSessionWithProducts: (data: WorkflowSessionData, products: SessionProductItem[]) => Promise<UpdateSessionWithProductsResult>;
  
  // Session restoration
  restoreSession: () => Promise<WorkflowSessionData | null>;
  discardPendingSession: () => void;
  
  // Session management
  clearSession: () => void;
  /** Set the orderId manually (for Sales workflow when resuming from localStorage) */
  setOrderId: (orderId: number | null) => void;
  
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
  
  // Get auth token based on workflow type
  const getAuthToken = useCallback((): string | undefined => {
    // Use the appropriate token based on workflow type
    if (workflowType === 'salesperson') {
      return getSalesRoleToken() || undefined;
    }
    return getEmployeeToken() || undefined;
  }, [workflowType]);
  
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
          setStatus('idle');
          return false;
        }
        
        // Check if the session is "effectively complete" and should not be resumed
        // This handles edge cases where the session was saved just before completion
        // (e.g., user was at Review step, clicked "Proceed", and app closed before MQTT response)
        if (isSessionEffectivelyComplete(sessionDataFromServer, workflowType)) {
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
  }, [clearAutoSaveTimer]);
  
  /**
   * Set orderId manually (for Sales workflow when order already exists from purchaseMultiProducts)
   */
  const manualSetOrderId = useCallback((newOrderId: number | null) => {
    setOrderId(newOrderId);
    if (newOrderId) {
      setStatus('active');
    }
  }, []);
  
  // ============================================
  // SALES WORKFLOW SPECIFIC FUNCTIONS
  // ============================================
  
  /**
   * Create a new session for Sales workflow
   * Called after customer registration (Step 1)
   * 
   * Unlike Attendant workflow which uses subscription_code,
   * Sales workflow uses customer_id and company_id.
   */
  const createSalesSession = useCallback(async (
    customerId: number,
    companyId: number,
    initialData: WorkflowSessionData
  ): Promise<number | null> => {
    const authToken = getAuthToken();
    
    setStatus('creating');
    setError(null);
    
    try {
      // Ensure workflow type is set
      const sessionPayload: WorkflowSessionData = {
        ...initialData,
        workflowType: 'salesperson',
        savedAt: Date.now(),
        version: 1,
      };
      
      const response = await createSalesWorkflowSession({
        customer_id: customerId,
        company_id: companyId,
        session_data: sessionPayload,
      }, authToken);
      
      if (response.success && response.order_id) {
        setOrderId(response.order_id);
        setSessionData(sessionPayload);
        setStatus('active');
        lastSavedDataRef.current = JSON.stringify(sessionPayload);
        
        return response.order_id;
      }
      
      throw new Error('Sales session creation failed - no order_id returned');
    } catch (err: any) {
      console.error('[useWorkflowSession] Error creating sales session:', err);
      handleError(err.message || 'Failed to create sales session');
      return null;
    }
  }, [getAuthToken, handleError]);
  
  /**
   * Update session with products (Sales workflow Step 4 - payment step)
   * Adds order lines for subscription plan and package components
   * 
   * Returns the subscription code created by the backend when products are added
   */
  const updateSessionWithProductsFunc = useCallback(async (
    data: WorkflowSessionData,
    products: Array<{ product_id: number; quantity: number; price_unit: number }>
  ): Promise<UpdateSessionWithProductsResult> => {
    if (!orderId) {
      console.warn('[useWorkflowSession] Cannot update session with products - no orderId');
      return { success: false };
    }
    
    const authToken = getAuthToken();
    
    setStatus('updating');
    setError(null);
    
    try {
      // Ensure metadata is updated
      const sessionPayload: WorkflowSessionData = {
        ...data,
        workflowType: 'salesperson',
        savedAt: Date.now(),
      };
      
      const response = await updateWorkflowSessionWithProducts(orderId, {
        session_data: sessionPayload,
        products,
      }, authToken);
      
      setSessionData(sessionPayload);
      setStatus('active');
      lastSavedDataRef.current = JSON.stringify(sessionPayload);
      
      // Extract subscription code from response
      const subscriptionCode = response.subscription_code;
      const subscriptionsCreated = response.subscriptions_created;
      
      return {
        success: true,
        subscriptionCode,
        subscriptionsCreated,
      };
    } catch (err: any) {
      console.error('[useWorkflowSession] Error updating session with products:', err);
      handleError(err.message || 'Failed to update session with products');
      return { success: false };
    }
  }, [orderId, getAuthToken, handleError]);
  
  // Auto-save effect
  useEffect(() => {
    if (!autoSave || !orderId || !sessionData) return;
    
    const currentDataString = JSON.stringify(sessionData);
    
    // Skip if data hasn't changed
    if (currentDataString === lastSavedDataRef.current) return;
    
    clearAutoSaveTimer();
    
    autoSaveTimerRef.current = setTimeout(async () => {
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
    
    // Session lifecycle - Attendant workflow
    checkForPendingSession,
    createSession,
    updateSession,
    updateSessionWithPayment,
    
    // Session lifecycle - Sales workflow
    createSalesSession,
    updateSessionWithProducts: updateSessionWithProductsFunc,
    
    // Session restoration
    restoreSession,
    discardPendingSession,
    
    // Session management
    clearSession,
    setOrderId: manualSetOrderId,
    
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
 * IMPORTANT: For the Attendant workflow, a session is ONLY complete when it reaches
 * Step 6 (Success). This is because service & usage reporting happens at Step 6.
 * 
 * Even if:
 * - Payment is not required (quota covers cost)
 * - Cost rounds down to zero
 * - Both batteries are scanned
 * 
 * ...the session is NOT complete until Step 6, where the swap is recorded
 * and usage is reported to the backend.
 * 
 * We consider a session "effectively complete" if:
 * - Session status is 'completed'
 * - Attendant workflow at step 6 (success) - usage has been reported
 * - SalesPerson workflow at the final registration step
 */
function isSessionEffectivelyComplete(
  sessionData: WorkflowSessionData | null | undefined,
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
    // - Step 4 (Review): Safe to resume - usage not yet reported
    // - Step 5 (Payment): Safe to resume - usage not yet reported
    // - Step 6 (Success): Complete - swap recorded and usage reported
    //
    // CRITICAL: Only Step 6 is considered complete because that's when
    // the service completion and usage reporting happens. Even if payment
    // is skipped (quota-based or zero cost), the session must reach Step 6
    // to report the swap to the backend.
    
    // Step 6 is the success step - usage has been reported, definitely complete
    if (currentStep >= 6 || maxStepReached >= 6) {
      return true;
    }
    
    // All other steps (1-5) are NOT complete - session can be resumed
    return false;
  }
  
  // For salesperson workflow, Step 8 is the success/completion step
  if (workflowType === 'salesperson') {
    // Step 8 is the success step for salesperson
    if (currentStep >= 8 || maxStepReached >= 8) {
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
      // Energy values default to 0 (not yet calculated) - these are computed from battery readings
      energyDiff: sessionData.swapData?.energyDiff ?? 0,
      quotaDeduction: sessionData.swapData?.quotaDeduction ?? 0,
      chargeableEnergy: sessionData.swapData?.chargeableEnergy ?? 0,
      // Calculated monetary values: use 0 as safe default for Math operations
      // These are derived from rate × energy, so 0 = "not yet calculated"
      grossEnergyCost: sessionData.swapData?.grossEnergyCost ?? 0,
      quotaCreditValue: sessionData.swapData?.quotaCreditValue ?? 0,
      cost: sessionData.swapData?.cost ?? 0,
      // Rate: use 0 if not in session - this indicates "rate not loaded from backend"
      // 0 is safe for calculations (won't crash) but clearly indicates missing data
      // The UI should detect rate=0 and require customer re-identification
      // IMPORTANT: Never use a hardcoded fake rate like 120 - rate MUST come from backend
      rate: sessionData.swapData?.rate ?? 0,
      // Currency: use PAYMENT.defaultCurrency as last-resort fallback (per project rules)
      currencySymbol: sessionData.swapData?.currencySymbol || PAYMENT.defaultCurrency,
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

// ============================================================================
// Sales Workflow Helper Functions
// ============================================================================

/**
 * Sales workflow state interface
 * Used to build session data from SalesFlow component state
 */
export interface SalesWorkflowState {
  currentStep: number;
  maxStepReached: number;
  actor?: { id: string; station: string };
  
  // Form data
  formData: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    street: string;
    city: string;
    zip: string;
  };
  
  // Package and plan selection
  selectedPackageId: string;
  selectedPlanId: string;
  
  // Customer registration results
  createdCustomerId: number | null;
  createdPartnerId: number | null;
  customerSessionToken: string | null;
  
  // Subscription data
  subscriptionData: {
    id?: number;
    subscriptionCode?: string;
    status?: string;
    productName?: string;
    /** Price at signup - null indicates not loaded from backend. NEVER use hardcoded defaults. */
    priceAtSignup?: number | null;
    currency?: string;
    currencySymbol?: string;
  } | null;
  
  // Payment state
  paymentState: {
    initiated: boolean;
    confirmed: boolean;
    reference: string;
    amountPaid: number;
    amountExpected: number;
    amountRemaining: number;
    incomplete: boolean;
    inputMode: 'scan' | 'manual';
    manualPaymentId: string;
    requestOrderId: number | null;
  };
  
  // Confirmed subscription code
  confirmedSubscriptionCode: string | null;
  
  // Battery data
  scannedBatteryPending: {
    id: string;
    shortId?: string;
    actualBatteryId?: string;
    chargeLevel?: number;
    energy?: number;
    macAddress?: string;
  } | null;
  assignedBattery: {
    id: string;
    shortId?: string;
    actualBatteryId?: string;
    chargeLevel?: number;
    energy?: number;
    macAddress?: string;
  } | null;
  
  // Customer identification (for pricing)
  customerIdentification?: {
    identified: boolean;
    rate: number | null;
    currencySymbol: string | null;
  };
  
  // Vehicle scan
  scannedVehicleId: string | null;
  
  // Registration ID
  registrationId: string;
}

/**
 * Build session data from Sales workflow state
 * Helper function to construct WorkflowSessionData from SalesFlow component state
 */
export function buildSalesSessionData(state: SalesWorkflowState): WorkflowSessionData {
  // Step 8 is the success/completion step for sales workflow
  const isCompleted = state.currentStep >= 8;
  
  return {
    status: isCompleted ? 'completed' : 'in_progress',
    workflowType: 'salesperson',
    currentStep: state.currentStep,
    maxStepReached: state.maxStepReached,
    actor: state.actor ? {
      employeeId: parseInt(state.actor.id.replace(/\D/g, '')) || undefined,
      station: state.actor.station,
    } : undefined,
    
    // Form data
    formData: {
      firstName: state.formData.firstName,
      lastName: state.formData.lastName,
      phone: state.formData.phone,
      email: state.formData.email,
      street: state.formData.street,
      city: state.formData.city,
      zip: state.formData.zip,
    },
    
    // Package and plan selection
    selectedPackageId: state.selectedPackageId,
    selectedPlanId: state.selectedPlanId,
    
    // Customer registration results
    createdCustomerId: state.createdCustomerId,
    createdPartnerId: state.createdPartnerId,
    customerSessionToken: state.customerSessionToken,
    
    // Subscription data
    subscriptionData: state.subscriptionData ? {
      id: state.subscriptionData.id,
      subscriptionCode: state.subscriptionData.subscriptionCode,
      status: state.subscriptionData.status,
      productName: state.subscriptionData.productName,
      priceAtSignup: state.subscriptionData.priceAtSignup,
      currency: state.subscriptionData.currency,
      currencySymbol: state.subscriptionData.currencySymbol,
    } : undefined,
    
    // Payment information
    payment: {
      requestOrderId: state.paymentState.requestOrderId,
      requestCreated: state.paymentState.initiated,
      expectedAmount: state.paymentState.amountExpected,
      amountRemaining: state.paymentState.amountRemaining,
      amountPaid: state.paymentState.amountPaid,
      incomplete: state.paymentState.incomplete,
      inputMode: state.paymentState.inputMode,
      manualPaymentId: state.paymentState.manualPaymentId,
      transactionId: state.paymentState.reference || null,
    },
    
    // Confirmed subscription code
    confirmedSubscriptionCode: state.confirmedSubscriptionCode,
    
    // Battery data
    scannedBatteryPending: state.scannedBatteryPending ? {
      id: state.scannedBatteryPending.id,
      shortId: state.scannedBatteryPending.shortId,
      actualBatteryId: state.scannedBatteryPending.actualBatteryId,
      chargeLevel: state.scannedBatteryPending.chargeLevel,
      energy: state.scannedBatteryPending.energy,
      macAddress: state.scannedBatteryPending.macAddress,
    } : null,
    assignedBattery: state.assignedBattery ? {
      id: state.assignedBattery.id,
      shortId: state.assignedBattery.shortId,
      actualBatteryId: state.assignedBattery.actualBatteryId,
      chargeLevel: state.assignedBattery.chargeLevel,
      energy: state.assignedBattery.energy,
      macAddress: state.assignedBattery.macAddress,
    } : null,
    
    // Customer identification
    customerIdentification: state.customerIdentification ? {
      identified: state.customerIdentification.identified,
      rate: state.customerIdentification.rate,
      currencySymbol: state.customerIdentification.currencySymbol,
    } : undefined,
    
    // Vehicle scan
    scannedVehicleId: state.scannedVehicleId,
    
    // Registration ID
    registrationId: state.registrationId,
    
    // Metadata
    savedAt: Date.now(),
    version: 1,
  };
}

/**
 * Restore Sales workflow state from session data
 * Helper function to extract SalesFlow component state from WorkflowSessionData
 */
// Type definitions for extracted sales state - compatible with SalesFlow component types
export interface ExtractedSubscriptionData {
  id: number;
  subscriptionCode: string;
  status: string;
  productName: string;
  /** Price at signup - null indicates data not yet loaded from backend. NEVER default to 0. */
  priceAtSignup: number | null;
  currency: string;
  currencySymbol: string;
}

export interface ExtractedBatteryData {
  id: string;
  shortId: string;
  chargeLevel: number;
  energy: number;
  macAddress?: string;
  actualBatteryId?: string;
}

export interface ExtractedSalesState {
  currentStep: number;
  maxStepReached: number;
  formData: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    street: string;
    city: string;
    zip: string;
  };
  selectedPackageId: string;
  selectedPlanId: string;
  createdCustomerId: number | null;
  createdPartnerId: number | null;
  customerSessionToken: string | null;
  subscriptionData: ExtractedSubscriptionData | null;
  paymentState: {
    initiated: boolean;
    confirmed: boolean;
    reference: string;
    amountPaid: number;
    amountExpected: number;
    amountRemaining: number;
    incomplete: boolean;
    inputMode: 'scan' | 'manual';
    manualPaymentId: string;
    requestOrderId: number | null;
  };
  confirmedSubscriptionCode: string | null;
  scannedBatteryPending: ExtractedBatteryData | null;
  assignedBattery: ExtractedBatteryData | null;
  customerIdentification: {
    identified: boolean;
    rate: number | null;
    currencySymbol: string | null;
  };
  scannedVehicleId: string | null;
  registrationId: string;
}

export function extractSalesStateFromSession(sessionData: WorkflowSessionData): ExtractedSalesState {
  // Helper to convert session battery data to ExtractedBatteryData with required fields
  const toBatteryData = (battery: WorkflowSessionData['scannedBatteryPending']): ExtractedBatteryData | null => {
    if (!battery || !battery.id) return null;
    return {
      id: battery.id,
      shortId: battery.shortId || battery.id.substring(0, 8),
      chargeLevel: battery.chargeLevel ?? 0,
      energy: battery.energy ?? 0,
      macAddress: battery.macAddress,
      actualBatteryId: battery.actualBatteryId,
    };
  };

  // Helper to convert session subscription data to ExtractedSubscriptionData with required fields
  // Note: priceAtSignup uses ?? null because pricing MUST come from backend - never default to 0
  const toSubscriptionData = (sub: WorkflowSessionData['subscriptionData']): ExtractedSubscriptionData | null => {
    if (!sub || sub.id === undefined) return null;
    return {
      id: sub.id,
      subscriptionCode: sub.subscriptionCode || '',
      status: sub.status || '',
      productName: sub.productName || '',
      priceAtSignup: sub.priceAtSignup ?? null,
      currency: sub.currency || '',
      currencySymbol: sub.currencySymbol || '',
    };
  };

  return {
    currentStep: sessionData.currentStep || 1,
    maxStepReached: sessionData.maxStepReached || 1,
    formData: {
      firstName: sessionData.formData?.firstName || '',
      lastName: sessionData.formData?.lastName || '',
      phone: sessionData.formData?.phone || '',
      email: sessionData.formData?.email || '',
      street: sessionData.formData?.street || '',
      city: sessionData.formData?.city || '',
      zip: sessionData.formData?.zip || '',
    },
    selectedPackageId: sessionData.selectedPackageId || '',
    selectedPlanId: sessionData.selectedPlanId || '',
    createdCustomerId: sessionData.createdCustomerId || null,
    createdPartnerId: sessionData.createdPartnerId || null,
    customerSessionToken: sessionData.customerSessionToken || null,
    subscriptionData: toSubscriptionData(sessionData.subscriptionData),
    paymentState: {
      initiated: sessionData.payment?.requestCreated || false,
      confirmed: !!sessionData.payment?.transactionId,
      reference: sessionData.payment?.transactionId || '',
      amountPaid: sessionData.payment?.amountPaid || 0,
      amountExpected: sessionData.payment?.expectedAmount || 0,
      amountRemaining: sessionData.payment?.amountRemaining || 0,
      incomplete: sessionData.payment?.incomplete || false,
      inputMode: sessionData.payment?.inputMode || 'scan',
      manualPaymentId: sessionData.payment?.manualPaymentId || '',
      requestOrderId: sessionData.payment?.requestOrderId || null,
    },
    confirmedSubscriptionCode: sessionData.confirmedSubscriptionCode || null,
    scannedBatteryPending: toBatteryData(sessionData.scannedBatteryPending),
    assignedBattery: toBatteryData(sessionData.assignedBattery),
    customerIdentification: {
      identified: sessionData.customerIdentification?.identified || false,
      rate: sessionData.customerIdentification?.rate || null,
      currencySymbol: sessionData.customerIdentification?.currencySymbol || null,
    },
    scannedVehicleId: sessionData.scannedVehicleId || null,
    registrationId: sessionData.registrationId || '',
  };
}

export default useWorkflowSession;
