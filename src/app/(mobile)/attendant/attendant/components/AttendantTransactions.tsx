"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useI18n } from '@/i18n';
import { 
  getAttendantTransactions, 
  type AttendantTransactionsResponse, 
  type AttendantTransaction,
  type TransactionPeriod 
} from '@/lib/odoo-api';
import { getAttendantRoleToken } from '@/lib/attendant-auth';
import { RefreshCw, ChevronRight, Receipt, Calendar, Clock, CreditCard } from 'lucide-react';

interface AttendantTransactionsProps {
  onSelectTransaction?: (transaction: AttendantTransaction) => void;
}

const PERIOD_OPTIONS: { value: TransactionPeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '3days', label: 'Last 3 Days' },
  { value: '5days', label: 'Last 5 Days' },
  { value: '7days', label: 'Last 7 Days' },
  { value: '14days', label: 'Last 14 Days' },
  { value: '30days', label: 'Last 30 Days' },
];

const AttendantTransactions: React.FC<AttendantTransactionsProps> = ({ onSelectTransaction }) => {
  const { t } = useI18n();
  const [data, setData] = useState<AttendantTransactionsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<TransactionPeriod>('7days');
  const [showPeriodPicker, setShowPeriodPicker] = useState(false);

  const fetchTransactions = useCallback(async () => {
    const authToken = getAttendantRoleToken();
    console.log('[AttendantTransactions] Fetching with token:', authToken ? `${authToken.substring(0, 20)}...` : 'NONE');
    
    if (!authToken) {
      console.error('[AttendantTransactions] No auth token available');
      setError(t('attendant.transactions.notAuthenticated') || 'Not authenticated');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('[AttendantTransactions] Calling API with period:', period);
      const response = await getAttendantTransactions(period, authToken);
      console.log('[AttendantTransactions] API Response:', response);
      
      if (response && response.success !== false) {
        setData(response);
      } else {
        console.error('[AttendantTransactions] API returned unsuccessful response:', response);
        setError(t('attendant.transactions.fetchError') || 'Failed to load transactions');
      }
    } catch (err: any) {
      console.error('[AttendantTransactions] Failed to fetch transactions:', err);
      console.error('[AttendantTransactions] Error details:', {
        message: err.message,
        status: err.status,
        stack: err.stack
      });
      
      const errorMessage = err.message || t('attendant.transactions.fetchError') || 'Failed to load transactions';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [period, t]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleRefresh = () => {
    fetchTransactions();
  };

  const handlePeriodChange = (newPeriod: TransactionPeriod) => {
    setPeriod(newPeriod);
    setShowPeriodPicker(false);
  };

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

  const getStateColor = (state: string) => {
    switch (state) {
      case 'paid': return 'var(--color-success)';
      case 'pending': return 'var(--color-warning)';
      case 'cancelled': return 'var(--color-error)';
      default: return 'var(--text-muted)';
    }
  };

  const getStateBadgeClass = (state: string) => {
    switch (state) {
      case 'paid': return 'list-card-badge--completed';
      case 'pending': return 'list-card-badge--progress';
      default: return 'list-card-badge--default';
    }
  };

  const getPeriodLabel = () => {
    return PERIOD_OPTIONS.find(p => p.value === period)?.label || period;
  };

  return (
    <div className="attendant-transactions">
      {/* Header */}
      <div className="transactions-header">
        <div className="transactions-header-top">
          <h2 className="transactions-title">
            {t('attendant.transactions.title') || 'My Transactions'}
          </h2>
          <button 
            className="transactions-refresh-btn"
            onClick={handleRefresh}
            disabled={isLoading}
            aria-label={t('common.refresh') || 'Refresh'}
          >
            <RefreshCw size={18} className={isLoading ? 'spinning' : ''} />
          </button>
        </div>
        
        {/* Period Filter */}
        <div className="transactions-filter">
          <button 
            className="period-selector"
            onClick={() => setShowPeriodPicker(!showPeriodPicker)}
          >
            <Calendar size={14} />
            <span>{getPeriodLabel()}</span>
            <ChevronRight size={14} className={`chevron ${showPeriodPicker ? 'open' : ''}`} />
          </button>
          
          {showPeriodPicker && (
            <div className="period-dropdown">
              {PERIOD_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className={`period-option ${period === option.value ? 'active' : ''}`}
                  onClick={() => handlePeriodChange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {data?.summary && !isLoading && (
        <div className="transactions-summary">
          <div className="summary-card">
            <span className="summary-label">{t('attendant.transactions.totalAmount') || 'Total'}</span>
            <span className="summary-value">
              {data.transactions[0]?.currency || ''} {data.summary.total_amount.toLocaleString()}
            </span>
          </div>
          <div className="summary-card">
            <span className="summary-label">{t('attendant.transactions.count') || 'Transactions'}</span>
            <span className="summary-value">{data.summary.total_transactions}</span>
          </div>
          <div className="summary-card">
            <span className="summary-label">{t('attendant.transactions.customers') || 'Customers'}</span>
            <span className="summary-value">{data.summary.unique_customers}</span>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="transactions-loading">
          <div className="loading-spinner"></div>
          <p>{t('common.loading') || 'Loading...'}</p>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="transactions-error">
          <p>{error}</p>
          <button onClick={handleRefresh} className="retry-btn">
            {t('common.tryAgain') || 'Try Again'}
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && data?.transactions.length === 0 && (
        <div className="transactions-empty">
          <Receipt size={48} strokeWidth={1} />
          <p>{t('attendant.transactions.noTransactions') || 'No transactions found'}</p>
          <span className="empty-hint">
            {t('attendant.transactions.noTransactionsHint') || 'Transactions will appear here after completing swaps'}
          </span>
        </div>
      )}

      {/* Transactions List */}
      {!isLoading && !error && data && data.transactions.length > 0 && (
        <div className="transactions-list">
          {data.transactions.map((transaction) => (
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
        </div>
      )}

      {/* Date Range Info */}
      {data?.date_range && !isLoading && (
        <div className="transactions-date-range">
          <span>
            {data.date_range.from} — {data.date_range.to}
          </span>
        </div>
      )}
    </div>
  );
};

export default AttendantTransactions;

