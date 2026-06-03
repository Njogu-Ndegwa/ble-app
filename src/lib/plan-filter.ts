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
 * because old products may not have a template id populated.
 *
 * The three product families map 1:1 onto the three battery prefixes:
 *   S6/M3            → B30
 *   E-3H / E-3 Plus  → B45
 *   CET3-B / PET-3   → B100
 * so we match on that prefix alone. The kWh/swp tier suffix is NOT a
 * reliable discriminator: backend template ids drift on whitespace and
 * punctuation (e.g. `B45-200 kWh(60 swp)` has no space before the paren
 * while `B30-130 kWh (60 swp)` does), and enumerating every tier meant a
 * single formatting change silently hid plans. The battery prefix is
 * stable and unambiguous (B30/B45/B100 never collide as substrings).
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
    servicePatterns: ['B30-'],
  },
  {
    productPatterns: ['E-3H', 'E-3 Plus', 'E-3 PRO'],
    servicePatterns: ['B45-'],
  },
  {
    productPatterns: ['CET3-B', 'PET-3-SRS', 'PET-3-DRS', 'PET-3DRS'],
    servicePatterns: ['B100-'],
  },
];

export const HIDDEN_PRODUCT_PATTERNS: string[] = ['PET1'];

/**
 * Canonicalize a string for matching: lowercase and strip ALL whitespace.
 *
 * Backend template ids and display names are formatted inconsistently — the
 * same tier ships as both `B45-200 kWh(60 swp)` and `B30-130 kWh (60 swp)`
 * (note the space before the paren in one but not the other). Removing
 * whitespace on both the pattern and the candidate before `includes()` makes
 * the filter immune to that drift, so a future formatting change in Odoo can
 * never silently hide a plan again. Keep patterns whitespace-tolerant by
 * design: never rely on an exact space being present.
 */
const norm = (s: string): string => s.toLowerCase().replace(/\s+/g, '');

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

  const name = norm(packageName);
  const matched = PRODUCT_SERVICE_MAP.find((mapping) =>
    mapping.productPatterns.some((p) => name.includes(norm(p))),
  );
  if (!matched) return allPlans;

  const filtered = allPlans.filter((plan) => {
    const key = norm(plan.templateId || plan.name || '');
    return matched.servicePatterns.some((sp) => key.includes(norm(sp)));
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
