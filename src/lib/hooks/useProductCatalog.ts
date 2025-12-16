/**
 * useProductCatalog Hook
 * 
 * Manages fetching and selection of products, packages, and subscription plans
 * from the Odoo API. Provides:
 * - Automatic fetching on mount
 * - Loading and error states for each category
 * - Selection state with default selection
 * - Retry functionality
 * 
 * Used by the Sales workflow for customer registration.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import {
  getSubscriptionProducts,
  type SubscriptionProduct,
} from '@/lib/odoo-api';
import { getEmployeeToken, getSalesRoleToken, getAttendantRoleToken } from '@/lib/attendant-auth';

// ============================================
// Types
// ============================================

/**
 * Physical product data (bikes, tuks, etc.) from main_service category
 */
export interface ProductData {
  id: string;
  odooProductId: number;
  name: string;
  description: string;
  price: number;
  currency: string;
  currencySymbol: string;
  imageUrl: string | null;
  categoryName: string;
  defaultCode: string;
}

/**
 * Package component - individual items within a package
 */
export interface PackageComponent {
  id: number;
  name: string;
  default_code: string;
  description: string;
  list_price: number;
  price_unit: number;
  quantity: number;
  currency_id: number;
  currency_name: string;
  currencySymbol: string;
  category_id: number;
  category_name: string;
  image_url: string | null;
  is_main_service: boolean;
  is_battery_swap: boolean;
}

/**
 * Package data - combines product + privilege into a bundle
 */
export interface PackageData {
  id: string;
  odooPackageId: number;
  name: string;
  description: string;
  price: number;
  currency: string;
  currencySymbol: string;
  imageUrl: string | null;
  defaultCode: string;
  isPackage: boolean;
  componentCount: number;
  components: PackageComponent[];
  mainProduct?: PackageComponent;
  batterySwapPrivilege?: PackageComponent;
}

/**
 * Subscription plan data
 */
export interface PlanData {
  id: string;
  odooProductId: number;
  name: string;
  description: string;
  price: number;
  period: string;
  currency: string;
  currencySymbol: string;
}

/**
 * Loading state for each category
 */
export interface CatalogLoadingState {
  products: boolean;
  packages: boolean;
  plans: boolean;
}

/**
 * Error state for each category
 */
export interface CatalogErrorState {
  products: string | null;
  packages: string | null;
  plans: string | null;
}

/**
 * Configuration for the hook
 */
export interface UseProductCatalogConfig {
  /** Whether to fetch automatically on mount (default: true) */
  autoFetch?: boolean;
  /** Initial selected product ID (for session restore) */
  initialProductId?: string;
  /** Initial selected package ID (for session restore) */
  initialPackageId?: string;
  /** Initial selected plan ID (for session restore) */
  initialPlanId?: string;
  /** 
   * Workflow type - determines which auth token to use.
   * 'sales' uses getSalesRoleToken(), 'attendant' uses getAttendantRoleToken(),
   * undefined (default) uses getEmployeeToken() for backward compatibility.
   */
  workflowType?: 'sales' | 'attendant';
}

/**
 * Return type for the hook
 */
export interface UseProductCatalogReturn {
  // Data
  products: ProductData[];
  packages: PackageData[];
  plans: PlanData[];
  
  // Loading states
  isLoading: CatalogLoadingState;
  isAnyLoading: boolean;
  
  // Error states
  errors: CatalogErrorState;
  hasAnyError: boolean;
  
  // Selection
  selectedProductId: string;
  selectedPackageId: string;
  selectedPlanId: string;
  selectedProduct: ProductData | null;
  selectedPackage: PackageData | null;
  selectedPlan: PlanData | null;
  
  // Actions
  setSelectedProductId: (id: string) => void;
  setSelectedPackageId: (id: string) => void;
  setSelectedPlanId: (id: string) => void;
  refetch: () => Promise<void>;
  
