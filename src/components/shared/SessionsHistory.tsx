/**
 * SessionsHistory - Component for viewing and resuming past workflow sessions
 * 
 * Shows a paginated list of past orders/sessions that can be searched by
 * subscription ID. Users can click on a session to resume it if it's in draft state.
 * 
 * Used by the Attendant workflow to allow resuming past sessions.
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useI18n } from '@/i18n';
import { 
  X, 
  Search, 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Eye,
  CheckCircle,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { getOrdersList, type OrderListItem, type OrdersPagination } from '@/lib/odoo-api';
import { colors, spacing, fontSize, radius } from '@/styles';

export interface SessionsHistoryProps {
  /** Whether the component is visible */
  isVisible: boolean;
  /** Called when user closes the sessions list */
  onClose: () => void;
  /** Called when user selects a session to resume or view */
  onSelectSession: (order: OrderListItem, isReadOnly: boolean) => void;
  /** Auth token for API calls */
  authToken: string;
  /** Current workflow type */
  workflowType: 'attendant' | 'salesperson';
}

/**
 * Modal component for viewing and selecting past sessions
 */
export default function SessionsHistory({
  isVisible,
  onClose,
  onSelectSession,
  authToken,
  workflowType,
}: SessionsHistoryProps) {
  const { t } = useI18n();
  
  // State
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [pagination, setPagination] = useState<OrdersPagination | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isSearching, setIsSearching] = useState(false);
  
  // Pagination config
  const ITEMS_PER_PAGE = 10;
  
  // Fetch orders from API
  // For attendant workflow: search by subscription_code
  // For salesperson workflow: search by customer_id (numeric)
  const fetchOrders = useCallback(async (page: number, searchValue?: string) => {
    if (!authToken) {
      setError(t('sessions.authRequired') || 'Please log in to view sessions');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Build search params based on workflow type
      const searchParams: { subscription_code?: string; customer_id?: number } = {};
      
      if (searchValue) {
        if (workflowType === 'salesperson') {
          // For salesperson, search by customer_id (numeric)
          const customerId = parseInt(searchValue, 10);
          if (!isNaN(customerId)) {
            searchParams.customer_id = customerId;
          }
        } else {
          // For attendant, search by subscription_code
          searchParams.subscription_code = searchValue;
        }
      }
      
      const response = await getOrdersList({
        page,
        limit: ITEMS_PER_PAGE,
        mine: true,
        ...searchParams,
      }, authToken);
      
      setOrders(response.orders || []);
      setPagination(response.pagination);
    } catch (err: any) {
      console.error('Failed to fetch orders:', err);
      setError(err?.message || (t('sessions.loadError') || 'Failed to load sessions'));
    } finally {
      setIsLoading(false);
      setIsSearching(false);
    }
  }, [authToken, t, workflowType]);
  
  // Fetch on mount and when visible
  useEffect(() => {
    if (isVisible && authToken) {
      fetchOrders(1);
      setCurrentPage(1);
      setSearchQuery('');
    }
  }, [isVisible, authToken, fetchOrders]);
  
  // Handle search with debounce
  const handleSearch = useCallback(() => {
    const query = searchQuery.trim();
    setIsSearching(true);
    setCurrentPage(1);
    
    if (query) {
      fetchOrders(1, query);
    } else {
      fetchOrders(1);
    }
  }, [searchQuery, fetchOrders]);
  
  // Handle search on Enter
  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }, [handleSearch]);
  
  // Handle page change
  const handlePageChange = useCallback((newPage: number) => {
    setCurrentPage(newPage);
    const query = searchQuery.trim();
    fetchOrders(newPage, query || undefined);
  }, [searchQuery, fetchOrders]);
  
  // Handle session selection
  const handleSelectOrder = useCallback((order: OrderListItem, isReadOnly: boolean) => {
    // Allow selecting any order with a session
    // The parent component will handle cases where session_data might be incomplete
    if (order.session) {
      onSelectSession(order, isReadOnly);
    }
  }, [onSelectSession]);
  
  // Format date for display
  const formatDate = useCallback((dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  }, []);
  
  // Get relative time
  const getRelativeTime = useCallback((dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return formatDate(dateString);
    } catch {
      return '';
    }
  }, [formatDate]);
  
  // Get session status info
  const getSessionStatusInfo = useCallback((order: OrderListItem) => {
    const sessionState = order.session?.state;
    const sessionStatus = order.session?.session_data?.status;
    
    // Order state determines if we can edit or only view
    if (order.state === 'done' || order.state === 'cancel') {
      return {
        label: order.state === 'done' ? (t('sessions.completed') || 'Completed') : (t('sessions.cancelled') || 'Cancelled'),
        color: order.state === 'done' ? colors.success : colors.error,
        bgColor: order.state === 'done' ? colors.successSoft : colors.errorSoft,
        icon: order.state === 'done' ? CheckCircle : AlertCircle,
        canEdit: false,
        canView: true,
      };
    }
    
    if (order.state === 'sale') {
      return {
        label: t('sessions.confirmed') || 'Confirmed',
        color: colors.success,
        bgColor: colors.successSoft,
        icon: CheckCircle,
        canEdit: false,
        canView: true,
      };
    }
    
    // Draft orders can be edited/resumed
    if (order.state === 'draft') {
      const step = order.session?.session_data?.currentStep || 1;
      return {
        label: `${t('sessions.step') || 'Step'} ${step}`,
        color: colors.warning,
        bgColor: colors.warningSoft,
        icon: Clock,
        canEdit: true,
        canView: true,
      };
    }
    
    return {
      label: order.state,
      color: colors.text.muted,
      bgColor: 'rgba(128,128,128,0.1)',
      icon: Clock,
      canEdit: false,
      canView: true,
    };
  }, [t]);
  
  // Don't render if not visible
  if (!isVisible) {
    return null;
  }
  
  return (
    <div className="sessions-history-overlay">
      <div className="sessions-history-modal">
        {/* Header */}
        <div className="sessions-history-header">
          <div className="sessions-history-header-title">
            <Clock size={20} />
            <h2>{t('sessions.historyTitle') || 'Past Sessions'}</h2>
          </div>
          <button 
            className="sessions-history-close"
            onClick={onClose}
            aria-label={t('common.close') || 'Close'}
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Search Bar */}
        <div className="sessions-search-container">
          <div className="sessions-search-input-wrapper">
            <Search size={16} className="sessions-search-icon" />
            <input
              type="text"
              className="sessions-search-input"
              placeholder={
                workflowType === 'salesperson'
                  ? (t('sessions.searchByCustomerId') || 'Search by customer ID...')
                  : (t('sessions.searchPlaceholder') || 'Search by subscription ID...')
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
            {searchQuery && (
              <button 
                className="sessions-search-clear"
                onClick={() => {
                  setSearchQuery('');
                  fetchOrders(1);
                  setCurrentPage(1);
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button 
            className="sessions-search-btn"
            onClick={handleSearch}
            disabled={isLoading}
          >
            {isSearching ? (
              <RefreshCw size={16} className="animate-spin" />
            ) : (
              <Search size={16} />
            )}
          </button>
        </div>
        
        {/* Content */}
        <div className="sessions-history-content">
          {isLoading && orders.length === 0 ? (
            <div className="sessions-loading">
              <RefreshCw size={24} className="animate-spin" />
              <span>{t('sessions.loading') || 'Loading sessions...'}</span>
            </div>
          ) : error ? (
            <div className="sessions-error">
              <AlertCircle size={32} />
              <p>{error}</p>
              <button 
                className="sessions-retry-btn"
                onClick={() => fetchOrders(currentPage, searchQuery || undefined)}
              >
                {t('common.retry') || 'Retry'}
              </button>
            </div>
          ) : orders.length === 0 ? (
            <div className="sessions-empty">
              <Clock size={40} className="sessions-empty-icon" />
              <h3>{t('sessions.noSessionsTitle') || 'No Sessions Found'}</h3>
              <p>{searchQuery 
                ? (t('sessions.noSearchResults') || 'No sessions match your search')
                : (t('sessions.noSessionsDesc') || 'Your past sessions will appear here')
              }</p>
            </div>
          ) : (
            <div className="sessions-list">
              {orders.map((order) => {
                const statusInfo = getSessionStatusInfo(order);
                const StatusIcon = statusInfo.icon;
                const customerName = order.partner_name || order.session?.partner_name || 'Unknown';
                const subscriptionId = order.session?.session_data?.dynamicPlanId || 
                                       order.session?.session_data?.manualSubscriptionId ||
                                       order.session?.session_data?.customerData?.subscriptionId;
                const currentStep = order.session?.session_data?.currentStep || 1;
                const maxStep = workflowType === 'attendant' ? 6 : 8;
                const isReadOnly = !statusInfo.canEdit;
                const hasSession = !!order.session;
                const hasSessionData = !!order.session?.session_data;
                const isClickable = hasSession && (hasSessionData || statusInfo.canView);
                
                const cardModifier = statusInfo.canEdit
                  ? 'list-card--resumable'
                  : (order.state === 'done' || order.state === 'sale')
                    ? 'list-card--completed'
                    : '';

                return (
                  <div
                    key={order.id}
                    className={`list-card ${cardModifier} ${!isClickable ? 'session-card-locked' : ''}`}
                    onClick={() => isClickable && handleSelectOrder(order, isReadOnly)}
                    role={isClickable ? 'button' : undefined}
                    tabIndex={isClickable ? 0 : undefined}
                  >
                    <div className="list-card-accent" />
                    <div className="list-card-body">
                      <div className="list-card-content">
                        <div className="list-card-primary">{customerName}</div>
                        {subscriptionId && (
                          <div className="list-card-secondary">{subscriptionId}</div>
                        )}
                        <div className="list-card-meta">
                          <span>{order.name}</span>
                          <span className="list-card-dot">&middot;</span>
                          <span>{getRelativeTime(order.date_order)}</span>
                          {hasSessionData && (
                            <>
                              <span className="list-card-dot">&middot;</span>
                              <span>{currentStep}/{maxStep}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="list-card-actions">
                        <div 
                          className="list-card-badge"
                          style={{ backgroundColor: statusInfo.bgColor, color: statusInfo.color }}
                        >
                          <StatusIcon size={10} />
                          <span>{statusInfo.label}</span>
                        </div>
                        {isClickable && (
                          <div className={`list-card-action-icon ${isReadOnly ? 'list-card-action-icon--muted' : 'list-card-action-icon--active'}`}>
                            {isReadOnly ? <Eye size={12} /> : <Play size={12} />}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Pagination */}
        {pagination && pagination.total_pages > 1 && (
          <div className="sessions-pagination">
            <button
              className="sessions-pagination-btn"
              disabled={!pagination.has_previous_page || isLoading}
              onClick={() => handlePageChange(currentPage - 1)}
            >
              <ChevronLeft size={16} />
            </button>
            
            <span className="sessions-pagination-info">
              {t('sessions.page') || 'Page'} {pagination.current_page} {t('common.of') || 'of'} {pagination.total_pages}
            </span>
            
            <button
              className="sessions-pagination-btn"
              disabled={!pagination.has_next_page || isLoading}
              onClick={() => handlePageChange(currentPage + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
        
        {/* Footer hint */}
        <div className="sessions-footer-hint">
          <AlertCircle size={14} />
          <span>{t('sessions.viewEditHint') || 'Tap to view. Only draft sessions can be edited.'}</span>
        </div>
      </div>
    </div>
  );
}

export type { OrderListItem };

