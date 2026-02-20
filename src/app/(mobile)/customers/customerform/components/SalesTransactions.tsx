"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { useI18n } from '@/i18n';
import { 
  getAttendantTransactions, 
  type AttendantTransactionsResponse, 
  type AttendantTransaction,
  type TransactionPeriod 
} from '@/lib/odoo-api';
import { getSalesRoleToken } from '@/lib/attendant-auth';
import { Receipt, Clock, CreditCard } from 'lucide-react';
import ListScreen, { type ListPeriod } from '@/components/ui/ListScreen';

interface SalesTransactionsProps {
  onSelectTransaction?: (transaction: AttendantTransaction) => void;
}

const SalesTransactions: React.FC<SalesTransactionsProps> = ({ onSelectTransaction }) => {
  const { t } = useI18n();
  const [data, setData] = useState<AttendantTransactionsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<ListPeriod>('7days');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchTransactions = useCallback(async () => {
    const authToken = getSalesRoleToken();
    
    if (!authToken) {
      setError(t('sales.transactions.notAuthenticated') || 'Not authenticated');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await getAttendantTransactions(period as TransactionPeriod, authToken);
      
      if (response && response.success !== false) {
        setData(response);
      } else {
        setError(t('sales.transactions.fetchError') || 'Failed to load transactions');
      }
    } catch (err: any) {
      console.error('Failed to fetch transactions:', err);
      const errorMessage = err.message || t('sales.transactions.fetchError') || 'Failed to load transactions';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [period, t]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Client-side search filter
  const filteredTransactions = useMemo(() => {
    if (!data?.transactions) return [];
    const q = searchQuery.toLowerCase().trim();
    if (!q) return data.transactions;
    return data.transactions.filter(
      (tx) =>
        tx.customer.name.toLowerCase().includes(q) ||
        tx.customer.phone?.toLowerCase().includes(q) ||
        tx.reference?.toLowerCase().includes(q) ||
        tx.order?.name?.toLowerCase().includes(q)
    );
  }, [data?.transactions, searchQuery]);

  const handlePeriodChange = useCallback((newPeriod: ListPeriod) => {
    setPeriod(newPeriod);
  }, []);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatAmount = (amount: number, currency: string) => {
    return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  const getStateBadgeClass = (state: string) => {
    switch (state) {
      case 'paid': return 'list-card-badge--completed';
      case 'pending': return 'list-card-badge--progress';
      default: return 'list-card-badge--default';
    }
  };

  // Summary cards rendered between filter and list
  const summaryCards = data?.summary && !isLoading ? (
    <div className="flex gap-2 mb-3">
      <div className="flex-1 rounded-xl border border-border bg-bg-tertiary p-3 text-center">
        <span className="text-xs text-text-muted block">{t('sales.transactions.totalAmount') || 'Total'}</span>
        <span className="text-sm font-semibold text-text-primary">
          {data.transactions[0]?.currency || ''} {data.summary.total_amount.toLocaleString()}
        </span>
      </div>
      <div className="flex-1 rounded-xl border border-border bg-bg-tertiary p-3 text-center">
        <span className="text-xs text-text-muted block">{t('sales.transactions.count') || 'Transactions'}</span>
        <span className="text-sm font-semibold text-text-primary">{data.summary.total_transactions}</span>
      </div>
      <div className="flex-1 rounded-xl border border-border bg-bg-tertiary p-3 text-center">
        <span className="text-xs text-text-muted block">{t('sales.transactions.customers') || 'Customers'}</span>
        <span className="text-sm font-semibold text-text-primary">{data.summary.unique_customers}</span>
      </div>
    </div>
  ) : undefined;

  return (
    <ListScreen
      title={t('sales.transactions.title') || 'My Transactions'}
      searchPlaceholder={t('sales.transactions.searchPlaceholder') || 'Search by name, reference...'}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      period={period}
      onPeriodChange={handlePeriodChange}
      isLoading={isLoading}
      error={error}
      onRefresh={fetchTransactions}
      isEmpty={filteredTransactions.length === 0}
      emptyIcon={<Receipt size={28} className="text-text-muted" />}
      emptyMessage={
        searchQuery.trim()
          ? (t('sales.transactions.noSearchResults') || 'No transactions match your search')
          : (t('sales.transactions.noTransactions') || 'No transactions found')
      }
      emptyHint={
        searchQuery.trim()
          ? (t('sales.transactions.tryDifferentSearch') || 'Try a different search term')
          : (t('sales.transactions.noTransactionsHint') || 'Transactions will appear here after completing sales')
      }
      itemCount={filteredTransactions.length}
      itemLabel={filteredTransactions.length === 1
        ? (t('sales.transactions.singular') || 'transaction')
        : (t('sales.transactions.plural') || 'transactions')
      }
      headerExtra={summaryCards}
    >
      {filteredTransactions.map((transaction) => (
        <div 
          key={transaction.payment_id}
          className="list-card"
          onClick={() => onSelectTransaction?.(transaction)}
        >
          <div className="list-card-body">
            <div className="list-card-content">
              <div className="list-card-primary">{transaction.customer.name}</div>
              {transaction.reference && (
                <div className="list-card-secondary">
                  {transaction.reference}
                </div>
              )}
              <div className="list-card-meta">
                <Clock size={10} />
                <span>{formatDate(transaction.payment_date)}</span>
                <span className="list-card-dot">&middot;</span>
                <CreditCard size={10} />
                <span>{transaction.payment_method}</span>
                <span className="list-card-dot">&middot;</span>
                <span className="list-card-meta-mono list-card-meta-bold">{formatAmount(transaction.amount, transaction.currency)}</span>
              </div>
            </div>
            <div className="list-card-actions">
              <span className={`list-card-badge ${getStateBadgeClass(transaction.state)}`}>
                {transaction.state.charAt(0).toUpperCase() + transaction.state.slice(1)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </ListScreen>
  );
};

export default SalesTransactions;