  // For session restore
  restoreSelections: (productId?: string, packageId?: string, planId?: string) => void;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Transform API product to ProductData
 */
function transformProduct(product: SubscriptionProduct): ProductData {
  return {
    id: product.id.toString(),
    odooProductId: product.id,
    name: product.name,
    description: product.description || '',
    price: product.list_price,
    currency: product.currency_name,
    currencySymbol: product.currencySymbol,
    imageUrl: product.image_url || null,
    categoryName: product.category_name || '',
    defaultCode: product.default_code || '',
  };
}

/**
 * Transform API package to PackageData
 */
function transformPackage(pkg: any): PackageData {
  const mainProduct = pkg.components?.find((c: any) => c.is_main_service);
  const batterySwapPrivilege = pkg.components?.find((c: any) => c.is_battery_swap);

  const transformComponent = (c: any): PackageComponent => ({
    id: c.id,
    name: c.name,
    default_code: c.default_code || '',
    description: c.description || '',
    list_price: c.list_price,
    price_unit: c.price_unit,
    quantity: c.quantity,
    currency_id: c.currency_id,
    currency_name: c.currency_name,
    currencySymbol: c.currencySymbol,
    category_id: c.category_id,
    category_name: c.category_name,
    image_url: c.image_url,
    is_main_service: c.is_main_service || false,
    is_battery_swap: c.is_battery_swap || false,
  });

  return {
    id: pkg.id.toString(),
    odooPackageId: pkg.id,
    name: pkg.name,
    description: pkg.description || '',
    price: pkg.list_price,
    currency: pkg.currency_name,
    currencySymbol: pkg.currencySymbol,
    imageUrl: pkg.image_url || mainProduct?.image_url || null,
    defaultCode: pkg.default_code || '',
    isPackage: true,
    componentCount: pkg.component_count || pkg.components?.length || 0,
    components: (pkg.components || []).map(transformComponent),
    mainProduct: mainProduct ? transformComponent(mainProduct) : undefined,
    batterySwapPrivilege: batterySwapPrivilege ? transformComponent(batterySwapPrivilege) : undefined,
  };
}

/**
 * Transform API plan to PlanData
 */
function transformPlan(product: SubscriptionProduct): PlanData {
  return {
    id: product.id.toString(),
    odooProductId: product.id,
    name: product.name,
    description: product.description || '',
    price: product.list_price,
    period: '', // Will be determined from name by UI
    currency: product.currency_name,
    currencySymbol: product.currencySymbol,
  };
}

// ============================================
// Hook Implementation
// ============================================

export function useProductCatalog(
  config: UseProductCatalogConfig = {}
): UseProductCatalogReturn {
  const {
    autoFetch = true,
    initialProductId = '',
    initialPackageId = '',
    initialPlanId = '',
    workflowType,
  } = config;

  // Log hook initialization
  console.log('[PRODUCT CATALOG] Hook initialized with config:', { autoFetch, workflowType, initialPackageId, initialPlanId });

  // Data state
  const [products, setProducts] = useState<ProductData[]>([]);
  const [packages, setPackages] = useState<PackageData[]>([]);
  const [plans, setPlans] = useState<PlanData[]>([]);

  // Loading state
  const [isLoading, setIsLoading] = useState<CatalogLoadingState>({
    products: true,
    packages: true,
    plans: true,
  });

  // Error state
  const [errors, setErrors] = useState<CatalogErrorState>({
    products: null,
    packages: null,
    plans: null,
  });

  // Selection state
  const [selectedProductId, setSelectedProductId] = useState<string>(initialProductId);
  const [selectedPackageId, setSelectedPackageId] = useState<string>(initialPackageId);
  const [selectedPlanId, setSelectedPlanId] = useState<string>(initialPlanId);

  // Computed values
  const isAnyLoading = isLoading.products || isLoading.packages || isLoading.plans;
  const hasAnyError = !!(errors.products || errors.packages || errors.plans);

  const selectedProduct = products.find(p => p.id === selectedProductId) || null;
  const selectedPackage = packages.find(p => p.id === selectedPackageId) || null;
  const selectedPlan = plans.find(p => p.id === selectedPlanId) || null;

  // Fetch all catalog data
  const refetch = useCallback(async () => {
    console.log('[PRODUCT CATALOG] ====== REFETCH STARTED ======');
    console.log('[PRODUCT CATALOG] workflowType:', workflowType);
    setIsLoading({ products: true, packages: true, plans: true });
    setErrors({ products: null, packages: null, plans: null });

    try {
      // Get the appropriate auth token based on workflow type
      // This ensures we use the correct role-specific token after session management separation
      let authToken: string | null = null;
      
      if (workflowType === 'sales') {
        // Sales workflow: use sales role token directly
        authToken = getSalesRoleToken();
        if (!authToken) {
          console.log('[PRODUCT CATALOG] WARNING: No sales role token - this may cause empty package list');
          // Set a warning error but continue - backend might still return some products
        } else {
          console.log('[PRODUCT CATALOG] Using sales role token for fetch');
        }
      } else if (workflowType === 'attendant') {
        // Attendant workflow: use attendant role token directly
        authToken = getAttendantRoleToken();
        if (!authToken) {
          console.warn('[PRODUCT CATALOG] No attendant role token - products may not be filtered by company');
        }
      } else {
        // Fallback to legacy getEmployeeToken for backward compatibility
        authToken = getEmployeeToken();
        if (!authToken) {
          console.warn('[PRODUCT CATALOG] No employee token - products may not be filtered by company');
        }
      }

      console.log('[PRODUCT CATALOG] Calling getSubscriptionProducts API...');
      const response = await getSubscriptionProducts(1, 50, authToken || undefined);
      console.log('[PRODUCT CATALOG] API Response:', {
        success: response.success,
        hasData: !!response.data,
        productCount: response.data?.products?.length ?? 0,
        mainServiceCount: response.data?.mainServiceProducts?.length ?? 0,
        batterySwapCount: response.data?.batterySwapProducts?.length ?? 0,
        packageCount: response.data?.packageProducts?.length ?? 0,
      });

      if (response.success && response.data) {
        // Process products
        if (response.data.mainServiceProducts?.length > 0) {
          const transformedProducts = response.data.mainServiceProducts.map(transformProduct);
          setProducts(transformedProducts);
          setErrors(prev => ({ ...prev, products: null }));
          
          // Set default selection if not already set
          if (transformedProducts.length > 0) {
            setSelectedProductId(prev => prev || transformedProducts[0].id);
          }
        } else {
          setProducts([]);
          setErrors(prev => ({ ...prev, products: 'No physical products available' }));
        }

        // Process packages - with detailed logging for debugging
        if (response.data.packageProducts?.length > 0) {
          console.log('[PRODUCT CATALOG] Raw packages from API:', response.data.packageProducts.length);
          
          // Log each package's eligibility for debugging
          const packageDebug = response.data.packageProducts.map((pkg: any) => ({
            id: pkg.id,
            name: pkg.name,
            is_package: pkg.is_package,
            has_components: !!pkg.components?.length,
            component_count: pkg.components?.length || 0,
          }));
          console.log('[PRODUCT CATALOG] Package eligibility check:', packageDebug);
          
          const validPackages = response.data.packageProducts
            .filter((pkg: any) => pkg.is_package && pkg.components?.length > 0);
          
          console.log('[PRODUCT CATALOG] Valid packages after filtering:', validPackages.length);
          
          if (validPackages.length > 0) {
            const transformedPackages = validPackages.map(transformPackage);
            setPackages(transformedPackages);
            setErrors(prev => ({ ...prev, packages: null }));
            
            // Set default selection if not already set
            if (transformedPackages.length > 0) {
              setSelectedPackageId(prev => prev || transformedPackages[0].id);
            }
          } else {
            // Packages exist but none are valid - this is a data issue
            console.warn('[PRODUCT CATALOG] No valid packages found after filtering. Raw packages:', 
              response.data.packageProducts.map((p: any) => ({ id: p.id, name: p.name, is_package: p.is_package, components: p.components?.length || 0 }))
            );
            setPackages([]);
            setErrors(prev => ({ 
              ...prev, 
              packages: `${response.data.packageProducts?.length || 0} packages found but none are configured correctly (missing components). Please contact support.` 
            }));
          }
        } else {
          console.warn('[PRODUCT CATALOG] No packages returned from API');
          setPackages([]);
          setErrors(prev => ({ ...prev, packages: 'No packages available from server. Please try again or contact support.' }));
        }

        // Process plans
        if (response.data.products?.length > 0) {
          const transformedPlans = response.data.products.map(transformPlan);
          setPlans(transformedPlans);
          setErrors(prev => ({ ...prev, plans: null }));
          
          // Set default selection if not already set
          if (transformedPlans.length > 0) {
            setSelectedPlanId(prev => prev || transformedPlans[0].id);
          }
        } else {
          setPlans([]);
          setErrors(prev => ({ ...prev, plans: 'No subscription plans available' }));
        }
      } else {
        // API returned failure
        console.error('[PRODUCT CATALOG] API returned failure:', response);
        const errorMsg = 'Failed to load data from server. Please check your connection and try again.';
        setProducts([]);
        setPackages([]);
        setPlans([]);
        setErrors({
          products: errorMsg,
          packages: errorMsg,
          plans: errorMsg,
        });
        toast.error('Could not load products from server');
      }
    } catch (error: any) {
      console.error('[PRODUCT CATALOG] Fetch failed:', error);
      console.error('[PRODUCT CATALOG] Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
      const errorMsg = error.message || 'Failed to load data from server';
      setProducts([]);
      setPackages([]);
      setPlans([]);
      setErrors({
        products: errorMsg,
        packages: errorMsg,
        plans: errorMsg,
      });
      toast.error(`Could not load products: ${error.message || 'Network error'}`);
    } finally {
      console.log('[PRODUCT CATALOG] ====== REFETCH COMPLETE ======');
      setIsLoading({ products: false, packages: false, plans: false });
    }
  }, [workflowType]);

  // Restore selections (for session restore)
  const restoreSelections = useCallback((
    productId?: string,
    packageId?: string,
    planId?: string
  ) => {
    if (productId) setSelectedProductId(productId);
    if (packageId) setSelectedPackageId(packageId);
    if (planId) setSelectedPlanId(planId);
  }, []);

  // Auto-fetch on mount
  useEffect(() => {
    try {
      console.log('[PRODUCT CATALOG] useEffect triggered - autoFetch:', autoFetch, 'workflowType:', workflowType);
      if (autoFetch) {
        console.log('[PRODUCT CATALOG] Calling refetch() from useEffect...');
        refetch().catch((err) => {
          console.error('[PRODUCT CATALOG] refetch() promise rejected:', err);
        });
      } else {
        console.log('[PRODUCT CATALOG] autoFetch is false, skipping fetch');
      }
    } catch (err) {
      console.error('[PRODUCT CATALOG] useEffect error:', err);
    }
  }, [autoFetch, refetch, workflowType]);

  // DEBUG: Track loading state changes to show toast when fetch completes
  const prevLoadingRef = useRef(isLoading.packages);
  useEffect(() => {
    const wasLoading = prevLoadingRef.current;
    const isNowLoading = isLoading.packages;
    
    // Detect transition from loading -> not loading
    if (wasLoading && !isNowLoading) {
      console.log('[PRODUCT CATALOG] FETCH COMPLETED. Packages:', packages.length, 'Error:', errors.packages);
      if (packages.length > 0) {
        toast.success(`Loaded ${packages.length} packages`, { duration: 2000 });
      } else if (errors.packages) {
        toast.error(`Package load failed: ${errors.packages}`, { duration: 5000 });
      } else {
        toast(`No packages available`, { duration: 3000 });
      }
    }
    
    prevLoadingRef.current = isNowLoading;
  }, [isLoading.packages, packages.length, errors.packages]);

  return {
    // Data
    products,
    packages,
    plans,
    
    // Loading
    isLoading,
    isAnyLoading,
    
    // Errors
    errors,
    hasAnyError,
    
    // Selection
    selectedProductId,
    selectedPackageId,
    selectedPlanId,
    selectedProduct,
    selectedPackage,
    selectedPlan,
    
    // Actions
    setSelectedProductId,
    setSelectedPackageId,
    setSelectedPlanId,
    refetch,
    restoreSelections,
  };
}

export default useProductCatalog;
