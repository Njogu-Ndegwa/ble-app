export type { ExistingCustomer } from '@/lib/services/customer-service';

export type { CustomerFormData, BatteryData, PlanData } from '../../customers/customerform/components/types';
export { getInitials, getBatteryClass, generateRegistrationId } from '../../customers/customerform/components/types';

export type ActivatorStep = 1 | 2 | 3 | 4 | 5 | 6;

export interface StepConfig {
  step: number;
  label: string;
  icon: 'customer' | 'package' | 'plan' | 'vehicle' | 'battery' | 'done';
}

export const STEP_CONFIGS: StepConfig[] = [
  { step: 1, label: 'Customer', icon: 'customer' },
  { step: 2, label: 'Package', icon: 'package' },
  { step: 3, label: 'Plan', icon: 'plan' },
  { step: 4, label: 'Vehicle', icon: 'vehicle' },
  { step: 5, label: 'Battery', icon: 'battery' },
  { step: 6, label: 'Done', icon: 'done' },
];
