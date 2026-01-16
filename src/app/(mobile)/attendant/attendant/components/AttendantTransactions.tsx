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
import { RefreshCw, ChevronRight, User, Receipt, Calendar, Filter } from 'lucide-react';

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
    if (!authToken) {
      setError(t('attendant.transactions.notAuthenticated') || 'Not authenticated');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await getAttendantTransactions(period, authToken);
      setData(response);
    } catch (err: any) {
      console.error('Failed to fetch transactions:', err);
      setError(err.message || t('attendant.transactions.fetchError') || 'Failed to load transactions');
      toast.error(t('attendant.transactions.fetchError') || 'Failed to load transactions');
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
      case 'paid': return 'transaction-badge-success';
      case 'pending': return 'transaction-badge-warning';
      case 'cancelled': return 'transaction-badge-error';
      default: return 'transaction-badge-default';
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
              className="transaction-card"
              onClick={() => onSelectTransaction?.(transaction)}
            >
              <div className="transaction-main">
                <div className="transaction-customer">
                  <div className="customer-avatar">
                    <User size={16} />
                  </div>
                  <div className="customer-info">
                    <span className="customer-name">{transaction.customer.name}</span>
                    <span className="customer-phone">{transaction.customer.phone}</span>
                  </div>
                </div>
                <div className="transaction-amount">
                  <span className="amount">{formatAmount(transaction.amount, transaction.currency)}</span>
                  <span className={`transaction-badge ${getStateBadgeClass(transaction.state)}`}>
                    {transaction.state.charAt(0).toUpperCase() + transaction.state.slice(1)}
                  </span>
                </div>
              </div>
              
              <div className="transaction-details">
                <div className="detail-row">
                  <span className="detail-label">{t('attendant.transactions.date') || 'Date'}</span>
                  <span className="detail-value">{formatDate(transaction.payment_date)}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t('attendant.transactions.method') || 'Method'}</span>
                  <span className="detail-value">{transaction.payment_method}</span>
                </div>
                {transaction.order && (
                  <div className="detail-row">
                    <span className="detail-label">{t('attendant.transactions.order') || 'Order'}</span>
                    <span className="detail-value">{transaction.order.name}</span>
                  </div>
                )}
                {transaction.reference && (
                  <div className="detail-row">
                    <span className="detail-label">{t('attendant.transactions.reference') || 'Reference'}</span>
                    <span className="detail-value reference">{transaction.reference}</span>
                  </div>
                )}
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

