/**
 * Session Service
 * 
 * Provides utilities for managing workflow sessions including:
 * - Building session data structures
 * - Saving/loading sessions from Odoo
 * - Session state transitions
 * - Recovery summary generation
 */

import {
  type SessionData,
  type SessionType,
  type SessionStatus,
  type SessionRecoverySummary,
  type SessionActor,
  type SessionFlowState,
  type SessionTimelineStep,
  type SessionListItem,
  type ListSessionsParams,
  getSessionByOrderId,
  updateSessionByOrderId,
  listSessions,
} from '@/lib/odoo-api';
import { getEmployeeToken, getEmployeeUser } from '@/lib/attendant-auth';

// Session data version for migrations
const SESSION_DATA_VERSION = 1;

// Session expiry time (24 hours)
const SESSION_EXPIRY_HOURS = 24;

// ============================================================================
// Session Data Building
// ============================================================================

/**
 * Generate a unique session ID
 */
export function generateSessionId(sessionType: SessionType): string {
  const prefix = sessionType === 'SALES_REGISTRATION' ? 'sales' : 'swap';
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-sess-${timestamp}-${random}`;
}

/**
 * Get current actor info from employee login
 */
export function getCurrentActor(sessionType: SessionType, stationId?: string): SessionActor {
  const user = getEmployeeUser();
  
  return {
    type: sessionType === 'SALES_REGISTRATION' ? 'salesperson' : 'attendant',
    id: user ? `emp-${user.id}` : 'unknown',
    name: user?.name || 'Unknown',
    station: stationId || `STATION_${user?.id || '001'}`,
    company_id: user?.companyId || 14,
  };
}

/**
 * Create initial session data structure
 */
export function createSessionData(
  sessionType: SessionType,
  totalSteps: number,
  stationId?: string
): SessionData {
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();
  
  return {
    session_id: generateSessionId(sessionType),
    session_type: sessionType,
    version: SESSION_DATA_VERSION,
    created_at: now,
    updated_at: now,
    expires_at: expiresAt,
    
    recovery_summary: {
      customer_name: '',
      current_step: 1,
      current_step_name: 'Customer',
      max_step_reached: 1,
      last_action: 'Session started',
      last_action_at: now,
      time_elapsed: 'just now',
      currency_symbol: 'KES',
      can_resume: true,
      resume_warnings: [],
    },
    
    actor: getCurrentActor(sessionType, stationId),
    
    flow_state: {
      current_step: 1,
      max_step_reached: 1,
      total_steps: totalSteps,
    },
    
    timeline: {
      step_1: {
        name: 'Customer',
        status: 'in_progress',
        started_at: now,
      },
    },
  };
}

/**
 * Update session data with new step progress
 */
export function updateSessionProgress(
  session: SessionData,
  currentStep: number,
  stepName: string,
  stepData?: Record<string, unknown>
): SessionData {
  const now = new Date().toISOString();
  
  // Mark previous step as completed if moving forward
  const previousStepKey = `step_${currentStep - 1}` as keyof typeof session.timeline;
  if (session.timeline[previousStepKey]) {
    session.timeline[previousStepKey] = {
      ...session.timeline[previousStepKey],
      status: 'completed',
      completed_at: now,
    };
  }
  
  // Update or create current step in timeline
  const currentStepKey = `step_${currentStep}`;
  session.timeline[currentStepKey] = {
    name: stepName,
    status: 'in_progress',
    started_at: session.timeline[currentStepKey]?.started_at || now,
    completed_at: null,
  };
  
  // Update flow state
  session.flow_state = {
    ...session.flow_state,
    current_step: currentStep,
    max_step_reached: Math.max(session.flow_state.max_step_reached, currentStep),
  };
  
  // Store step-specific data
  if (stepData) {
    const stepDataKey = `step_${currentStep}_data` as `step_${number}_data`;
    session[stepDataKey] = {
      step: currentStep,
      step_name: stepName,
      captured_at: now,
      ...stepData,
    };
  }
  
  // Update metadata
  session.updated_at = now;
  session.recovery_summary = {
    ...session.recovery_summary,
    current_step: currentStep,
    current_step_name: stepName,
    max_step_reached: session.flow_state.max_step_reached,
    last_action: `Moved to ${stepName}`,
    last_action_at: now,
    time_elapsed: 'just now',
  };
  
  return session;
}

/**
 * Update recovery summary with customer and order details
 */
export function updateRecoverySummary(
  session: SessionData,
  updates: Partial<SessionRecoverySummary>
): SessionData {
  session.recovery_summary = {
    ...session.recovery_summary,
    ...updates,
  };
  session.updated_at = new Date().toISOString();
  return session;
}

/**
 * Mark session as completed
 */
export function markSessionCompleted(session: SessionData): SessionData {
  const now = new Date().toISOString();
  
  // Mark final step as completed
  const finalStepKey = `step_${session.flow_state.total_steps}`;
  session.timeline[finalStepKey] = {
    ...session.timeline[finalStepKey],
    status: 'completed',
    completed_at: now,
  };
  
  session.updated_at = now;
  session.recovery_summary = {
    ...session.recovery_summary,
    can_resume: false,
    last_action: 'Session completed',
    last_action_at: now,
  };
  
  return session;
}

// ============================================================================
// Session Persistence
// ============================================================================

/**
 * Save session to Odoo backend
 */
export async function saveSessionToBackend(
  orderId: number,
  sessionData: SessionData
): Promise<boolean> {
  try {
    const authToken = getEmployeeToken();
    const response = await updateSessionByOrderId(orderId, sessionData, authToken || undefined);
    return response.success;
  } catch (error) {
    console.error('Failed to save session to backend:', error);
    return false;
  }
}

/**
 * Load session from Odoo backend
 */
export async function loadSessionFromBackend(
  orderId: number
): Promise<SessionData | null> {
  try {
    const authToken = getEmployeeToken();
    const response = await getSessionByOrderId(orderId, authToken || undefined);
    
    if (response.success && response.session?.session_data) {
      return response.session.session_data;
    }
    return null;
  } catch (error) {
    console.error('Failed to load session from backend:', error);
    return null;
  }
}

/**
 * List available sessions for selection
 */
export async function getAvailableSessions(
  params: ListSessionsParams = {}
): Promise<SessionListItem[]> {
  try {
    const authToken = getEmployeeToken();
    const response = await listSessions(params, authToken || undefined);
    
    if (response.success) {
      return response.sessions;
    }
    return [];
  } catch (error) {
    console.error('Failed to list sessions:', error);
    return [];
  }
}

// ============================================================================
// Session State Utilities
// ============================================================================

/**
 * Check if a session can be resumed
 */
export function canResumeSession(session: SessionData): boolean {
  // Check expiry
  if (session.expires_at) {
    const expiryDate = new Date(session.expires_at);
    if (expiryDate < new Date()) {
      return false;
    }
  }
  
  // Check if already completed (final step)
  if (session.flow_state.current_step >= session.flow_state.total_steps) {
    return false;
  }
  
  return session.recovery_summary.can_resume !== false;
}

/**
 * Check if a session is completed (for review mode)
 */
export function isSessionCompleted(session: SessionData): boolean {
  const finalStepKey = `step_${session.flow_state.total_steps}`;
  const finalStep = session.timeline[finalStepKey];
  return finalStep?.status === 'completed';
}

/**
 * Get time elapsed since session was last updated
 */
export function getTimeElapsed(updatedAt: string): string {
  const now = new Date();
  const updated = new Date(updatedAt);
  const diffMs = now.getTime() - updated.getTime();
  
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
  if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }
  if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  }
  return 'just now';
}

/**
 * Get step name by number for different workflows
 */
export function getStepName(
  sessionType: SessionType,
  stepNumber: number
): string {
  if (sessionType === 'SALES_REGISTRATION') {
    const salesSteps: Record<number, string> = {
      1: 'Customer',
      2: 'Package',
      3: 'Subscription',
      4: 'Preview',
      5: 'Payment',
      6: 'Battery',
      7: 'Done',
    };
    return salesSteps[stepNumber] || `Step ${stepNumber}`;
  }
  
  // Attendant swap steps
  const swapSteps: Record<number, string> = {
    1: 'Customer',
    2: 'Return',
    3: 'New',
    4: 'Review',
    5: 'Pay',
    6: 'Done',
  };
  return swapSteps[stepNumber] || `Step ${stepNumber}`;
}

// ============================================================================
// Session Mode Types
// ============================================================================

export type SessionMode = 'new' | 'resume' | 'review';

export interface SessionModeInfo {
  mode: SessionMode;
  orderId?: number;
  sessionData?: SessionData;
  isReadOnly: boolean;
}

/**
 * Determine session mode from session data
 */
export function getSessionMode(session: SessionData | null): SessionMode {
  if (!session) {
    return 'new';
  }
  
  if (isSessionCompleted(session)) {
    return 'review';
  }
  
  if (canResumeSession(session)) {
    return 'resume';
  }
  
  return 'new';
}
