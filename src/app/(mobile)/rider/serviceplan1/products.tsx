import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { Crown, Calendar } from 'lucide-react';

interface ServicePlan {
  name: string;
  duration: string;
  price: number;
  productId: string;
}

interface ProductsProps {
  allPlans: ServicePlan[];
  subscribedPlans: ServicePlan[];
  onSelectPlan: (plan: ServicePlan) => void;
}

const Products: React.FC<ProductsProps> = ({ allPlans, subscribedPlans, onSelectPlan }) => {
  const [activeTab, setActiveTab] = useState<"subscribed" | "all">("subscribed");

  const renderPlanCard = (plan: ServicePlan, isSubscribed: boolean = false) => (
    <div
      key={plan.name}
      className="bg-gray-700 rounded-xl p-4 border border-gray-600 cursor-pointer hover:bg-gray-600 transition-colors duration-200"
      onClick={() => {
        onSelectPlan(plan);
        toast.success(`Selected ${plan.name} (${plan.duration})`);
      }}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-gray-400" />
          <div>
            <h3 className="text-sm font-semibold text-white">{plan.name}</h3>
            <p className="text-xs text-gray-400">
              {isSubscribed ? "Active plan" : `${plan.duration} access`}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-white">${plan.price}</p>
        </div>
      </div>

      <div
        className={`w-full py-2 px-3 rounded-lg text-center font-semibold text-xs transition-colors duration-200 ${
          isSubscribed
            ? "bg-gray-600 text-gray-300 border border-gray-500"
            : "bg-gray-600 text-white border border-gray-500 hover:bg-gray-500"
        }`}
      >
        {isSubscribed ? "Currently Active" : "Select Plan"}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 p-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white mb-2">Products</h1>
        <p className="text-gray-400">Manage your subscriptions and explore new products</p>
      </div>

      <div className="flex bg-gray-700 rounded-xl p-1 mb-6 max-w-sm mx-auto">
        <button
          onClick={() => setActiveTab("subscribed")}
          className={`flex-1 py-2 px-3 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
            activeTab === "subscribed"
              ? "bg-gray-600 text-white"
              : "text-gray-300 hover:text-white"
          }`}
        >
          <Crown className="w-4 h-4" />
          Subscribed
        </button>
        <button
          onClick={() => setActiveTab("all")}
          className={`flex-1 py-2 px-3 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
            activeTab === "all"
              ? "bg-gray-600 text-white"
              : "text-gray-300 hover:text-white"
          }`}
        >
          <Calendar className="w-4 h-4" />
          All Products
        </button>
      </div>

      <div className="space-y-4">
        {activeTab === "subscribed" ? (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Crown className="w-5 h-5 text-gray-400" />
              <h2 className="text-lg font-semibold text-white">Active Subscriptions</h2>
            </div>
            <div className="space-y-4">
              {subscribedPlans.length > 0 ? (
                subscribedPlans.map((plan) => renderPlanCard(plan, true))
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-400">No active subscriptions</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-gray-400" />
              <h2 className="text-lg font-semibold text-white">All Products</h2>
            </div>
            <div className="space-y-4">
              {allPlans.length > 0 ? (
                allPlans.map((plan) => renderPlanCard(plan, false))
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-400">No products available</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Products;