/**
 * Shared package → service-plan filter.
 *
 * Sales and Activator step 3 narrow the plan picker to the services that
 * apply to the selected package (S6/M3, E-3H, CET3-B, PET-3-SRS, etc.).
 * The Rider top-up flow uses the same mapping to show only the energy
 * plans that match the rider's current package.
 *
 * Matches are case-insensitive substrings. Filter keys come from the
 * canonical `templateId` (`x_template_id` in Odoo); `name` is a fallback
 * because old products may not have a template id populated. The display
 * `name` drifts on whitespace/punctuation across backend updates, the
 * template id does not.
 *
 * If the filter would eliminate every plan, the helper logs and returns
 * the unfiltered list so a backend rename can never silently produce an
 * empty picker.
 */

interface ProductServiceMapping {
  productPatterns: string[];
  servicePatterns: string[];
}

export const PRODUCT_SERVICE_MAP: ProductServiceMapping[] = [
  {
    productPatterns: ['S6', 'M3'],
    servicePatterns: [
      'B30-0.9', 'B30-409 kWh', 'B30-2.2 kWh (1 swp)',
      'B30-10', 'B30-400 kWh', 'B30-25 kWh (15 swp)',
      'B30-50', 'B30-385 kWh', 'B30-130 kWh (60 swp)',
    ],
  },
  {
    productPatterns: ['E-3H', 'E-3 Plus'],
    servicePatterns: [
      'B45-1.2', 'B45-364 kWh', 'B45-3.3 kWh (1 swp)',
      'B45-20', 'B45-351 kWh', 'B45-57 kWh (15 swp)',
      'B45-68', 'B45-340 kWh', 'B45-200 kWh (60 swp)',
    ],
  },
  {
    productPatterns: ['CET3-B', 'PET-3-SRS', 'PET-3-DRS', 'PET-3DRS'],
    servicePatterns: [
      'B100-2.6', 'B100-342 kWh', 'B100-7.6 kWh (1 swp)',
      'B100-40', 'B100-333 kWh', 'B100-120 kWh (15 swp)',
      'B100-145', 'B100-322 kWh', 'B100-450 kWh (60 swp)',
    ],
  },
];

export const HIDDEN_PRODUCT_PATTERNS: string[] = ['PET1'];

/** Minimum shape needed to apply the package filter. */
export interface PlanLike {
  name?: string | null;
  templateId?: string | null;
}

/**
 * Narrow `allPlans` to those associated with `packageName`.
 *
 * - `packageName` falsy → returns the full list (caller didn't pick yet).
 * - No mapping matches the package → returns the full list (unrecognized
 *   package, don't hide options).
 * - Matched mapping but zero plans pass the service filter → logs a
 *   warning and returns the full list (defensive fallback).
 */
export function filterPlansByPackage<T extends PlanLike>(
  packageName: string | undefined | null,
  allPlans: T[],
): T[] {
  if (!packageName) return allPlans;

  const nameLower = packageName.toLowerCase();
  const matched = PRODUCT_SERVICE_MAP.find((mapping) =>
    mapping.productPatterns.some((p) => nameLower.includes(p.toLowerCase())),
  );
  if (!matched) return allPlans;

  const filtered = allPlans.filter((plan) => {
    const key = (plan.templateId || plan.name || '').toLowerCase();
    return matched.servicePatterns.some((sp) => key.includes(sp.toLowerCase()));
  });

  if (filtered.length === 0 && allPlans.length > 0) {
    console.warn(
      '[plan-filter] Filter matched zero plans for package',
      packageName,
      '— falling back to unfiltered list. Template ids present:',
      allPlans.map((p) => p.templateId || p.name),
    );
    return allPlans;
  }

  return filtered;
}
