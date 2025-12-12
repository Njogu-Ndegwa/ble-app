/**
 * useSessionManagement Hook
 * 
 * Provides session persistence functionality for workflow flows.
 * Handles auto-save on step changes, session loading/resumption,
 * and review mode for completed sessions.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import {
  type SessionData,
  type SessionType,
  type SessionListItem,
} from '@/lib/odoo-api';
import {
  createSessionData,
  updateSessionProgress,
  updateRecoverySummary,
  markSessionCompleted,
  saveSessionToBackend,
  loadSessionFromBackend,
  canResumeSession,
  isSessionCompleted,
  getStepName,
  type SessionMode,
} from '../session-service';

// ============================================================================
// Types
// ============================================================================

export interface UseSessionManagementOptions {
  /** Type of session (sales or attendant swap) */
  sessionType: SessionType;
  /** Total number of steps in the workflow */
  totalSteps: number;
  /** Station ID for actor info */
  stationId?: string;
  /** Auto-save delay in ms (default: 500) */
  autoSaveDelay?: number;
  /** Enable debug logging */
  debug?: boolean;
}

export interface UseSessionManagementResult {
  /** Current session data */
  sessionData: SessionData | null;
  /** Current session mode */
  sessionMode: SessionMode;
  /** Order ID linked to session (needed for API calls) */
  orderId: number | null;
  /** Whether session is in review mode (read-only) */
  isReviewMode: boolean;
  /** Whether auto-save is pending */
  isSaving: boolean;
  /** Last save error */
  saveError: string | null;
  
  // Session lifecycle
  /** Initialize a new session */
  initSession: () => SessionData;
  /** Load an existing session by order ID */
  loadSession: (orderId: number) => Promise<SessionData | null>;
  /** Resume a session from session list item */
  resumeSession: (session: SessionListItem) => Promise<SessionData | null>;
  /** Enter review mode for a completed session */
  reviewSession: (session: SessionListItem) => Promise<SessionData | null>;
  /** Clear current session */
  clearSession: () => void;
  /** Exit review mode */
  exitReviewMode: () => void;
  
  // Session updates
  /** Update session when step changes */
  onStepChange: (step: number, stepData?: Record<string, unknown>) => void;
  /** Update recovery summary with customer/order details */
  updateSummary: (updates: Partial<SessionData['recovery_summary']>) => void;
  /** Mark session as completed */
  completeSession: () => void;
  /** Force save to backend */
  saveNow: () => Promise<boolean>;
  
