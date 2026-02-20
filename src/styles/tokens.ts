/**
 * OVES Design Tokens
 * 
 * Single source of truth for all design decisions.
 * Use these tokens in components to ensure consistency.
 */

// ============================================
// COLOR TOKENS
// ============================================

export const colors = {
  // Brand Colors (theme-aware via CSS variables)
  brand: {
    primary: 'var(--color-brand)',
    primaryLight: 'var(--color-brand-light)',
    primaryDark: 'var(--color-brand-dark)',
  },

  // Background Colors
  bg: {
    primary: 'var(--bg-primary)',
    secondary: 'var(--bg-secondary)',
    tertiary: 'var(--bg-tertiary)',
    elevated: 'var(--bg-elevated)',
  },

  // Text Colors
  text: {
    primary: 'var(--text-primary)',
    secondary: 'var(--text-secondary)',
    muted: 'var(--text-muted)',
    inverse: 'var(--text-inverse)',
  },

  // Border Colors
  border: {
    default: 'var(--border-default)',
    subtle: 'var(--border-subtle)',
  },

  // Semantic Colors
  success: 'var(--color-success)',
  successLight: 'var(--color-success-light)',
  successSoft: 'var(--color-success-soft)',
  
  warning: 'var(--color-warning)',
  warningLight: 'var(--color-warning-light)',
  warningSoft: 'var(--color-warning-soft)',
  
  error: 'var(--color-error)',
  errorLight: 'var(--color-error-light)',
  errorSoft: 'var(--color-error-soft)',
  
  info: 'var(--color-info)',
  infoLight: 'var(--color-info-light)',
  infoSoft: 'var(--color-info-soft)',

  // Semantic borders
  infoBorder: 'var(--color-info-border)',
  successBorder: 'var(--color-success-border)',
  errorBorder: 'var(--color-error-border)',
  warningBorder: 'var(--color-warning-border)',

  // Overlay
  overlay: 'var(--overlay)',
  overlayLight: 'var(--overlay-light)',
} as const;

// ============================================
// TYPOGRAPHY TOKENS
// ============================================

export const fontFamily = {
  sans: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  mono: "'DM Mono', 'SF Mono', Monaco, Consolas, monospace",
} as const;

export const fontWeight = {
  light: 300,
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

export const lineHeight = {
  none: 1,
  tight: 1.25,
  snug: 1.375,
  normal: 1.5,
  relaxed: 1.625,
  loose: 2,
} as const;

/**
 * Typography Scale
 * 
 * Using a consistent scale based on 4px grid.
 * Each step is roughly 1.2x the previous (minor third).
 */
export const fontSize = {
  // Caption/Label sizes
  '2xs': '10px',    // Micro text, badges
  'xs': '11px',     // Small labels, hints
  'sm': '12px',     // Secondary text, form labels
  
  // Body sizes
  'base': '14px',   // Default body text
  'md': '15px',     // Slightly larger body
  
  // Heading sizes
  'lg': '16px',     // Small headings, card titles
  'xl': '18px',     // Section headings
  '2xl': '20px',    // Page titles
  '3xl': '24px',    // Large titles
  '4xl': '28px',    // Hero/Display
  '5xl': '32px',    // Extra large display
} as const;

/**
 * Semantic Typography Presets
 * 
 * Use these for consistent text styling:
 * - display: Hero text, large numbers
 * - h1-h6: Headings
 * - body: Default body text
 * - caption: Small supplementary text
 * - label: Form labels, small titles
 * - mono: Code, IDs, numbers
 */
export const typography = {
  // Display
  display: {
    fontSize: fontSize['4xl'],
    fontWeight: fontWeight.bold,
    lineHeight: lineHeight.tight,
    fontFamily: fontFamily.sans,
  },
  
  // Headings
  h1: {
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.bold,
    lineHeight: lineHeight.tight,
    fontFamily: fontFamily.sans,
  },
  h2: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.snug,
    fontFamily: fontFamily.sans,
  },
  h3: {
    fontSize: fontSize['xl'],
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.snug,
    fontFamily: fontFamily.sans,
  },
  h4: {
    fontSize: fontSize['lg'],
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.normal,
    fontFamily: fontFamily.sans,
  },
  h5: {
    fontSize: fontSize['md'],
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.normal,
    fontFamily: fontFamily.sans,
  },
  h6: {
    fontSize: fontSize['base'],
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.normal,
    fontFamily: fontFamily.sans,
  },
  
  // Body
  bodyLg: {
    fontSize: fontSize['md'],
    fontWeight: fontWeight.regular,
    lineHeight: lineHeight.relaxed,
    fontFamily: fontFamily.sans,
  },
  body: {
    fontSize: fontSize['base'],
    fontWeight: fontWeight.regular,
    lineHeight: lineHeight.normal,
    fontFamily: fontFamily.sans,
  },
  bodySm: {
    fontSize: fontSize['sm'],
    fontWeight: fontWeight.regular,
    lineHeight: lineHeight.normal,
    fontFamily: fontFamily.sans,
  },
  
  // Caption/Labels
  caption: {
    fontSize: fontSize['xs'],
    fontWeight: fontWeight.regular,
    lineHeight: lineHeight.normal,
    fontFamily: fontFamily.sans,
  },
  captionSm: {
    fontSize: fontSize['2xs'],
    fontWeight: fontWeight.regular,
    lineHeight: lineHeight.snug,
    fontFamily: fontFamily.sans,
  },
  label: {
    fontSize: fontSize['sm'],
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.normal,
    fontFamily: fontFamily.sans,
  },
  
  // Mono/Code
  mono: {
    fontSize: fontSize['sm'],
    fontWeight: fontWeight.regular,
    lineHeight: lineHeight.normal,
    fontFamily: fontFamily.mono,
  },
  monoSm: {
    fontSize: fontSize['xs'],
    fontWeight: fontWeight.regular,
    lineHeight: lineHeight.normal,
    fontFamily: fontFamily.mono,
  },
} as const;

