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
  id: number;
  subscription_code: string;
  name: string;
  status: string;
  next_cycle_date: string;
  price_at_signup: number;
  product_id: [number, string];
  currency_symbol?: string;
}

interface DashboardSummary {
  active_subscriptions: number;
  subscribed_products: SubscribedProduct[];
  total_invoiced: number;
  total_outstanding: number;
  total_paid: number;
  total_orders: number;
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
          // Get token from localStorage
          const token = localStorage.getItem("authToken_rider");
          
          const headers: HeadersInit = {
            "Content-Type": "application/json",
            "X-API-KEY": "abs_connector_secret_key_2024",
          };

          // Add Bearer token if available
          if (token) {
            headers["Authorization"] = `Bearer ${token}`;
          }

          const response = await fetch(
            `https://crm-omnivoltaic.odoo.com/api/customer/dashboard`,
            {
              method: "GET",
              headers,
            }
          );

          const data = await response.json();
          console.log("Dashboard API Response:", { status: response.status, data });

          if (response.status === 200 && data.success && data.summary) {
            setSummary({
              active_subscriptions: data.summary.active_subscriptions || 0,
              total_invoiced: data.summary.total_invoiced || 0,
              total_outstanding: data.summary.total_outstanding || 0,
              total_paid: data.summary.total_paid || 0,
              total_orders: data.summary.total_orders || 0,
              subscribed_products: (data.active_subscriptions || []).map((subscription: any) => ({
                id: subscription.id,
                subscription_code: subscription.subscription_code || '',
                name: subscription.name || '',
                status: subscription.status || '',
                next_cycle_date: subscription.next_cycle_date || '',
                price_at_signup: subscription.price_at_signup || 0,
                product_id: subscription.product_id || [0, ''],
                currency_symbol: subscription.currency_symbol || subscription.currency || '$',
              })),
            });
          } else {
            throw new Error(data.message || "Failed to fetch dashboard data.");
          }
        } catch (error: any) {
          console.error("Dashboard fetch error:", error);
          toast.error(error.message || "Failed to load dashboard data.");
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
        <p className="text-text-secondary">{t('Welcome back,')} {customer?.name}</p>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <div className="inline-block w-8 h-8 border-4 border-border border-t-text-secondary rounded-full animate-spin mb-3"></div>
          <p className="text-text-secondary">{t('Loading dashboard data...')}</p>
        </div>
      ) : summary ? (
        <div className="space-y-6">
          {/* Active Subscriptions Card */}
          <div className="bg-gradient-page rounded-xl p-6 border border-border shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-text-secondary mb-2">{t('Active Products')}</h3>
                <p className="text-4xl font-bold text-text-primary">{summary.active_subscriptions}</p>
              </div>
              <div className="w-14 h-14 bg-bg-elevated bg-opacity-50 rounded-full flex items-center justify-center">
                <svg className="w-7 h-7 text-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Subscribed Products Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-text-primary">{t('Subscribed Products')}</h3>
            
            {summary.subscribed_products.length > 0 ? (
              <div className="space-y-3">
                {summary.subscribed_products.map((product, index) => (
                  <div 
                    key={index} 
                    className="bg-bg-tertiary rounded-xl p-5 border border-border hover:border-border transition-colors"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="text-lg font-semibold text-text-primary mb-1">{product.name}</p>
                        <p className="text-sm text-text-secondary">{t('Code:')} {product.subscription_code}</p>
                        <p className="text-xs text-text-muted mt-1">{t('Status:')} {product.status}</p>
                      </div>
                      <p className="text-xl font-bold text-text-primary">
                        {(product.price_at_signup || 0).toFixed(2)}
                      </p>
                    </div>
                    {product.next_cycle_date && (
                      <div className="pt-3 border-t border-border">
                        <p className="text-sm text-text-secondary">
                          {t('Next Cycle:')} {new Date(product.next_cycle_date).toLocaleDateString('en-US', {
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-bg-tertiary rounded-xl p-6 border border-border text-center">
                <p className="text-text-secondary">{t('No subscribed products.')}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-text-secondary">{t('No dashboard data available.')}</p>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
