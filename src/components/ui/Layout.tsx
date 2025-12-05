'use client';

import React from 'react';

// ============================================
// SCREEN
// ============================================

interface ScreenProps {
  /** Screen content */
  children: React.ReactNode;
  /** Whether screen is active/visible */
  active?: boolean;
  /** Padding size */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Center content vertically */
  centerContent?: boolean;
  /** Custom className */
  className?: string;
  /** Custom style */
  style?: React.CSSProperties;
}

const PADDING_VALUES = {
  none: 0,
  sm: 12,
  md: 16,
  lg: 24,
};

/**
 * Screen - Main screen/step container
 */
export function Screen({
  children,
  active = true,
  padding = 'md',
  centerContent = false,
  className = '',
  style,
}: ScreenProps) {
  if (!active) return null;

  return (
    <div 
      className={`screen ${active ? 'active' : ''} ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: PADDING_VALUES[padding],
        minHeight: 0,
        flex: 1,
        ...(centerContent && {
          justifyContent: 'center',
          alignItems: 'center',
        }),
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ============================================
// PAGE HEADER
// ============================================

interface PageHeaderProps {
  /** Main title */
  title: string;
  /** Subtitle/description */
  subtitle?: string;
  /** Alignment */
  align?: 'left' | 'center' | 'right';
  /** Title size */
  size?: 'sm' | 'md' | 'lg';
  /** Custom className */
  className?: string;
}

/**
 * PageHeader - Title and subtitle for a page/step
 */
export function PageHeader({
  title,
  subtitle,
  align = 'center',
  size = 'md',
  className = '',
}: PageHeaderProps) {
  const titleSizes = { sm: '16px', md: '20px', lg: '24px' };
  const subtitleSizes = { sm: '12px', md: '14px', lg: '16px' };

  return (
    <div 
      className={`page-header ${className}`}
      style={{
        textAlign: align,
        marginBottom: '16px',
      }}
    >
      <h1 style={{
        fontSize: titleSizes[size],
        fontWeight: 600,
        color: 'white',
        margin: 0,
        marginBottom: subtitle ? '4px' : 0,
      }}>
        {title}
      </h1>
      {subtitle && (
        <p style={{
          fontSize: subtitleSizes[size],
          color: 'rgba(255, 255, 255, 0.6)',
          margin: 0,
        }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

// ============================================
// GRID
// ============================================

interface GridProps {
  /** Grid content */
  children: React.ReactNode;
  /** Number of columns */
  columns?: 1 | 2 | 3 | 4;
  /** Gap between items */
  gap?: number;
  /** Min width for auto-fit */
  minWidth?: string;
  /** Custom className */
  className?: string;
}

/**
 * Grid - Responsive grid layout
 */
export function Grid({
  children,
  columns = 2,
  gap = 12,
  minWidth,
  className = '',
}: GridProps) {
  return (
    <div 
      className={`grid-layout ${className}`}
      style={{
        display: 'grid',
        gridTemplateColumns: minWidth 
          ? `repeat(auto-fit, minmax(${minWidth}, 1fr))`
          : `repeat(${columns}, 1fr)`,
        gap: `${gap}px`,
      }}
    >
      {children}
    </div>
  );
}

// ============================================
// STACK
// ============================================

interface StackProps {
  /** Stack content */
  children: React.ReactNode;
  /** Direction */
  direction?: 'row' | 'column';
  /** Gap between items */
  gap?: number;
  /** Alignment */
  align?: 'start' | 'center' | 'end' | 'stretch';
  /** Justify content */
  justify?: 'start' | 'center' | 'end' | 'between' | 'around';
  /** Wrap items */
  wrap?: boolean;
  /** Custom className */
  className?: string;
  /** Custom style */
  style?: React.CSSProperties;
}

const JUSTIFY_MAP = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
  around: 'space-around',
};

/**
 * Stack - Flexbox stack layout
 */
export function Stack({
  children,
  direction = 'column',
  gap = 12,
  align = 'stretch',
  justify = 'start',
  wrap = false,
  className = '',
  style,
}: StackProps) {
  return (
    <div 
      className={`stack ${className}`}
      style={{
        display: 'flex',
        flexDirection: direction,
        gap: `${gap}px`,
        alignItems: align === 'start' ? 'flex-start' : align === 'end' ? 'flex-end' : align,
        justifyContent: JUSTIFY_MAP[justify],
        flexWrap: wrap ? 'wrap' : 'nowrap',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ============================================
// DIVIDER
// ============================================

interface DividerProps {
  /** Direction */
  direction?: 'horizontal' | 'vertical';
  /** Margin */
  margin?: number;
  /** Custom className */
  className?: string;
}

/**
 * Divider - Visual separator line
 */
export function Divider({
  direction = 'horizontal',
  margin = 16,
  className = '',
}: DividerProps) {
  const isHorizontal = direction === 'horizontal';

  return (
    <div 
      className={`divider ${className}`}
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        ...(isHorizontal 
          ? { height: '1px', width: '100%', margin: `${margin}px 0` }
          : { width: '1px', height: '100%', margin: `0 ${margin}px` }
        ),
      }}
    />
  );
}

// ============================================
// SPACER
// ============================================

interface SpacerProps {
  /** Size in pixels or 'auto' for flex grow */
  size?: number | 'auto';
}

/**
 * Spacer - Empty space element
 */
export function Spacer({ size = 'auto' }: SpacerProps) {
  return (
    <div 
      style={
        size === 'auto' 
          ? { flex: 1 } 
          : { height: size, width: size, flexShrink: 0 }
      } 
    />
  );
}

// ============================================
// CONTAINER
// ============================================

interface ContainerProps {
  /** Container content */
  children: React.ReactNode;
  /** Max width */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Center horizontally */
  center?: boolean;
  /** Padding */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Custom className */
  className?: string;
}

const MAX_WIDTHS = {
  sm: '480px',
  md: '640px',
  lg: '768px',
  xl: '1024px',
  full: '100%',
};

/**
 * Container - Width-constrained container
 */
export function Container({
  children,
  maxWidth = 'md',
  center = true,
  padding = 'md',
  className = '',
}: ContainerProps) {
  return (
    <div 
      className={`container ${className}`}
      style={{
        maxWidth: MAX_WIDTHS[maxWidth],
        width: '100%',
        margin: center ? '0 auto' : undefined,
        padding: PADDING_VALUES[padding],
      }}
    >
      {children}
    </div>
  );
}

// ============================================
// HINT TEXT
// ============================================

interface HintProps {
  /** Hint content */
  children: React.ReactNode;
  /** Show info icon */
  showIcon?: boolean;
  /** Custom className */
  className?: string;
}

/**
 * Hint - Helper/info text with icon
 */
export function Hint({
  children,
  showIcon = true,
  className = '',
}: HintProps) {
  return (
    <p 
      className={`hint ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '12px',
        color: 'rgba(255, 255, 255, 0.5)',
        margin: '12px 0 0 0',
      }}
    >
      {showIcon && (
        <svg 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          style={{ width: '14px', height: '14px', flexShrink: 0 }}
        >
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 16v-4M12 8h.01"/>
        </svg>
      )}
      {children}
    </p>
  );
}
