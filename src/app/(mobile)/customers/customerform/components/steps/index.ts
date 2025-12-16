export { default as Step1CustomerForm } from './Step1CustomerForm';
export { default as Step2SelectPackage } from './Step2SelectPackage';  // Package selection (product + privilege bundled)
export { default as Step3SelectSubscription } from './Step2SelectPlan';  // Subscription selection
export { default as Step4Preview } from './Step4Preview';  // Order preview before payment
export { default as Step5Payment } from './Step3Payment';  // Payment collection
export { default as Step6ScanVehicle } from './Step6ScanVehicle';  // Vehicle QR scan (NEW)
export { default as Step7AssignBattery } from './Step4AssignBattery';  // Battery assignment
export { default as Step8Success } from './Step5Success';  // Success confirmation

// Legacy exports for backward compatibility (if needed)
export { default as Step2SelectProduct } from './Step2SelectProduct';  // Deprecated: Use Step2SelectPackage
export { default as Step3SelectPlan } from './Step2SelectPlan';  // Deprecated: Use Step3SelectSubscription
