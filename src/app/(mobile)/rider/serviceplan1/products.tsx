import React from 'react';
import { Package } from 'lucide-react';

interface ServicePlan {
  name: string;
  price: number;
  productId: number;
  default_code: string;
  suggested_billing_frequency?: string;
}

interface ProductsProps {
  allPlans: ServicePlan[];
  onSelectPlan: (plan: ServicePlan) => void;
}

const Products: React.FC<ProductsProps> = ({ allPlans, onSelectPlan }) => {
  const renderPlanCard = (plan: ServicePlan) => (
    <div
      key={`${plan.productId}-${plan.default_code}`}
      className="bg-gray-700 rounded-xl p-4 border border-gray-600 cursor-pointer hover:bg-gray-600 transition-colors duration-200"
      onClick={() => onSelectPlan(plan)}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          <Package className="w-5 h-5 text-gray-400" />
          <div>
            <h3 className="text-sm font-semibold text-white">{plan.name}</h3>
            {/* <p className="text-xs text-gray-400">Subscription</p> */}
            <p className="text-xs text-gray-500">Code: {plan.default_code}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-white">${plan.price}</p>
        </div>
      </div>

      <div
        className="w-full py-2 px-3 rounded-lg text-center font-semibold text-xs transition-colors duration-200 bg-gray-600 text-white border border-gray-500 hover:bg-gray-500"
      >
        Select Product
      </div>
    </div>
  );

  return (
    <div className="space-y-6 p-4">
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-5 h-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-white">Products</h2>
        </div>
        <div className="space-y-4">
          {allPlans.length > 0 ? (
            allPlans.map((plan) => renderPlanCard(plan))
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-400">No products available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Products;