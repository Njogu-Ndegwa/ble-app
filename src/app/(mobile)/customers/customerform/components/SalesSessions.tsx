"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useI18n } from '@/i18n';
import { getOrdersList, type OrderListItem, type OrdersPagination } from '@/lib/odoo-api';
import { getSalesRoleToken } from '@/lib/attendant-auth';
import { RefreshCw, Clock, User, FileText, Play, Search, X, ChevronLeft, ChevronRight, Eye } from 'lucide-react';

interface SalesSessionsProps {
  onSelectSession?: (order: OrderListItem, isReadOnly: boolean) => void;
}

const ITEMS_PER_PAGE = 15;

const SalesSessions: React.FC<SalesSessionsProps> = ({ onSelectSession }) => {
  const { t } = useI18n();
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<OrderListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<OrdersPagination | null>(null);
  const [page, setPage] = useState(1);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const fetchSessions = useCallback(async (pageNum: number = 1, subscriptionCode?: string) => {
    const authToken = getSalesRoleToken();
    if (!authToken) {
      setError(t('sales.sessions.notAuthenticated') || 'Not authenticated');
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
      }

      const response = await getOrdersList(params, authToken);
      
      // Filter to only show orders that have session data
      const sessionsWithData = (response.orders || []).filter(
        order => order.session && order.session.session_data
      );
      
      setOrders(sessionsWithData);
      setFilteredOrders(sessionsWithData);
      setPagination(response.pagination);
    } catch (err: any) {
      console.error('Failed to fetch sessions:', err);
      setError(err.message || t('sales.sessions.fetchError') || 'Failed to load sessions');
      toast.error(t('sales.sessions.fetchError') || 'Failed to load sessions');
    } finally {
      setIsLoading(false);
      setIsSearching(false);
    }
  }, [t]);

  useEffect(() => {
    fetchSessions(page);
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = () => {
    setSearchQuery('');
    setPage(1);
    fetchSessions(1);
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      fetchSessions(1);
      return;
    }
    setIsSearching(true);
    setPage(1);
    fetchSessions(1, searchQuery.trim());
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setPage(1);
    fetchSessions(1);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleNextPage = () => {
    if (pagination && pagination.has_next_page) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchSessions(nextPage, searchQuery.trim() || undefined);
    }
  };

  const handlePrevPage = () => {
    if (page > 1) {
      const prevPage = page - 1;
      setPage(prevPage);
      fetchSessions(prevPage, searchQuery.trim() || undefined);
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

  const getStatusBadge = (order: OrderListItem) => {
    const session = order.session;
    if (!session) return null;
    
    const workflowStatus = session.session_data?.status;
    const isCompleted = workflowStatus === 'completed';
    const isPending = workflowStatus === 'in_progress';
    
    return (
      <span className={`session-status-badge ${isCompleted ? 'completed' : isPending ? 'pending' : 'default'}`}>
        {isCompleted ? (t('sessions.completed') || 'Completed') : 
         isPending ? (t('sales.sessions.inProgress') || 'In Progress') : 
         (workflowStatus || session.state)}
      </span>
    );
  };

  const canResume = (order: OrderListItem) => {
    const session = order.session;
    if (!session) return false;
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
          {t('sales.sessions.title') || 'Sales Sessions'}
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
            placeholder={t('sales.sessions.searchPlaceholder') || 'Search by subscription code...'}
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
              ? (t('sales.sessions.noSearchResults') || 'No sessions match your search')
              : (t('sales.sessions.noSessions') || 'No sessions found')
            }
          </p>
          <span className="empty-hint">
            {searchQuery 
              ? (t('sales.sessions.tryDifferentSearch') || 'Try a different search term')
              : (t('sales.sessions.noSessionsHint') || 'Sessions will appear here after starting sales')
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
              const isResumable = canResume(order);
              
              return (
                <div 
                  key={order.id}
                  className={`session-card-item ${isResumable ? 'resumable' : ''}`}
                  onClick={() => onSelectSession?.(order, !isResumable)}
                >
                  <div className="session-card-main">
                    <div className="session-card-left">
                      <div className="session-avatar">
                        <User size={18} />
                      </div>
                      <div className="session-info">
                        <span className="session-customer-name">
                          {order.partner_name || t('common.unknown') || 'Unknown'}
                        </span>
                        <span className="session-order-name">{order.name}</span>
                      </div>
                    </div>
                    <div className="session-card-right">
                      {getStatusBadge(order)}
                      <div className={`session-action-icon ${isResumable ? 'active' : 'completed'}`}>
                        {isResumable ? <Play size={16} /> : <Eye size={16} />}
                      </div>
                    </div>
                  </div>
                  
                  <div className="session-card-footer">
                    <div className="session-time">
                      <Clock size={12} />
                      <span>{session?.start_date ? formatDate(session.start_date) : formatDate(order.date_order)}</span>
                    </div>
                    {session?.session_data?.currentStep && (
                      <span className="session-step">
                        {t('sales.sessions.step') || 'Step'} {session.session_data.currentStep}/8
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          <div className="sessions-pagination">
            <div className="pagination-info">
              {t('sales.sessions.showing') || 'Showing'} {startItem}-{endItem} {t('sales.sessions.of') || 'of'} {totalItems}
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

export default SalesSessions;
