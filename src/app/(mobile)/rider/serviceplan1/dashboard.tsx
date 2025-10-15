import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
}

interface DashboardSummary {
  total_paid: number;
  total_pending: number;
  active_subscriptions: number; // Updated to match API response
  pending_invoices_count: number; // Updated to match API response
  next_payment_due: string | null;
  next_payment_amount: number;
  has_overdue: boolean;
}

interface DashboardProps {
  customer: Customer | null;
}

const Dashboard: React.FC<DashboardProps> = ({ customer }) => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (customer?.id) {
      const fetchDashboardData = async () => {
        setIsLoading(true);
        try {
          const response = await fetch(
            `https://evans-musamia-odoorestapi-staging-24591738.dev.odoo.com/api/customers/${customer.id}/dashboard`,
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
            // Map the API response to the DashboardSummary interface
            setSummary({
              total_paid: data.summary.total_paid,
              total_pending: data.summary.total_pending,
              active_subscriptions: data.summary.active_subscriptions, // Correct field
              pending_invoices_count: data.summary.pending_invoices_count, // Correct field
              next_payment_due: data.next_payment?.next_due_date || null,
              next_payment_amount: data.next_payment?.amount_due || 0,
              has_overdue: data.next_payment?.is_overdue || false,
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
      <div className="text-center">
        {/* <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1> */}
        <p className="text-gray-400">Welcome back, {customer?.name}</p>
      </div>

      {isLoading ? (
        <div className="text-center">
          <p className="text-white">Loading dashboard data...</p>
        </div>
      ) : summary ? (
        <div className="space-y-4">
          {/* Row 1: Active Plans and Total Spent */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-700 rounded-xl p-4 border border-gray-600">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-white">My Products</h3>
              </div>
              <p className="text-xl font-bold text-white">{summary.active_subscriptions}</p>
              <p className="text-xs text-gray-400">Active products</p>
            </div>

            <div className="bg-gray-700 rounded-xl p-4 border border-gray-600">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-white">Total Spent</h3>
              </div>
              <p className="text-xl font-bold text-white">{summary.total_paid}</p>
              <p className="text-xs text-gray-400">This month</p>
            </div>
          </div>

          {/* Row 2: Total Pending and Pending Invoices */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-700 rounded-xl p-4 border border-gray-600">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-white">Amount Due</h3>
              </div>
              <p className="text-xl font-bold text-white">{summary.total_pending}</p>
              <p className="text-xs text-gray-400">Pending payments</p>
            </div>

            <div className="bg-gray-700 rounded-xl p-4 border border-gray-600">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-white">Pending Invoices</h3>
              </div>
              <p className="text-xl font-bold text-white">{summary.pending_invoices_count}</p>
              <p className="text-xs text-gray-400">Open invoices</p>
            </div>
          </div>

          {/* Row 3: Next Payment Due (full width) */}
          <div className="grid grid-cols-1">
            <div className="bg-gray-700 rounded-xl p-4 border border-gray-600">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-white">Next Payment Due</h3>
              </div>
              <p className="text-xl font-bold text-white">
                {summary.next_payment_due ? new Date(summary.next_payment_due).toLocaleDateString() : 'None'}
              </p>
              <p className="text-xs text-gray-400">Due date</p>
            </div>
          </div>

          {/* Row 4: Overdue Status (full width) */}
          <div className="grid grid-cols-1">
            <div className="bg-gray-700 rounded-xl p-4 border border-gray-600">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-white">Status</h3>
              </div>
              <p className={`text-xl font-bold ${summary.has_overdue ? 'text-red-400' : 'text-green-400'}`}>
                {summary.has_overdue ? 'Overdue' : 'No Overdue'}
              </p>
              <p className="text-xs text-gray-400">Payment status</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-gray-400">No dashboard data available.</p>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

