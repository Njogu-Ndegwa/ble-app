"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useI18n } from '@/i18n';
import { getOrdersList, type OrderListItem, type OrdersPagination } from '@/lib/odoo-api';
import { getAttendantRoleToken } from '@/lib/attendant-auth';
import { RefreshCw, Clock, FileText, Play, Search, X, ChevronLeft, ChevronRight, Hash, Eye } from 'lucide-react';

interface AttendantSessionsProps {
  onSelectSession?: (order: OrderListItem, isReadOnly: boolean) => void;
}

const ITEMS_PER_PAGE = 15;

const AttendantSessions: React.FC<AttendantSessionsProps> = ({ onSelectSession }) => {
  const { t } = useI18n();
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<OrderListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<OrdersPagination | null>(null);
  const [page, setPage] = useState(1);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearchQuery, setActiveSearchQuery] = useState(''); // The query that was actually searched
  const [isSearching, setIsSearching] = useState(false);

  const fetchSessions = useCallback(async (pageNum: number = 1, subscriptionCode?: string) => {
    const authToken = getAttendantRoleToken();
    
    console.log('=== [AttendantSessions] FETCH SESSIONS START ===');
    console.log('[AttendantSessions] pageNum:', pageNum);
    console.log('[AttendantSessions] subscriptionCode:', subscriptionCode);
    console.log('[AttendantSessions] authToken exists:', !!authToken);
    
    if (!authToken) {
      console.error('[AttendantSessions] No auth token!');
      setError(t('attendant.sessions.notAuthenticated') || 'Not authenticated');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params: { mine: boolean; limit: number; page: number; subscription_code?: string } = {
        mine: true,
        limit: ITEMS_PER_PAGE,
        page: pageNum,
      };
      
      // Add subscription_code filter if searching
      if (subscriptionCode && subscriptionCode.trim()) {
        params.subscription_code = subscriptionCode.trim();
        console.log('[AttendantSessions] Added subscription_code filter:', params.subscription_code);
      }

      console.log('[AttendantSessions] API params:', JSON.stringify(params, null, 2));
      
      const response = await getOrdersList(params, authToken);
      
      console.log('[AttendantSessions] API response received');
      console.log('[AttendantSessions] Total orders from API:', response.orders?.length || 0);
      console.log('[AttendantSessions] Pagination:', JSON.stringify(response.pagination, null, 2));
      
      // Filter to only show orders that have session data
      const sessionsWithData = (response.orders || []).filter(
        order => order.session && order.session.session_data
      );
      
      console.log('[AttendantSessions] Sessions with data after filter:', sessionsWithData.length);
      
      // Log each session's subscription info for debugging
      sessionsWithData.forEach((order, idx) => {
        const sessionData = order.session?.session_data;
        const subCode = sessionData?.dynamicPlanId || sessionData?.customerData?.subscriptionId || sessionData?.manualSubscriptionId;
        console.log(`[AttendantSessions] Session ${idx}: order=${order.name}, subscriptionCode=${subCode}, customer=${order.partner_name}`);
      });
      
      setOrders(sessionsWithData);
      setFilteredOrders(sessionsWithData);
      setPagination(response.pagination);
      
      console.log('=== [AttendantSessions] FETCH SESSIONS END ===');
    } catch (err: any) {
      console.error('[AttendantSessions] FETCH ERROR:', err);
      console.error('[AttendantSessions] Error message:', err.message);
      console.error('[AttendantSessions] Error stack:', err.stack);
      setError(err.message || t('attendant.sessions.fetchError') || 'Failed to load sessions');
      toast.error(t('attendant.sessions.fetchError') || 'Failed to load sessions');
    } finally {
      setIsLoading(false);
      setIsSearching(false);
    }
  }, [t]);

  // Fetch sessions on mount and when page/activeSearchQuery changes
  useEffect(() => {
    console.log('=== [AttendantSessions] useEffect TRIGGERED ===');
    console.log('[AttendantSessions] page:', page);
    console.log('[AttendantSessions] activeSearchQuery:', activeSearchQuery);
    fetchSessions(page, activeSearchQuery || undefined);
  }, [page, activeSearchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = () => {
    setSearchQuery('');
    setActiveSearchQuery('');
    setPage(1);
    // fetchSessions will be called by useEffect
  };

  const handleSearch = () => {
    const query = searchQuery.trim();
    console.log('=== [AttendantSessions] HANDLE SEARCH ===');
    console.log('[AttendantSessions] searchQuery (raw):', searchQuery);
    console.log('[AttendantSessions] query (trimmed):', query);
    console.log('[AttendantSessions] query length:', query.length);
    setIsSearching(true);
    setActiveSearchQuery(query); // This will trigger useEffect
    setPage(1);
    // fetchSessions will be called by useEffect with the new activeSearchQuery
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setActiveSearchQuery('');
    setPage(1);
    // fetchSessions will be called by useEffect
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleNextPage = () => {
    if (pagination && pagination.has_next_page) {
      setPage(page + 1);
      // fetchSessions will be called by useEffect with activeSearchQuery
    }
  };

  const handlePrevPage = () => {
    if (page > 1) {
      setPage(page - 1);
      // fetchSessions will be called by useEffect with activeSearchQuery
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusInfo = (order: OrderListItem) => {
    const session = order.session;
    if (!session) return { label: '', badgeClass: 'list-card-badge--default' };
    
    const workflowStatus = session.session_data?.status;
    const isCompleted = workflowStatus === 'completed';
    const isPending = workflowStatus === 'in_progress';
    
    const badgeClass = isCompleted
      ? 'list-card-badge--completed'
      : isPending
        ? 'list-card-badge--progress'
        : 'list-card-badge--default';

    const label = isCompleted ? (t('sessions.completed') || 'Completed') : 
         isPending ? (t('attendant.sessions.inProgress') || 'In Progress') : 
         (workflowStatus || session.state);

    return { label, badgeClass };
  };

  const canResume = (order: OrderListItem) => {
    const session = order.session;
    if (!session) return false;
    
    // A session can be resumed only if the workflow status is "in_progress"
    // Completed sessions should be read-only
    const workflowStatus = session.session_data?.status;
    return workflowStatus === 'in_progress';
  };

  // Calculate pagination info
  const totalItems = pagination?.total_records || filteredOrders.length;
  const startItem = totalItems === 0 ? 0 : ((page - 1) * ITEMS_PER_PAGE) + 1;
  const endItem = Math.min(page * ITEMS_PER_PAGE, totalItems);
  const totalPages = pagination?.total_pages || Math.ceil(totalItems / ITEMS_PER_PAGE);

  return (
    <div className="attendant-sessions">
      {/* Header */}
      <div className="sessions-header-bar">
        <h2 className="sessions-title">
          {t('attendant.sessions.title') || 'Swap Sessions'}
        </h2>
        <button 
          className="sessions-refresh-btn"
          onClick={handleRefresh}
          disabled={isLoading}
          aria-label={t('common.refresh') || 'Refresh'}
        >
          <RefreshCw size={18} className={isLoading ? 'spinning' : ''} />
        </button>
      </div>

      {/* Search Bar */}
      <div className="sessions-search">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder={t('attendant.sessions.searchPlaceholder') || 'Search by subscription code...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
          />
          {searchQuery && (
            <button 
              className="search-clear-btn"
              onClick={handleClearSearch}
              aria-label={t('common.clear') || 'Clear'}
            >
              <X size={16} />
            </button>
          )}
        </div>
        <button 
          className="search-btn"
          onClick={handleSearch}
          disabled={isLoading}
        >
          {isSearching ? (
            <span className="btn-loading-dots">
              <span></span><span></span><span></span>
            </span>
          ) : (
            t('common.search') || 'Search'
          )}
        </button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="sessions-loading">
          <div className="loading-spinner"></div>
          <p>{t('common.loading') || 'Loading...'}</p>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="sessions-error">
          <p>{error}</p>
          <button onClick={handleRefresh} className="retry-btn">
            {t('common.tryAgain') || 'Try Again'}
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredOrders.length === 0 && (
        <div className="sessions-empty">
          <FileText size={48} strokeWidth={1} />
          <p>
            {searchQuery 
              ? (t('attendant.sessions.noSearchResults') || 'No sessions match your search')
              : (t('attendant.sessions.noSessions') || 'No sessions found')
            }
          </p>
          <span className="empty-hint">
            {searchQuery 
              ? (t('attendant.sessions.tryDifferentSearch') || 'Try a different search term')
              : (t('attendant.sessions.noSessionsHint') || 'Sessions will appear here after starting swaps')
            }
          </span>
        </div>
      )}

      {/* Sessions List */}
      {!isLoading && !error && filteredOrders.length > 0 && (
        <>
          <div className="sessions-list">
            {filteredOrders.map((order) => {
              const session = order.session;
              const sessionData = session?.session_data;
              const isResumable = canResume(order);
              const isCompleted = sessionData?.status === 'completed';
              
              const subscriptionCode = sessionData?.dynamicPlanId || 
                                       sessionData?.customerData?.subscriptionId ||
                                       sessionData?.manualSubscriptionId;
              const currentStep = sessionData?.currentStep || 1;
              const hasPaymentInfo = order.amount_total > 0 && order.paid_amount > 0;
              const { label: statusLabel, badgeClass } = getStatusInfo(order);
              
              return (
                <div 
                  key={order.id}
                  className={`list-card ${isResumable ? 'list-card--resumable' : ''} ${isCompleted ? 'list-card--completed' : ''}`}
                  onClick={() => onSelectSession?.(order, !isResumable)}
                >
                  <div className="list-card-body">
                    <div className="list-card-content">
                      <div className="list-card-primary">
                        {order.partner_name || t('common.unknown') || 'Unknown'}
                      </div>
                      {subscriptionCode && subscriptionCode.toString().trim() && (
                        <div className="list-card-secondary">
                          <Hash size={10} />
                          {subscriptionCode.toString().trim()}
                        </div>
                      )}
                      <div className="list-card-meta">
                        <Clock size={10} />
                        <span>{session?.start_date ? formatDate(session.start_date) : formatDate(order.date_order)}</span>
                        <span className="list-card-dot">&middot;</span>
                        <span>{t('attendant.sessions.step') || 'Step'} {currentStep}/6</span>
                      </div>
                    </div>
                    <div className="list-card-actions">
                      <span className={`list-card-badge ${badgeClass}`}>{statusLabel}</span>
                      {hasPaymentInfo && (
                        <span className="list-card-amount">{order.currency} {order.paid_amount.toLocaleString()}</span>
                      )}
                      <div className={`list-card-action-icon ${isResumable ? 'list-card-action-icon--active' : 'list-card-action-icon--muted'}`}>
                        {isResumable ? <Play size={12} /> : <Eye size={12} />}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          <div className="sessions-pagination">
            <div className="pagination-info">
              {t('attendant.sessions.showing') || 'Showing'} {startItem}-{endItem} {t('attendant.sessions.of') || 'of'} {totalItems}
            </div>
            <div className="pagination-controls">
              <button
                className="pagination-btn"
                onClick={handlePrevPage}
                disabled={page <= 1 || isLoading}
                aria-label={t('common.previous') || 'Previous'}
              >
                <ChevronLeft size={18} />
              </button>
              <span className="pagination-page">
                {page} / {totalPages || 1}
              </span>
              <button
                className="pagination-btn"
                onClick={handleNextPage}
                disabled={!pagination?.has_next_page || isLoading}
                aria-label={t('common.next') || 'Next'}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AttendantSessions;
