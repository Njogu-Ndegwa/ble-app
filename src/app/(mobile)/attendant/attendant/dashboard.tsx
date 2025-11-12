import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useI18n } from '@/i18n';

interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
}

interface SubscribedProduct {
  product_name: string;
  product_code: string;
  next_payment_date: string;
  price_unit: number;
}

interface DashboardSummary {
  active_subscriptions: number;
  subscribed_products: SubscribedProduct[];
}

interface DashboardProps {
  customer: Customer | null;
}

const Dashboard: React.FC<DashboardProps> = ({ customer }) => {
  const { t } = useI18n();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (customer?.id) {
      const fetchDashboardData = async () => {
        setIsLoading(true);
        try {
          const response = await fetch(
            `https://crm-omnivoltaic.odoo.com/api/customers/${customer.id}/dashboard`,
            {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
                "X-API-KEY": "abs_connector_secret_key_2024",
              },
            }
          );

          const data = await response.json();
          console.log("Dashboard API Response:", { status: response.status, data });

          if (response.status === 200 && data.success && data.summary) {
            setSummary({
              active_subscriptions: data.summary.active_subscriptions,
              subscribed_products: data.subscribed_products.map((product: any) => ({
                product_name: product.product_name,
                product_code: product.product_code,
                next_payment_date: product.next_payment_date,
                price_unit: product.price_unit,
              })),
            });
          } else {
            throw new Error(data.message || t('Failed to fetch dashboard data.'));
          }
        } catch (error: any) {
          console.error("Dashboard fetch error:", error);
          toast.error(error.message || t('Failed to load dashboard data.'));
        } finally {
          setIsLoading(false);
        }
      };

      fetchDashboardData();
    }
  }, [customer?.id]);

  return (
    <div className="space-y-6 p-4">
      <div className="text-center mb-6">
        <p className="text-gray-400">{t('Welcome back,')} {customer?.name}</p>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <div className="inline-block w-8 h-8 border-4 border-gray-600 border-t-gray-400 rounded-full animate-spin mb-3"></div>
          <p className="text-gray-400">{t('Loading dashboard data...')}</p>
        </div>
      ) : summary ? (
        <div className="space-y-6">
          {/* Active Subscriptions Card */}
          <div className="bg-gradient-to-br from-gray-700 to-gray-800 rounded-xl p-6 border border-gray-600 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-2">{t('Active Products')}</h3>
                <p className="text-4xl font-bold text-white">{summary.active_subscriptions}</p>
              </div>
              <div className="w-14 h-14 bg-gray-600 bg-opacity-50 rounded-full flex items-center justify-center">
                <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Subscribed Products Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white">{t('Subscribed Products')}</h3>
            
            {summary.subscribed_products.length > 0 ? (
              <div className="space-y-3">
                {summary.subscribed_products.map((product, index) => (
                  <div 
                    key={index} 
                    className="bg-gray-700 rounded-xl p-5 border border-gray-600 hover:border-gray-500 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="text-lg font-semibold text-white mb-1">{product.product_name}</p>
                        <p className="text-sm text-gray-400">{t('Code:')} {product.product_code}</p>
                      </div>
                      <p className="text-xl font-bold text-white">${product.price_unit.toFixed(2)}</p>
                    </div>
                    <div className="pt-3 border-t border-gray-600">
                      <p className="text-sm text-gray-400">
                        {t('Next Payment:')} {new Date(product.next_payment_date).toLocaleDateString(undefined, {
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric' 
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-700 rounded-xl p-6 border border-gray-600 text-center">
                <p className="text-gray-400">{t('No subscribed products.')}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-400">{t('No dashboard data available.')}</p>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