  // Utilities
  /** Set order ID (after purchase creates order) */
  setOrderId: (orderId: number) => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useSessionManagement({
  sessionType,
  totalSteps,
  stationId,
  autoSaveDelay = 500,
  debug = false,
}: UseSessionManagementOptions): UseSessionManagementResult {
  // State
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [sessionMode, setSessionMode] = useState<SessionMode>('new');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  // Refs for auto-save debouncing
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSaveRef = useRef<SessionData | null>(null);
  
  // Debug logging
  const log = useCallback((...args: unknown[]) => {
    if (debug) {
      console.info('[useSessionManagement]', ...args);
    }
  }, [debug]);
  
  // ============================================
  // Auto-save logic
  // ============================================
  
  const saveToBackend = useCallback(async (data: SessionData): Promise<boolean> => {
    if (!orderId) {
      log('Cannot save: no orderId set');
      return false;
    }
    
    setIsSaving(true);
    setSaveError(null);
    
    try {
      const success = await saveSessionToBackend(orderId, data);
      if (success) {
        log('Session saved to backend');
      } else {
        setSaveError('Save failed');
        log('Session save failed');
      }
      return success;
    } catch (err: any) {
      const errorMsg = err.message || 'Save error';
      setSaveError(errorMsg);
      log('Session save error:', errorMsg);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [orderId, log]);
  
  const scheduleSave = useCallback((data: SessionData) => {
    pendingSaveRef.current = data;
    
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Schedule new save
    saveTimeoutRef.current = setTimeout(async () => {
      if (pendingSaveRef.current && orderId) {
        await saveToBackend(pendingSaveRef.current);
        pendingSaveRef.current = null;
      }
    }, autoSaveDelay);
  }, [autoSaveDelay, orderId, saveToBackend]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);
  
  // ============================================
  // Session lifecycle methods
  // ============================================
  
  const initSession = useCallback((): SessionData => {
    log('Initializing new session');
    const newSession = createSessionData(sessionType, totalSteps, stationId);
    setSessionData(newSession);
    setSessionMode('new');
    return newSession;
  }, [sessionType, totalSteps, stationId, log]);
  
  const loadSession = useCallback(async (loadOrderId: number): Promise<SessionData | null> => {
    log('Loading session for order:', loadOrderId);
    const loaded = await loadSessionFromBackend(loadOrderId);
    
    if (loaded) {
      setSessionData(loaded);
      setOrderId(loadOrderId);
      
      // Determine mode based on session state
      if (isSessionCompleted(loaded)) {
        setSessionMode('review');
      } else if (canResumeSession(loaded)) {
        setSessionMode('resume');
      } else {
        setSessionMode('new');
      }
      
      log('Session loaded:', { mode: sessionMode, step: loaded.flow_state.current_step });
    }
    
    return loaded;
  }, [log, sessionMode]);
  
  const resumeSession = useCallback(async (session: SessionListItem): Promise<SessionData | null> => {
    log('Resuming session:', session.id);
    setOrderId(session.order_id);
    const loaded = await loadSession(session.order_id);
    
    if (loaded) {
      setSessionMode('resume');
      toast.success(`Resuming from Step ${loaded.flow_state.current_step}`);
    }
    
    return loaded;
  }, [loadSession, log]);
  
  const reviewSession = useCallback(async (session: SessionListItem): Promise<SessionData | null> => {
    log('Reviewing session:', session.id);
    setOrderId(session.order_id);
    const loaded = await loadSession(session.order_id);
    
    if (loaded) {
      setSessionMode('review');
    }
    
    return loaded;
  }, [loadSession, log]);
  
  const clearSession = useCallback(() => {
    log('Clearing session');
    setSessionData(null);
    setOrderId(null);
    setSessionMode('new');
    setSaveError(null);
    
    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    pendingSaveRef.current = null;
  }, [log]);
  
  const exitReviewMode = useCallback(() => {
    log('Exiting review mode');
    clearSession();
  }, [clearSession, log]);
  
  // ============================================
  // Session update methods
  // ============================================
  
  const onStepChange = useCallback((step: number, stepData?: Record<string, unknown>) => {
    if (sessionMode === 'review') {
      log('Ignoring step change in review mode');
      return;
    }
    
    const stepName = getStepName(sessionType, step);
    log('Step changed:', step, stepName);
    
    setSessionData(prev => {
      if (!prev) {
        // Auto-initialize if no session exists
        const newSession = createSessionData(sessionType, totalSteps, stationId);
        const updated = updateSessionProgress(newSession, step, stepName, stepData);
        scheduleSave(updated);
        return updated;
      }
      
      const updated = updateSessionProgress(prev, step, stepName, stepData);
      scheduleSave(updated);
      return updated;
    });
  }, [sessionMode, sessionType, totalSteps, stationId, scheduleSave, log]);
  
  const updateSummary = useCallback((updates: Partial<SessionData['recovery_summary']>) => {
    if (sessionMode === 'review') {
      log('Ignoring summary update in review mode');
      return;
    }
    
    log('Updating recovery summary:', updates);
    
    setSessionData(prev => {
      if (!prev) return prev;
      
      const updated = updateRecoverySummary(prev, updates);
      scheduleSave(updated);
      return updated;
    });
  }, [sessionMode, scheduleSave, log]);
  
  const completeSession = useCallback(() => {
    log('Marking session as completed');
    
    setSessionData(prev => {
      if (!prev) return prev;
      
      const updated = markSessionCompleted(prev);
      // Save immediately on completion
      if (orderId) {
        saveToBackend(updated);
      }
      return updated;
    });
  }, [orderId, saveToBackend, log]);
  
  const saveNow = useCallback(async (): Promise<boolean> => {
    // Clear pending auto-save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    if (!sessionData || !orderId) {
      log('Cannot save now: missing data or orderId');
      return false;
    }
    
    return saveToBackend(sessionData);
  }, [sessionData, orderId, saveToBackend, log]);
  
  // ============================================
  // Computed values
  // ============================================
  
  const isReviewMode = sessionMode === 'review';
  
  return {
    sessionData,
    sessionMode,
    orderId,
    isReviewMode,
    isSaving,
    saveError,
    
    // Lifecycle
    initSession,
    loadSession,
    resumeSession,
    reviewSession,
    clearSession,
    exitReviewMode,
    
    // Updates
    onStepChange,
    updateSummary,
    completeSession,
    saveNow,
    
    // Utilities
    setOrderId,
  };
}

export default useSessionManagement;
