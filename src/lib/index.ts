/**
 * Library Exports
 * 
 * Central export point for all utilities, hooks, types, and constants.
 */

// Constants & Configuration
export * from './constants';

// Utility Functions
export * from './utils';

// Custom Hooks
export * from './hooks';

// Domain Types
export * from './types';

// Services (GraphQL, etc.)
export * from './services';

// GraphQL Mutations (export specific items to avoid conflicts with services)
export {
  IDENTIFY_CUSTOMER,
  REPORT_PAYMENT_AND_SERVICE,
  parseIdentifyCustomerMetadata,
  parsePaymentAndServiceMetadata,
  isIdentificationSuccessful,
  isPaymentAndServiceSuccessful,
  hasErrorSignals as hasGraphQLErrorSignals,
  type IdentifyCustomerInput,
  type IdentifyCustomerResponse,
  type IdentifyCustomerMetadata,
  type ReportPaymentAndServiceInput,
  type ReportPaymentAndServiceResponse,
  type PaymentDataInput,
  type ServiceDataInput,
  type GraphQLServiceState,
  type GraphQLServiceDefinition,
  type GraphQLServicePlanData,
  type GraphQLServiceBundle,
  type GraphQLCommonTerms,
} from './graphql';

// API Services (re-export common types)
export type {
  OdooApiResponse,
  OdooApiError,
  RegisterCustomerPayload,
  RegisterCustomerResponse,
  SubscriptionProduct,
} from './odoo-api';
