/**
 * SessionResumePrompt - Reusable component for workflow session restoration
 * 
 * Shows a modal prompt when there's a pending session that can be resumed.
 * Used by both Attendant and SalesPerson workflows.
 */

'use client';

import React from 'react';
import { useI18n } from '@/i18n';
import { Clock, Play, X, User, MapPin } from 'lucide-react';
import type { SessionSummary } from '@/lib/hooks/useWorkflowSession';

export interface SessionResumePromptProps {
  /** Whether to show the prompt */
  isVisible: boolean;
  /** Session summary to display */
  session: SessionSummary | null;
  /** Called when user wants to resume the session */
  onResume: () => void;
  /** Called when user wants to start fresh */
  onDiscard: () => void;
  /** Whether restoration is in progress */
  isLoading?: boolean;
  /** Title override */
  title?: string;
  /** Description override */
  description?: string;
}

/**
 * Modal prompt for resuming an interrupted workflow session
 */
export default function SessionResumePrompt({
  isVisible,
  session,
  onResume,
  onDiscard,
  isLoading = false,
  title,
  description,
}: SessionResumePromptProps) {
  const { t } = useI18n();
  
  // Don't render if not visible or no session
  if (!isVisible || !session) {
    return null;
  }
  
  // Determine workflow-specific labels
  const isAttendant = session.workflowType === 'attendant';
  const totalSteps = isAttendant ? 6 : 7;
  const workflowLabel = isAttendant 
    ? (t('session.swapInProgress') || 'Swap in Progress')
    : (t('session.registrationInProgress') || 'Registration in Progress');
  
  // Default title/description
  const displayTitle = title || (t('session.resumeTitle') || 'Resume Previous Session?');
  const displayDescription = description || (
    isAttendant 
      ? (t('session.resumeDescAttendant') || 'You have an incomplete battery swap for:')
      : (t('session.resumeDescSales') || 'You have an incomplete registration for:')
  );
  
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="resume-session-modal">
        {/* Icon */}
        <div className="resume-session-icon">
          <Clock size={28} />
        </div>
        
        {/* Title */}
        <h3 className="resume-session-title">{displayTitle}</h3>
        
        {/* Description */}
        <p className="resume-session-description">{displayDescription}</p>
        
        {/* Session Details */}
        <div className="resume-session-details">
          {/* Customer name */}
          {session.customerName && (
            <div className="resume-session-customer">
              <User size={16} className="inline mr-2 opacity-60" />
              {session.customerName}
            </div>
          )}
          
          {/* Subscription code if available */}
          {session.subscriptionCode && (
            <div className="resume-session-subscription">
              <span className="opacity-60">{t('session.subscriptionId') || 'Subscription'}:</span>{' '}
              {session.subscriptionCode}
            </div>
          )}
          
          {/* Step and time info */}
          <div className="resume-session-meta">
            <span>
              {t('session.stepProgress') || 'Step'} {session.currentStep} {t('common.of') || 'of'} {totalSteps}
            </span>
            {session.savedAt && (
              <>
                <span className="mx-2">•</span>
                <span>{t('session.saved') || 'Saved'} {session.savedAt}</span>
              </>
            )}
          </div>
          
          {/* Order reference */}
          {session.orderName && (
            <div className="resume-session-order text-xs opacity-50 mt-1">
              {t('session.orderRef') || 'Ref'}: {session.orderName}
            </div>
          )}
        </div>
        
        {/* Action Buttons */}
        <div className="resume-session-actions">
          <button 
            className="resume-session-btn resume-session-btn-primary"
            onClick={onResume}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                {t('session.resuming') || 'Resuming...'}
              </>
            ) : (
              <>
                <Play size={18} />
                {t('session.resume') || 'Resume'}
              </>
            )}
          </button>
          
          <button 
            className="resume-session-btn resume-session-btn-secondary"
            onClick={onDiscard}
            disabled={isLoading}
          >
            <X size={18} />
            {t('session.startNew') || 'Start New'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Inline variant for showing session info in a card format
 * (Can be used within the page instead of as a modal)
 */
export function SessionResumeCard({
  session,
  onResume,
  onDiscard,
  isLoading = false,
}: Omit<SessionResumePromptProps, 'isVisible' | 'title' | 'description'>) {
  const { t } = useI18n();
  
  if (!session) {
    return null;
  }
  
  const isAttendant = session.workflowType === 'attendant';
  const totalSteps = isAttendant ? 6 : 7;
  
  return (
    <div className="session-resume-card">
      <div className="session-resume-card-header">
        <div className="session-resume-card-icon">
          <Clock size={20} />
        </div>
        <div className="session-resume-card-info">
          <h4 className="session-resume-card-title">
            {t('session.pendingSession') || 'Pending Session'}
          </h4>
          <p className="session-resume-card-subtitle">
            {session.customerName || session.subscriptionCode || 'Unknown'}
          </p>
        </div>
      </div>
      
      <div className="session-resume-card-meta">
        <span>
          {t('session.stepProgress') || 'Step'} {session.currentStep}/{totalSteps}
        </span>
        {session.savedAt && (
          <>
            <span className="mx-1">•</span>
            <span>{session.savedAt}</span>
          </>
        )}
      </div>
      
      <div className="session-resume-card-actions">
        <button 
          className="session-resume-card-btn-resume"
          onClick={onResume}
          disabled={isLoading}
        >
          {isLoading ? (t('common.loading') || 'Loading...') : (t('session.resume') || 'Resume')}
        </button>
        <button 
          className="session-resume-card-btn-discard"
          onClick={onDiscard}
          disabled={isLoading}
        >
          {t('session.discard') || 'Discard'}
        </button>
      </div>
    </div>
  );
}

export type { SessionSummary };
