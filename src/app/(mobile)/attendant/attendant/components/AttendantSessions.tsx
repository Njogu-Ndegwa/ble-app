"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useI18n } from '@/i18n';
import { getOrdersList, type OrderListItem, type OrdersPagination } from '@/lib/odoo-api';
import { getAttendantRoleToken } from '@/lib/attendant-auth';
import { Clock, FileText, Play, Hash, Eye } from 'lucide-react';
import ListScreen, { type ListPeriod } from '@/components/ui/ListScreen';

interface AttendantSessionsProps {
  onSelectSession?: (order: OrderListItem, isReadOnly: boolean) => void;
}

const ITEMS_PER_PAGE = 15;

const AttendantSessions: React.FC<AttendantSessionsProps> = ({ onSelectSession }) => {
  const { t } = useI18n();
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<OrdersPagination | null>(null);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [period, setPeriod] = useState<ListPeriod>('30days');

  const fetchSessions = useCallback(async (pageNum: number = 1, subscriptionCode?: string) => {
    const authToken = getAttendantRoleToken();
    if (!authToken) {
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
      
      if (subscriptionCode && subscriptionCode.trim()) {
        params.subscription_code = subscriptionCode.trim();
      }

      const response = await getOrdersList(params, authToken);
      
      const sessionsWithData = (response.orders || []).filter(
        order => order.session && order.session.session_data
      );
      
      setOrders(sessionsWithData);
      setPagination(response.pagination);
    } catch (err: any) {
      console.error('Failed to fetch sessions:', err);
      setError(err.message || t('attendant.sessions.fetchError') || 'Failed to load sessions');
      toast.error(t('attendant.sessions.fetchError') || 'Failed to load sessions');
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchSessions(page);
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = useCallback(() => {
    setSearchQuery('');
    setPage(1);
    fetchSessions(1);
  }, [fetchSessions]);

  const handleSearch = useCallback(() => {
    setPage(1);
    fetchSessions(1, searchQuery.trim() || undefined);
  }, [fetchSessions, searchQuery]);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setPage(1);
      fetchSessions(1);
    }
  }, [fetchSessions]);

  const handleNextPage = useCallback(() => {
    if (pagination && pagination.has_next_page) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchSessions(nextPage, searchQuery.trim() || undefined);
    }
  }, [pagination, page, fetchSessions, searchQuery]);

  const handlePrevPage = useCallback(() => {
    if (page > 1) {
      const prevPage = page - 1;
      setPage(prevPage);
      fetchSessions(prevPage, searchQuery.trim() || undefined);
    }
  }, [page, fetchSessions, searchQuery]);

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
    return session.session_data?.status === 'in_progress';
  };

  const totalItems = pagination?.total_records || orders.length;
  const startItem = totalItems === 0 ? 0 : ((page - 1) * ITEMS_PER_PAGE) + 1;
  const endItem = Math.min(page * ITEMS_PER_PAGE, totalItems);
  const totalPages = pagination?.total_pages || Math.ceil(totalItems / ITEMS_PER_PAGE);

  return (
    <ListScreen
      title={t('attendant.sessions.title') || 'Swap Sessions'}
      searchPlaceholder={t('attendant.sessions.searchPlaceholder') || 'Search by subscription code...'}
      searchQuery={searchQuery}
      onSearchChange={handleSearchChange}
      onSearch={handleSearch}
      period={period}
      onPeriodChange={setPeriod}
      isLoading={isLoading}
      error={error}
      onRefresh={handleRefresh}
      isEmpty={orders.length === 0}
      emptyIcon={<FileText size={28} className="text-text-muted" />}
      emptyMessage={
        searchQuery
          ? (t('attendant.sessions.noSearchResults') || 'No sessions match your search')
          : (t('attendant.sessions.noSessions') || 'No sessions found')
      }
      emptyHint={
        searchQuery
          ? (t('attendant.sessions.tryDifferentSearch') || 'Try a different search term')
          : (t('attendant.sessions.noSessionsHint') || 'Sessions will appear here after starting swaps')
      }
      itemCount={orders.length}
      itemLabel={orders.length === 1
        ? (t('attendant.sessions.singular') || 'session')
        : (t('attendant.sessions.plural') || 'sessions')
      }
      page={page}
      totalPages={totalPages}
      totalItems={totalItems}
      onNextPage={handleNextPage}
      onPrevPage={handlePrevPage}
      hasNextPage={pagination?.has_next_page}
      paginationLabel={`${t('common.showing') || 'Showing'} ${startItem}-${endItem} ${t('common.of') || 'of'} ${totalItems}`}
    >
      {orders.map((order) => {
        const session = order.session;
        const sessionData = session?.session_data;
        const isResumable = canResume(order);
        
        const subscriptionCode = sessionData?.dynamicPlanId || 
                                 sessionData?.customerData?.subscriptionId ||
                                 sessionData?.manualSubscriptionId;
        const currentStep = sessionData?.currentStep || 1;
        const hasPaymentInfo = order.amount_total > 0 && order.paid_amount > 0;
        const { label: statusLabel, badgeClass } = getStatusInfo(order);
        
        return (
          <div 
            key={order.id}
            className="list-card"
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
                  <span className="list-card-meta-bold">{t('attendant.sessions.step') || 'Step'} {currentStep}/6</span>
                  {hasPaymentInfo && (
                    <>
                      <span className="list-card-dot">&middot;</span>
                      <span className="list-card-meta-mono list-card-meta-bold">{order.currency} {order.paid_amount.toLocaleString()}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="list-card-actions">
                <span className={`list-card-badge ${badgeClass}`}>{statusLabel}</span>
                <div className={`list-card-action-icon ${isResumable ? 'list-card-action-icon--active' : 'list-card-action-icon--muted'}`}>
                  {isResumable ? <Play size={12} /> : <Eye size={12} />}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </ListScreen>
  );
};

export default AttendantSessions;
