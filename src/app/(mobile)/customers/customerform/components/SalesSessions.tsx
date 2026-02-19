"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useI18n } from '@/i18n';
import { getOrdersList, type OrderListItem, type OrdersPagination } from '@/lib/odoo-api';
import { getSalesRoleToken } from '@/lib/attendant-auth';
import { Clock, FileText, Play, Phone, Mail, Eye, Hash } from 'lucide-react';
import ListScreen, { type ListPeriod } from '@/components/ui/ListScreen';

interface SalesSessionsProps {
  onSelectSession?: (order: OrderListItem, isReadOnly: boolean) => void;
}

const ITEMS_PER_PAGE = 15;

const SalesSessions: React.FC<SalesSessionsProps> = ({ onSelectSession }) => {
  const { t } = useI18n();
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<OrdersPagination | null>(null);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [period, setPeriod] = useState<ListPeriod>('30days');

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
      setError(err.message || t('sales.sessions.fetchError') || 'Failed to load sessions');
      toast.error(t('sales.sessions.fetchError') || 'Failed to load sessions');
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

  // Client-side date filter
  const getDateCutoff = useCallback((p: ListPeriod): Date | null => {
    const now = new Date();
    switch (p) {
      case 'today': return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      case '3days': { const d = new Date(now); d.setDate(d.getDate() - 3); return d; }
      case '5days': { const d = new Date(now); d.setDate(d.getDate() - 5); return d; }
      case '7days': { const d = new Date(now); d.setDate(d.getDate() - 7); return d; }
      case '14days': { const d = new Date(now); d.setDate(d.getDate() - 14); return d; }
      case '30days': { const d = new Date(now); d.setDate(d.getDate() - 30); return d; }
      default: return null;
    }
  }, []);

  const filteredOrders = React.useMemo(() => {
    const cutoff = getDateCutoff(period);
    if (!cutoff) return orders;
    return orders.filter((order) => {
      const dateStr = order.session?.start_date || order.date_order;
      return new Date(dateStr) >= cutoff;
    });
  }, [orders, period, getDateCutoff]);

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
         isPending ? (t('sales.sessions.inProgress') || 'In Progress') : 
         (workflowStatus || session.state);

    return { label, badgeClass };
  };

  const canResume = (order: OrderListItem) => {
    const session = order.session;
    if (!session) return false;
    return session.session_data?.status === 'in_progress';
  };

  // Pagination info
  const totalItems = pagination?.total_records || filteredOrders.length;
  const startItem = totalItems === 0 ? 0 : ((page - 1) * ITEMS_PER_PAGE) + 1;
  const endItem = Math.min(page * ITEMS_PER_PAGE, totalItems);
  const totalPages = pagination?.total_pages || Math.ceil(totalItems / ITEMS_PER_PAGE);

  return (
    <ListScreen
      title={t('sales.sessions.title') || 'Sales Sessions'}
      searchPlaceholder={t('sales.sessions.searchPlaceholder') || 'Search by subscription code...'}
      searchQuery={searchQuery}
      onSearchChange={handleSearchChange}
      onSearch={handleSearch}
      period={period}
      onPeriodChange={setPeriod}
      isLoading={isLoading}
      error={error}
      onRefresh={handleRefresh}
      isEmpty={filteredOrders.length === 0}
      emptyIcon={<FileText size={28} className="text-text-muted" />}
      emptyMessage={
        searchQuery
          ? (t('sales.sessions.noSearchResults') || 'No sessions match your search')
          : (t('sales.sessions.noSessions') || 'No sessions found')
      }
      emptyHint={
        searchQuery
          ? (t('sales.sessions.tryDifferentSearch') || 'Try a different search term')
          : (t('sales.sessions.noSessionsHint') || 'Sessions will appear here after starting sales')
      }
      itemCount={filteredOrders.length}
      itemLabel={filteredOrders.length === 1
        ? (t('sales.sessions.singular') || 'session')
        : (t('sales.sessions.plural') || 'sessions')
      }
      page={page}
      totalPages={totalPages}
      totalItems={totalItems}
      onNextPage={handleNextPage}
      onPrevPage={handlePrevPage}
      hasNextPage={pagination?.has_next_page}
      paginationLabel={`${t('common.showing') || 'Showing'} ${startItem}-${endItem} ${t('common.of') || 'of'} ${totalItems}`}
    >
      {filteredOrders.map((order) => {
        const session = order.session;
        const sessionData = session?.session_data;
        const isResumable = canResume(order);
        const isCompleted = sessionData?.status === 'completed';
        const customerPhone = sessionData?.formData?.phone;
        const customerEmail = sessionData?.formData?.email;
        const currentStep = sessionData?.currentStep || 1;
        const amountPaid = sessionData?.payment?.amountPaid || order.paid_amount || 0;
        const hasPaymentInfo = order.amount_total > 0 && amountPaid > 0;
        const { label: statusLabel, badgeClass } = getStatusInfo(order);
        const contactInfo = (customerPhone && customerPhone.toString().trim()) || (customerEmail && customerEmail.toString().trim()) || '';

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
                {contactInfo && (
                  <div className="list-card-secondary">
                    {customerPhone && customerPhone.toString().trim() ? (
                      <><Phone size={10} /> {customerPhone.toString().trim()}</>
                    ) : (
                      <><Mail size={10} /> {customerEmail?.toString().trim()}</>
                    )}
                  </div>
                )}
                <div className="list-card-meta">
                  <Clock size={10} />
                  <span>{session?.start_date ? formatDate(session.start_date) : formatDate(order.date_order)}</span>
                  <span className="list-card-dot">&middot;</span>
                  <span>{t('sales.sessions.step') || 'Step'} {currentStep}/8</span>
                </div>
              </div>
              <div className="list-card-actions">
                <span className={`list-card-badge ${badgeClass}`}>{statusLabel}</span>
                {hasPaymentInfo && (
                  <span className="list-card-amount">{order.currency} {amountPaid.toLocaleString()}</span>
                )}
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

export default SalesSessions;
