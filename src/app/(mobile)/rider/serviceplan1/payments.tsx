import React from 'react';
import { CreditCard } from 'lucide-react';
import { useI18n } from '@/i18n';

interface PaymentTransaction {
  id: string;
  planName: string;
  amount: number;
  date: string;
  status: 'completed' | 'pending' | 'failed';
}

interface PaymentsProps {
  paymentHistory: PaymentTransaction[];
}

const Payments: React.FC<PaymentsProps> = ({ paymentHistory }) => {
  const { t } = useI18n();
  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-success-soft text-success border-success-border';
      case 'pending':
        return 'bg-warning-soft text-warning border-warning-border';
      case 'failed':
        return 'bg-error-soft text-error border-error-border';
      default:
        return 'bg-bg-elevated/20 text-text-secondary border-border/30';
    }
  };

  const formatTransactionId = (id: string) => {
    // Show only first 8 characters for mobile
    return id.length > 8 ? `${id.substring(0, 8)}...` : id;
  };

  return (
    <div className="space-y-6 p-4">
      {/* <div className="text-center">
        <h1 className="text-3xl font-bold text-text-primary mb-2">Payment History</h1>
        <p className="text-text-secondary">View all your transactions and payment details</p>
      </div> */}

      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="w-5 h-5 text-text-secondary" />
          <h2 className="text-lg font-semibold text-text-primary">{t('Transactions')}</h2>
        </div>

        {paymentHistory.length > 0 ? (
          <div className="space-y-3">
            {paymentHistory.map((transaction) => (
              <div
                key={transaction.id}
                className="bg-bg-tertiary rounded-xl p-4 border border-border"
              >
                <div className="space-y-3">
                  {/* Transaction ID and Status */}
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-xs text-text-secondary">{t('Transaction ID')}</p>
                      <p className="text-sm text-text-primary font-mono">
                        {formatTransactionId(transaction.id)}
                      </p>
                    </div>
                    <div>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getStatusStyles(transaction.status)}`}>
                        {transaction.status}
                      </span>
                    </div>
                  </div>

                  {/* Plan Name */}
                  <div>
                    <p className="text-xs text-text-secondary">{t('Plan')}</p>
                    <p className="text-sm text-text-primary font-medium">{transaction.planName}</p>
                  </div>

                  {/* Amount and Date */}
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-xs text-text-secondary">{t('Amount')}</p>
                      <p className="text-lg font-bold text-text-primary">${transaction.amount}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-text-secondary">{t('Date')}</p>
                      <p className="text-sm text-text-primary">{transaction.date}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-bg-tertiary rounded-xl p-8 border border-border text-center">
            <CreditCard className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-text-primary mb-2">{t('No Payment History')}</h3>
            <p className="text-text-secondary">{t('Your transaction history will appear here once you make your first payment.')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Payments;