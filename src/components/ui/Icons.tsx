'use client';

import React from 'react';

export interface IconProps {
  size?: number | string;
  color?: string;
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}

const defaultProps: IconProps = {
  size: 24,
  strokeWidth: 2,
};

// Helper to merge props
const getProps = (props: IconProps) => ({
  width: props.size || defaultProps.size,
  height: props.size || defaultProps.size,
  stroke: props.color || 'currentColor',
  strokeWidth: props.strokeWidth || defaultProps.strokeWidth,
  fill: 'none',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className: props.className,
  style: props.style,
});

// ============================================
// USER & CUSTOMER ICONS
// ============================================

export const UserIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" {...getProps(props)}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

export const UsersIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" {...getProps(props)}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

// ============================================
// BATTERY ICONS
// ============================================

export const BatteryIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" {...getProps(props)}>
    <rect x="2" y="7" width="16" height="10" rx="2"/>
    <path d="M22 11v2"/>
  </svg>
);

export const BatteryPlusIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" {...getProps(props)}>
    <rect x="2" y="7" width="16" height="10" rx="2"/>
    <path d="M22 11v2"/>
    <path d="M7 11h4M9 9v4"/>
  </svg>
);

export const BatteryReturnIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" {...getProps(props)}>
    <rect x="2" y="7" width="16" height="10" rx="2"/>
    <path d="M22 11v2"/>
    <path d="M6 11v2"/>
  </svg>
);

export const BoltIcon = (props: IconProps) => (
  <svg 
    viewBox="0 0 24 24" 
    width={props.size || 24}
    height={props.size || 24}
    fill={props.color || 'currentColor'}
    className={props.className}
    style={props.style}
  >
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
  </svg>
);

// ============================================
// PAYMENT & MONEY ICONS
// ============================================

export const CreditCardIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" {...getProps(props)}>
    <rect x="1" y="4" width="22" height="16" rx="2"/>
    <path d="M1 10h22"/>
  </svg>
);

export const WalletIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" {...getProps(props)}>
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
    <path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>
  </svg>
);

// ============================================
// QR & SCAN ICONS
// ============================================

export const QrCodeIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" {...getProps(props)}>
    <rect x="3" y="3" width="7" height="7"/>
    <rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/>
    <rect x="3" y="14" width="7" height="7"/>
  </svg>
);

export const ScanIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" {...getProps(props)}>
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <path d="M7 7h.01M7 12h.01M7 17h.01M12 7h.01M12 12h.01M12 17h.01M17 7h.01M17 12h.01M17 17h.01"/>
  </svg>
);

// ============================================
// ACTION ICONS
// ============================================

export const CheckIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" {...getProps(props)}>
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

export const CheckCircleIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" {...getProps(props)}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

export const XIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" {...getProps(props)}>
    <path d="M18 6L6 18M6 6l12 12"/>
  </svg>
);

export const XCircleIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" {...getProps(props)}>
    <circle cx="12" cy="12" r="10"/>
    <path d="M15 9l-6 6M9 9l6 6"/>
  </svg>
);

export const PlusIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" {...getProps(props)}>
    <path d="M12 5v14M5 12h14"/>
  </svg>
);

export const MinusIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" {...getProps(props)}>
    <path d="M5 12h14"/>
  </svg>
);

export const EditIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" {...getProps(props)}>
    <path d="M12 20h9"/>
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
  </svg>
);

export const TrashIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" {...getProps(props)}>
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
);

export const RefreshIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" {...getProps(props)}>
    <path d="M21 12a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
    <path d="M21 3v5h-5"/>
  </svg>
);

// ============================================
// NAVIGATION ICONS
// ============================================

export const ArrowLeftIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" {...getProps(props)}>
    <path d="M19 12H5M12 19l-7-7 7-7"/>
  </svg>
);

export const ArrowRightIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" {...getProps(props)}>
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>
);

export const ChevronDownIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" {...getProps(props)}>
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

export const ChevronUpIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" {...getProps(props)}>
    <polyline points="18 15 12 9 6 15"/>
  </svg>
);

export const LogOutIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" {...getProps(props)}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

// ============================================
// STATUS & INFO ICONS
// ============================================

export const InfoIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" {...getProps(props)}>
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 16v-4M12 8h.01"/>
  </svg>
);

export const AlertTriangleIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" {...getProps(props)}>
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

export const AlertCircleIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" {...getProps(props)}>
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

export const SearchIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" {...getProps(props)}>
    <circle cx="11" cy="11" r="8"/>
    <path d="M21 21l-4.35-4.35"/>
  </svg>
);

export const GlobeIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" {...getProps(props)}>
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
);

// ============================================
// PACKAGE & PRODUCT ICONS
// ============================================

export const PackageIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" {...getProps(props)}>
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
    <line x1="12" y1="22.08" x2="12" y2="12"/>
  </svg>
);

export const CalendarIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" {...getProps(props)}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

export const FileTextIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" {...getProps(props)}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <path d="M14 2v6h6"/>
    <path d="M16 13H8M16 17H8"/>
  </svg>
);

export const EyeIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" {...getProps(props)}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

export const SwapIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" {...getProps(props)}>
    <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/>
  </svg>
);

// ============================================
// LOADER ICON
// ============================================

export const LoaderIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" {...getProps(props)} className={`animate-spin ${props.className || ''}`}>
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25"/>
    <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round"/>
  </svg>
);

// ============================================
// ICON MAP (for dynamic usage)
// ============================================

export const Icons = {
  user: UserIcon,
  users: UsersIcon,
  battery: BatteryIcon,
  batteryPlus: BatteryPlusIcon,
  batteryReturn: BatteryReturnIcon,
  bolt: BoltIcon,
  creditCard: CreditCardIcon,
  wallet: WalletIcon,
  qrCode: QrCodeIcon,
  scan: ScanIcon,
  check: CheckIcon,
  checkCircle: CheckCircleIcon,
  x: XIcon,
  xCircle: XCircleIcon,
  plus: PlusIcon,
  minus: MinusIcon,
  edit: EditIcon,
  trash: TrashIcon,
  refresh: RefreshIcon,
  arrowLeft: ArrowLeftIcon,
  arrowRight: ArrowRightIcon,
  chevronDown: ChevronDownIcon,
  chevronUp: ChevronUpIcon,
  logOut: LogOutIcon,
  info: InfoIcon,
  alertTriangle: AlertTriangleIcon,
  alertCircle: AlertCircleIcon,
  search: SearchIcon,
  globe: GlobeIcon,
  package: PackageIcon,
  calendar: CalendarIcon,
  fileText: FileTextIcon,
  eye: EyeIcon,
  swap: SwapIcon,
  loader: LoaderIcon,
} as const;

export type IconName = keyof typeof Icons;

// Dynamic Icon component
interface DynamicIconProps extends IconProps {
  name: IconName;
}

export const Icon = ({ name, ...props }: DynamicIconProps) => {
  const IconComponent = Icons[name];
  return <IconComponent {...props} />;
};
