export type { ExistingCustomer } from '@/lib/services/customer-service';

export type { CustomerFormData, BatteryData, PlanData } from '../../customers/customerform/components/types';
export { getInitials, getBatteryClass, generateRegistrationId } from '../../customers/customerform/components/types';

export type ActivatorStep = 1 | 2 | 3 | 4 | 5;

export interface StepConfig {
  step: number;
  label: string;
  icon: 'customer' | 'plan' | 'vehicle' | 'battery' | 'done';
}

export const STEP_CONFIGS: StepConfig[] = [
  { step: 1, label: 'Customer', icon: 'customer' },
  { step: 2, label: 'Plan', icon: 'plan' },
  { step: 3, label: 'Vehicle', icon: 'vehicle' },
  { step: 4, label: 'Battery', icon: 'battery' },
  { step: 5, label: 'Done', icon: 'done' },
];
