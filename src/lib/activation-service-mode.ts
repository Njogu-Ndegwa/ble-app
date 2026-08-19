import type { ServiceState } from '@/lib/hooks/useCustomerIdentification';

const INFINITE_QUOTA_THRESHOLD = 100000;

export type ActivationServiceMode =
  | {
      kind: 'energy-priced';
      serviceId: string;
      rate: number;
      isQuotaBased: false;
    }
  | {
      kind: 'swap-count';
      serviceId: string;
      rate: 0;
      isQuotaBased: true;
      totalSwaps: number;
      usedSwaps: number;
      remainingSwaps: number;
    }
  | {
      kind: 'unsupported';
      serviceId: null;
      rate: 0;
      isQuotaBased: false;
    };

export function resolveActivationServiceMode(
  serviceStates: ServiceState[],
  customerRate: number,
): ActivationServiceMode {
  const energyService = serviceStates.find((service) => {
    const serviceId = service?.service_id?.toLowerCase();
    return serviceId?.includes('service-energy') || serviceId?.includes('service-electricity');
  });

  if (energyService && Number.isFinite(customerRate) && customerRate > 0) {
    return {
      kind: 'energy-priced',
      serviceId: energyService.service_id,
      rate: customerRate,
      isQuotaBased: false,
    };
  }

  const swapCountService = serviceStates.find((service) => {
    const serviceId = service?.service_id?.toLowerCase();
    const quota = Number(service?.quota);
    return Boolean(
      (serviceId?.includes('service-swap-count') || serviceId?.includes('service-swap_count')) &&
      Number.isFinite(quota) &&
      quota >= 0 &&
      quota < INFINITE_QUOTA_THRESHOLD,
    );
  });

  // A missing service-bundle match also arrives as customerRate=0. Only treat
  // the plan as swap-count when the energy ledger itself was explicitly
  // enriched with a zero price; otherwise preserve the pricing error instead
  // of accidentally granting a paid energy plan for free.
  const hasExplicitZeroEnergyRate = energyService?.usageUnitPrice !== undefined &&
    energyService?.usageUnitPrice !== null &&
    Number.isFinite(Number(energyService.usageUnitPrice)) &&
    Number(energyService.usageUnitPrice) === 0;

  if (swapCountService && hasExplicitZeroEnergyRate) {
    const totalSwaps = Math.max(0, Math.floor(Number(swapCountService.quota)));
    const usedSwaps = Math.max(0, Math.floor(Number(swapCountService.used) || 0));
    return {
      kind: 'swap-count',
      serviceId: swapCountService.service_id,
      rate: 0,
      isQuotaBased: true,
      totalSwaps,
      usedSwaps,
      remainingSwaps: Math.max(0, totalSwaps - usedSwaps),
    };
  }

  return {
    kind: 'unsupported',
    serviceId: null,
    rate: 0,
    isQuotaBased: false,
  };
}
