"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useI18n } from '@/i18n';
import { getOrdersList, type OrderListItem, type OrdersPagination } from '@/lib/odoo-api';
import { getSalesRoleToken } from '@/lib/attendant-auth';
import { Clock, User, FileText, Play, Phone, Mail, Eye } from 'lucide-react';
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

  const getStatusBadge = (order: OrderListItem) => {
    const session = order.session;
    if (!session) return null;
    
    const workflowStatus = session.session_data?.status;
    const isCompleted = workflowStatus === 'completed';
    const isPending = workflowStatus === 'in_progress';
    
    const badgeClass = isCompleted
      ? 'bg-success-soft text-success'
      : isPending
        ? 'bg-warning-soft text-warning'
        : 'bg-bg-elevated text-text-secondary';

    return (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeClass}`}>
        {isCompleted ? (t('sessions.completed') || 'Completed') : 
         isPending ? (t('sales.sessions.inProgress') || 'In Progress') : 
         (workflowStatus || session.state)}
      </span>
    );
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
        const customerPhone = sessionData?.formData?.phone;
        const customerEmail = sessionData?.formData?.email;
        const currentStep = sessionData?.currentStep || 1;
        const amountPaid = sessionData?.payment?.amountPaid || order.paid_amount || 0;
        const hasPaymentInfo = order.amount_total > 0;

        return (
          <div 
            key={order.id}
            className={`rounded-xl border bg-bg-tertiary p-3.5 transition-all active:scale-[0.98] hover:border-primary/40 cursor-pointer ${
              isResumable ? 'border-primary/30' : 'border-border'
            }`}
            onClick={() => onSelectSession?.(order, !isResumable)}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-primary flex-shrink-0">
                <User size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-text-primary truncate">
                  {order.partner_name || t('common.unknown') || 'Unknown'}
                </h4>
                <div className="flex items-center gap-3 mt-0.5">
                  {customerPhone && customerPhone.toString().trim() ? (
                    <span className="flex items-center gap-1 text-xs text-text-muted truncate">
                      <Phone size={11} /> {customerPhone.toString().trim()}
                    </span>
                  ) : customerEmail && customerEmail.toString().trim() ? (
                    <span className="flex items-center gap-1 text-xs text-text-muted truncate">
                      <Mail size={11} /> {customerEmail.toString().trim()}
                    </span>
                  ) : null}
                  <span className="flex items-center gap-1 text-xs text-text-muted">
                    <Clock size={11} />
                    {session?.start_date ? formatDate(session.start_date) : formatDate(order.date_order)}
                  </span>
                </div>
                <span className="text-xs text-text-muted mt-0.5 block">
                  {t('sales.sessions.step') || 'Step'} {currentStep}/8
                </span>
              </div>
              <div className="flex flex-col items-end gap-1.5 flex-shrink-0 ml-2">
                {getStatusBadge(order)}
                {hasPaymentInfo && amountPaid > 0 && (
                  <span className="text-sm font-semibold text-text-primary">
                    {order.currency} {amountPaid.toLocaleString()}
                  </span>
                )}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                  isResumable ? 'bg-primary/15 text-primary' : 'bg-bg-elevated text-text-muted'
                }`}>
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
