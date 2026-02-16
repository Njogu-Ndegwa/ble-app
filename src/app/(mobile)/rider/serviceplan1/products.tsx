import React from 'react';
import { Package, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useI18n } from '@/i18n';

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
  currentPage?: number;
  totalPages?: number;
  totalCount?: number;
  pageSize?: number;
  isLoading?: boolean;
  onPageChange?: (page: number) => void;
}

const Products: React.FC<ProductsProps> = ({ 
  allPlans, 
  onSelectPlan,
  currentPage = 1,
  totalPages = 1,
  totalCount = 0,
  pageSize = 20,
  isLoading = false,
  onPageChange
}) => {
  const { t } = useI18n();
  const renderPlanCard = (plan: ServicePlan) => (
    <div
      key={`${plan.productId}-${plan.default_code}`}
      className="bg-bg-tertiary rounded-xl p-4 border border-border cursor-pointer hover:bg-bg-elevated transition-colors duration-200"
      onClick={() => onSelectPlan(plan)}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          <Package className="w-5 h-5 text-text-secondary" />
          <div>
            <h3 className="text-sm font-semibold text-text-primary">{plan.name}</h3>
            {/* <p className="text-xs text-text-secondary">Subscription</p> */}
            <p className="text-xs text-text-muted">{t('Code:')} {plan.default_code}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-text-primary">${plan.price}</p>
        </div>
      </div>

      <div
        className="w-full py-2 px-3 rounded-lg text-center font-semibold text-xs transition-colors duration-200 bg-bg-elevated text-text-primary border border-border hover:bg-bg-tertiary"
      >
        {t('Select Product')}
      </div>
    </div>
  );

  const startItem = totalCount > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endItem = Math.min(currentPage * pageSize, totalCount);

  const renderPaginationControls = () => {
    if (!onPageChange || totalPages <= 1) {
      return null;
    }

    return (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-bg-secondary/80 border border-border/60 rounded-xl px-4 py-3 shadow-inner">
        <div className="text-sm text-text-primary">
          {totalCount > 0 ? (
            <>
              {t('Showing')}{' '}
              <span className="text-text-primary font-semibold">
                {startItem}-{endItem}
              </span>{' '}
              {t('of')}{' '}
              <span className="text-text-primary font-semibold">{totalCount}</span>
            </>
          ) : (
            t('No products available')
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1 || isLoading}
            className="flex items-center gap-2 px-3 py-2 bg-bg-tertiary/80 hover:bg-bg-elevated/80 disabled:opacity-50 disabled:cursor-not-allowed text-text-primary rounded-lg transition-colors text-sm"
          >
            <ChevronLeft size={16} />
            <span className="hidden sm:inline">{t('Previous')}</span>
          </button>

          <div className="flex flex-col text-center text-xs text-text-secondary">
            <span className="uppercase tracking-wide text-[10px] text-text-muted">
              {t('Page')}
            </span>
            <span className="text-text-primary text-sm font-semibold">
              {currentPage} <span className="text-text-secondary">{t('of')} {totalPages}</span>
            </span>
          </div>

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages || isLoading}
            className="flex items-center gap-2 px-3 py-2 bg-bg-tertiary/80 hover:bg-bg-elevated/80 disabled:opacity-50 disabled:cursor-not-allowed text-text-primary rounded-lg transition-colors text-sm"
          >
            <span className="hidden sm:inline">{t('Next')}</span>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 p-4">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-text-secondary" />
            <h2 className="text-lg font-semibold text-text-primary">{t('Products')}</h2>
          </div>
          {renderPaginationControls()}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            <span className="ml-3 text-text-secondary">{t('Loading products...')}</span>
          </div>
        ) : (
          <div className="space-y-4">
            {allPlans.length > 0 ? (
              allPlans.map((plan) => renderPlanCard(plan))
            ) : (
              <div className="text-center py-8">
                <p className="text-text-secondary">{t('No products available')}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Pagination Controls */}
      {totalPages > 1 && onPageChange && (
        <div className="pt-3">
          {renderPaginationControls()}
        </div>
      )}
    </div>
  );
};

export default Products;