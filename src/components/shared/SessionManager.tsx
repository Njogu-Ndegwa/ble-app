'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Search, Clock, User, ChevronRight, Play, Eye, X, RefreshCw, AlertCircle, Package } from 'lucide-react';
import { useI18n } from '@/i18n';
import { type SessionListItem, type SessionType, type SessionStatus, type ListSessionsParams } from '@/lib/odoo-api';
import { getAvailableSessions, getTimeElapsed } from '@/lib/services/session-service';

// ============================================================================
// Types
// ============================================================================

export interface SessionManagerProps {
  /** Type of sessions to display */
  sessionType: SessionType;
  /** Called when a session is selected for resumption */
  onResumeSession: (session: SessionListItem) => void;
  /** Called when a session is selected for review */
  onReviewSession: (session: SessionListItem) => void;
  /** Called when user wants to start a new session */
  onStartNew: () => void;
  /** Called when the modal is closed */
  onClose: () => void;
  /** Whether the modal is open */
  isOpen: boolean;
  /** Optional className for styling */
  className?: string;
}

type StatusFilter = 'all' | 'in_progress' | 'completed';

// ============================================================================
// Session Manager Component
// ============================================================================

export default function SessionManager({
  sessionType,
  onResumeSession,
  onReviewSession,
  onStartNew,
  onClose,
  isOpen,
  className = '',
}: SessionManagerProps) {
  const { t } = useI18n();
  
  // State
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  
  // Fetch sessions
  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const params: ListSessionsParams = {
        session_type: sessionType,
        limit: 50,
      };
      
      // Add status filter if not 'all'
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      
      // Add subscription code search if provided
      if (searchQuery.trim()) {
        params.subscription_code = searchQuery.trim();
      }
      
      const sessionList = await getAvailableSessions(params);
      setSessions(sessionList);
    } catch (err: any) {
      console.error('Failed to fetch sessions:', err);
      setError(err.message || t('session.loadError') || 'Failed to load sessions');
    } finally {
      setIsLoading(false);
    }
  }, [sessionType, statusFilter, searchQuery, t]);
  
  // Initial fetch when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchSessions();
    }
  }, [isOpen, fetchSessions]);
  
  // Handle session click
  const handleSessionClick = useCallback((session: SessionListItem) => {
    if (session.status === 'completed') {
      onReviewSession(session);
    } else if (session.can_resume) {
      onResumeSession(session);
    } else {
      // Can't do anything with this session - show info
      console.info('Session cannot be resumed or reviewed:', session);
    }
  }, [onResumeSession, onReviewSession]);
  
  // Filter sessions based on search query (client-side filtering for already loaded data)
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) {
      return sessions;
    }
    
    const query = searchQuery.toLowerCase();
    return sessions.filter(session => 
      session.customer_name?.toLowerCase().includes(query) ||
      session.subscription_code?.toLowerCase().includes(query) ||
      session.order_name?.toLowerCase().includes(query)
    );
  }, [sessions, searchQuery]);
  
  // Get status badge color
  const getStatusBadgeClass = (status: SessionStatus): string => {
    switch (status) {
      case 'completed':
        return 'session-badge-completed';
      case 'in_progress':
        return 'session-badge-active';
      case 'cancelled':
        return 'session-badge-cancelled';
      case 'expired':
        return 'session-badge-expired';
      default:
        return 'session-badge-default';
    }
  };
  
  // Get status display text
  const getStatusText = (status: SessionStatus): string => {
    switch (status) {
      case 'completed':
        return t('session.statusCompleted') || 'Completed';
      case 'in_progress':
        return t('session.statusInProgress') || 'In Progress';
      case 'cancelled':
        return t('session.statusCancelled') || 'Cancelled';
      case 'expired':
        return t('session.statusExpired') || 'Expired';
      default:
        return status;
    }
  };
  
  // Get action icon based on session state
  const getActionIcon = (session: SessionListItem) => {
    if (session.status === 'completed') {
      return <Eye size={18} className="session-action-icon review" />;
    }
    if (session.can_resume) {
      return <Play size={18} className="session-action-icon resume" />;
    }
    return <ChevronRight size={18} className="session-action-icon disabled" />;
  };
  
  if (!isOpen) return null;
  
  return (
    <div className={`session-manager-overlay ${className}`}>
      <div className="session-manager-modal">
        {/* Header */}
        <div className="session-manager-header">
          <div className="session-manager-title">
            <Package size={20} />
            <h2>{t('session.manageTitle') || 'Manage Sessions'}</h2>
          </div>
          <button 
            className="session-manager-close"
            onClick={onClose}
            aria-label={t('common.close') || 'Close'}
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Search and Filters */}
        <div className="session-manager-filters">
          <div className="session-search-wrapper">
            <Search size={18} className="session-search-icon" />
            <input
              type="text"
              className="session-search-input"
              placeholder={t('session.searchPlaceholder') || 'Search by subscription ID or customer...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button 
                className="session-search-clear"
                onClick={() => setSearchQuery('')}
              >
                <X size={14} />
              </button>
            )}
          </div>
          
          <div className="session-filter-tabs">
            <button
              className={`session-filter-tab ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              {t('session.filterAll') || 'All'}
            </button>
            <button
              className={`session-filter-tab ${statusFilter === 'in_progress' ? 'active' : ''}`}
              onClick={() => setStatusFilter('in_progress')}
            >
              {t('session.filterInProgress') || 'In Progress'}
            </button>
            <button
              className={`session-filter-tab ${statusFilter === 'completed' ? 'active' : ''}`}
              onClick={() => setStatusFilter('completed')}
            >
              {t('session.filterCompleted') || 'Completed'}
            </button>
          </div>
        </div>
        
        {/* Session List */}
        <div className="session-manager-list">
          {isLoading ? (
            <div className="session-loading">
              <RefreshCw size={24} className="session-loading-icon" />
              <span>{t('session.loading') || 'Loading sessions...'}</span>
            </div>
          ) : error ? (
            <div className="session-error">
              <AlertCircle size={24} />
              <span>{error}</span>
              <button className="session-retry-btn" onClick={fetchSessions}>
                {t('common.retry') || 'Retry'}
              </button>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="session-empty">
              <Package size={48} className="session-empty-icon" />
              <h3>{t('session.noSessionsTitle') || 'No sessions found'}</h3>
              <p>{t('session.noSessionsHint') || 'Start a new session to get going'}</p>
            </div>
          ) : (
            <div className="session-items">
              {filteredSessions.map((session) => (
                <button
                  key={session.id}
                  className={`session-item ${session.can_resume || session.status === 'completed' ? '' : 'disabled'}`}
                  onClick={() => handleSessionClick(session)}
                  disabled={!session.can_resume && session.status !== 'completed'}
                >
                  <div className="session-item-main">
                    <div className="session-item-header">
                      <div className="session-customer">
                        <User size={16} />
                        <span className="session-customer-name">
                          {session.customer_name || t('session.unknownCustomer') || 'Unknown Customer'}
                        </span>
                      </div>
                      <span className={`session-status-badge ${getStatusBadgeClass(session.status)}`}>
                        {getStatusText(session.status)}
                      </span>
                    </div>
                    
                    <div className="session-item-details">
                      {session.subscription_code && (
                        <span className="session-detail subscription">
                          {session.subscription_code}
                        </span>
                      )}
                      <span className="session-detail step">
                        {t('session.stepProgress') || 'Step'} {session.current_step}
                        {session.recovery_summary?.current_step_name && 
                          ` - ${session.recovery_summary.current_step_name}`}
                      </span>
                    </div>
                    
                    <div className="session-item-meta">
                      <span className="session-time">
                        <Clock size={12} />
                        {getTimeElapsed(session.updated_at)}
                      </span>
                      {session.recovery_summary?.total_amount && (
                        <span className="session-amount">
                          {session.recovery_summary.currency_symbol} {session.recovery_summary.total_amount.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="session-item-action">
                    {getActionIcon(session)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Footer Actions */}
        <div className="session-manager-footer">
          <button className="session-start-new-btn" onClick={onStartNew}>
            <span>{t('session.startNew') || 'Start New Session'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
