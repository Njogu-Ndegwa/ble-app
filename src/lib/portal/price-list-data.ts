export type PriceListRuleTarget = 'all_products' | 'product' | 'category';
export type PriceListComputeMethod = 'fixed' | 'discount' | 'formula';

export interface PriceListRule {
  id: string;
  appliesTo: PriceListRuleTarget;
  productId?: number;
  productName?: string;
  categoryName?: string;
  computeMethod: PriceListComputeMethod;
  fixedPrice?: number;
  discountPercent?: number;
  minQuantity: number;
}

export interface PriceList {
  id: string;
  odooId: number | null;
  name: string;
  description: string;
  currency: string;
  isDefault: boolean;
  rules: PriceListRule[];
}

export const DEMO_PRICE_LISTS: PriceList[] = [
  {
    id: 'pl-default',
    odooId: null,
    name: 'Standard Pricing',
    description: 'Default catalog prices with no adjustments',
    currency: 'USD',
    isDefault: true,
    rules: [],
  },
  {
    id: 'pl-wholesale',
    odooId: null,
    name: 'Wholesale',
    description: '15% off all products for bulk buyers',
    currency: 'USD',
    isDefault: false,
    rules: [
      {
        id: 'wr-1',
        appliesTo: 'all_products',
        computeMethod: 'discount',
        discountPercent: 15,
        minQuantity: 1,
      },
    ],
  },
  {
    id: 'pl-partner',
    odooId: null,
    name: 'Channel Partner',
    description: '20% discount on physical products, 10% on services',
    currency: 'USD',
    isDefault: false,
    rules: [
      {
        id: 'pr-1',
        appliesTo: 'category',
        categoryName: 'physical',
        computeMethod: 'discount',
        discountPercent: 20,
        minQuantity: 1,
      },
      {
        id: 'pr-2',
        appliesTo: 'category',
        categoryName: 'service',
        computeMethod: 'discount',
        discountPercent: 10,
        minQuantity: 1,
      },
    ],
  },
  {
    id: 'pl-promo-q2',
    odooId: null,
    name: 'Q2 2026 Promo',
    description: 'Seasonal promotion — flat 25% off all products',
    currency: 'USD',
    isDefault: false,
    rules: [
      {
        id: 'qr-1',
        appliesTo: 'all_products',
        computeMethod: 'discount',
        discountPercent: 25,
        minQuantity: 1,
      },
    ],
  },
  {
    id: 'pl-vip',
    odooId: null,
    name: 'VIP Customer',
    description: '30% off all products, extra 5% for orders of 5+ units',
    currency: 'USD',
    isDefault: false,
    rules: [
      {
        id: 'vr-1',
        appliesTo: 'all_products',
        computeMethod: 'discount',
        discountPercent: 30,
        minQuantity: 1,
      },
      {
        id: 'vr-2',
        appliesTo: 'all_products',
        computeMethod: 'discount',
        discountPercent: 35,
        minQuantity: 5,
      },
    ],
  },
];

/**
 * Maps a raw Odoo pricelist object to the app-level PriceList shape.
 * Rules are left empty intentionally — the backend rule data is not
 * reliable yet, so price resolution falls back to base `list_price`.
 */
export function mapOdooPriceList(
  raw: { id: number; name: string; currency_id?: number; currency?: string; active?: boolean; [key: string]: unknown },
  index: number,
): PriceList {
  return {
    id: `odoo-pl-${raw.id}`,
    odooId: raw.id,
    name: raw.name ?? `Price List ${raw.id}`,
    description: '',
    currency: raw.currency ?? 'USD',
    isDefault: index === 0,
    rules: [],
  };
}

/**
 * Resolves the effective unit price for a product under a given price list.
 * Picks the most specific matching rule (product > category > all_products)
 * that satisfies the minimum quantity requirement.
 */
export function resolvePrice(
  priceList: PriceList,
  product: { id: number; list_price: number; pu_category?: string | false; category_name?: string },
  quantity: number,
): { unitPrice: number; discountPercent: number; ruleApplied: string | null } {
  const basePrice = product.list_price;

  if (priceList.rules.length === 0) {
    return { unitPrice: basePrice, discountPercent: 0, ruleApplied: null };
  }

  const eligible = priceList.rules.filter((r) => r.minQuantity <= quantity);
  if (eligible.length === 0) {
    return { unitPrice: basePrice, discountPercent: 0, ruleApplied: null };
  }

  const productCategory = product.pu_category || product.category_name || '';

  const scored = eligible
    .map((rule) => {
      let specificity = 0;
      let matches = false;

      if (rule.appliesTo === 'product' && rule.productId === product.id) {
        specificity = 3;
        matches = true;
      } else if (
        rule.appliesTo === 'category' &&
        rule.categoryName &&
        productCategory &&
        rule.categoryName.toLowerCase() === String(productCategory).toLowerCase()
      ) {
        specificity = 2;
        matches = true;
      } else if (rule.appliesTo === 'all_products') {
        specificity = 1;
        matches = true;
      }

      return { rule, specificity, matches };
    })
    .filter((s) => s.matches)
    .sort((a, b) => {
      if (b.specificity !== a.specificity) return b.specificity - a.specificity;
      return b.rule.minQuantity - a.rule.minQuantity;
    });

  if (scored.length === 0) {
    return { unitPrice: basePrice, discountPercent: 0, ruleApplied: null };
  }

  const best = scored[0].rule;

  if (best.computeMethod === 'fixed' && best.fixedPrice != null) {
    const discount = basePrice > 0 ? ((basePrice - best.fixedPrice) / basePrice) * 100 : 0;
    return {
      unitPrice: best.fixedPrice,
      discountPercent: Math.max(0, Math.round(discount * 100) / 100),
      ruleApplied: best.id,
    };
  }

  if (best.computeMethod === 'discount' && best.discountPercent != null) {
    const unitPrice = Math.round(basePrice * (1 - best.discountPercent / 100) * 100) / 100;
    return {
      unitPrice,
      discountPercent: best.discountPercent,
      ruleApplied: best.id,
    };
  }

  return { unitPrice: basePrice, discountPercent: 0, ruleApplied: null };
}