// ============================================
// SPACING TOKENS
// ============================================

/**
 * Spacing Scale (4px base grid)
 */
export const spacing = {
  0: '0px',
  0.5: '2px',
  1: '4px',
  1.5: '6px',
  2: '8px',
  2.5: '10px',
  3: '12px',
  3.5: '14px',
  4: '16px',
  5: '20px',
  6: '24px',
  7: '28px',
  8: '32px',
  9: '36px',
  10: '40px',
  11: '44px',
  12: '48px',
  14: '56px',
  16: '64px',
  20: '80px',
  24: '96px',
} as const;

// Semantic spacing
export const space = {
  // Component internal spacing
  componentXs: spacing[1],    // 4px
  componentSm: spacing[2],    // 8px
  componentMd: spacing[3],    // 12px
  componentLg: spacing[4],    // 16px
  
  // Layout spacing
  layoutXs: spacing[3],       // 12px
  layoutSm: spacing[4],       // 16px
  layoutMd: spacing[5],       // 20px
  layoutLg: spacing[6],       // 24px
  layoutXl: spacing[8],       // 32px
  
  // Section spacing
  sectionSm: spacing[8],      // 32px
  sectionMd: spacing[12],     // 48px
  sectionLg: spacing[16],     // 64px
} as const;

// ============================================
// BORDER RADIUS TOKENS
// ============================================

export const radius = {
  none: '0',
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '20px',
  '3xl': '24px',
  full: '9999px',
} as const;

// ============================================
// SHADOW TOKENS
// ============================================

export const shadow = {
  none: 'none',
  sm: 'var(--shadow-sm)',
  md: 'var(--shadow-md)',
  lg: 'var(--shadow-lg)',
  xl: 'var(--shadow-xl)',
  glow: 'var(--shadow-glow)',
  glowSuccess: 'var(--shadow-glow-success)',
  glowError: 'var(--shadow-glow-error)',
  card: 'var(--shadow-card)',
} as const;

// ============================================
// TRANSITION TOKENS
// ============================================

export const duration = {
  instant: '0ms',
  fast: '100ms',
  normal: '200ms',
  slow: '300ms',
  slower: '500ms',
} as const;

export const easing = {
  linear: 'linear',
  ease: 'ease',
  easeIn: 'ease-in',
  easeOut: 'ease-out',
  easeInOut: 'ease-in-out',
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const;

export const transition = {
  fast: `all ${duration.fast} ${easing.easeOut}`,
  normal: `all ${duration.normal} ${easing.easeOut}`,
  slow: `all ${duration.slow} ${easing.easeOut}`,
} as const;

// ============================================
// Z-INDEX TOKENS
// ============================================

export const zIndex = {
  base: 0,
  dropdown: 100,
  sticky: 200,
  overlay: 300,
  modal: 400,
  popover: 500,
  toast: 600,
  tooltip: 700,
  max: 9999,
} as const;

// ============================================
// BREAKPOINT TOKENS
// ============================================

export const breakpoint = {
  xs: '320px',
  sm: '480px',
  md: '640px',
  lg: '768px',
  xl: '1024px',
  '2xl': '1280px',
} as const;

// ============================================
// COMPONENT SIZE TOKENS
// ============================================

export const componentSize = {
  // Button heights
  buttonSm: '32px',
  buttonMd: '40px',
  buttonLg: '48px',
  
  // Input heights
  inputSm: '32px',
  inputMd: '40px',
  inputLg: '48px',
  
  // Avatar sizes
  avatarXs: '24px',
  avatarSm: '32px',
  avatarMd: '40px',
  avatarLg: '48px',
  avatarXl: '64px',
  
  // Icon sizes
  iconXs: '12px',
  iconSm: '16px',
  iconMd: '20px',
  iconLg: '24px',
  iconXl: '32px',
  
  // Touch targets (min 44px for accessibility)
  touchMin: '44px',
} as const;

// ============================================
// EXPORT ALL TOKENS
// ============================================

const tokens = {
  colors,
  fontFamily,
  fontWeight,
  fontSize,
  lineHeight,
  typography,
  spacing,
  space,
  radius,
  shadow,
  duration,
  easing,
  transition,
  zIndex,
  breakpoint,
  componentSize,
} as const;

export default tokens;

// Type exports for TypeScript support
export type Colors = typeof colors;
export type FontSize = keyof typeof fontSize;
export type Spacing = keyof typeof spacing;
export type Radius = keyof typeof radius;
export type Shadow = keyof typeof shadow;
export type Typography = keyof typeof typography;
