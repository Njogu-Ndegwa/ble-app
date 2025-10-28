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
        return 'bg-green-600/20 text-green-400 border-green-600/30';
      case 'pending':
        return 'bg-yellow-600/20 text-yellow-400 border-yellow-600/30';
      case 'failed':
        return 'bg-red-600/20 text-red-400 border-red-600/30';
      default:
        return 'bg-gray-600/20 text-gray-400 border-gray-600/30';
    }
  };

  const formatTransactionId = (id: string) => {
    // Show only first 8 characters for mobile
    return id.length > 8 ? `${id.substring(0, 8)}...` : id;
  };

  return (
    <div className="space-y-6 p-4">
      {/* <div className="text-center">
        <h1 className="text-3xl font-bold text-white mb-2">Payment History</h1>
        <p className="text-gray-400">View all your transactions and payment details</p>
      </div> */}

      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="w-5 h-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-white">{t('Transactions')}</h2>
        </div>

        {paymentHistory.length > 0 ? (
          <div className="space-y-3">
            {paymentHistory.map((transaction) => (
              <div
                key={transaction.id}
                className="bg-gray-700 rounded-xl p-4 border border-gray-600"
              >
                <div className="space-y-3">
                  {/* Transaction ID and Status */}
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-xs text-gray-400">{t('Transaction ID')}</p>
                      <p className="text-sm text-white font-mono">
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
                    <p className="text-xs text-gray-400">{t('Plan')}</p>
                    <p className="text-sm text-white font-medium">{transaction.planName}</p>
                  </div>

                  {/* Amount and Date */}
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-xs text-gray-400">{t('Amount')}</p>
                      <p className="text-lg font-bold text-white">${transaction.amount}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">{t('Date')}</p>
                      <p className="text-sm text-gray-300">{transaction.date}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-700 rounded-xl p-8 border border-gray-600 text-center">
            <CreditCard className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">{t('No Payment History')}</h3>
            <p className="text-gray-400">{t('Your transaction history will appear here once you make your first payment.')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Payments;