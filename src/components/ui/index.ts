/**
 * UI Components Library
 * 
 * Pure presentational components with no business logic.
 * These components ensure visual consistency across the application.
 * 
 * Usage:
 * import { Button, Card, Avatar, Badge } from '@/components/ui';
 */

// ============================================
// ICONS
// ============================================
export * from './Icons';

// ============================================
// AVATAR
// ============================================
export { default as Avatar, AvatarGroup, getInitials } from './Avatar';
export type { AvatarSize, AvatarVariant } from './Avatar';

// ============================================
// BADGE
// ============================================
export { default as Badge, StatusBadge } from './Badge';
export type { BadgeVariant, BadgeSize, StatusType } from './Badge';

// ============================================
// BUTTON
// ============================================
export { default as Button, IconButton, ButtonGroup } from './Button';
export type { ButtonVariant, ButtonSize } from './Button';

// ============================================
// CARD
// ============================================
export { 
  default as Card, 
  CustomerCard, 
  SelectableCard, 
  PreviewRow, 
  StatCard 
} from './Card';
export type { CardVariant } from './Card';

// ============================================
// FORM
// ============================================
export { 
  FormInput, 
  FormGroup, 
  FormSection, 
  FormRow, 
  ToggleGroup 
} from './Form';
export type { InputType, InputSize } from './Form';

// ============================================
// STATE
// ============================================
export { 
  EmptyState, 
  ErrorState, 
  LoadingState, 
  NotFoundState,
  Skeleton,
  SkeletonCard,
} from './State';

// ============================================
// PROGRESS
// ============================================
export { 
  ProgressBar, 
  QuotaBar, 
  StepProgress, 
  CircularProgress,
  getProgressColor,
} from './Progress';
export type { ProgressVariant } from './Progress';

// ============================================
// LAYOUT
// ============================================
export { 
  Screen, 
  PageHeader, 
  Grid, 
  Stack, 
  Divider, 
  Spacer, 
  Container,
  Hint,
} from './Layout';

// ============================================
// PHONE INPUT WITH COUNTRY
// ============================================
export { default as PhoneInputWithCountry } from './PhoneInputWithCountry';
