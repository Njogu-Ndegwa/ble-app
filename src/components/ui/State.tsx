'use client';

import React from 'react';
import { AlertTriangleIcon, PackageIcon, RefreshIcon, SearchIcon, LoaderIcon } from './Icons';

// ============================================
// EMPTY STATE
// ============================================

interface EmptyStateProps {
  /** Title */
  title: string;
  /** Description */
  description?: string;
  /** Icon (defaults to package icon) */
  icon?: React.ReactNode;
  /** Action button */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Hint text at bottom */
  hint?: string;
  /** Custom className */
  className?: string;
}

/**
 * EmptyState - Display when there's no data to show
 */
export function EmptyState({
  title,
  description,
  icon,
  action,
  hint,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`empty-state ${className}`} style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-10) var(--space-5)',
      textAlign: 'center',
    }}>
      {/* Icon */}
      <div style={{
        width: '80px',
        height: '80px',
        borderRadius: 'var(--radius-full)',
        backgroundColor: 'var(--bg-surface)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 'var(--space-5)',
        position: 'relative',
      }}>
        <div style={{ color: 'var(--text-muted)', width: '40px', height: '40px' }}>
          {icon || <PackageIcon size={40} />}
        </div>
        {/* X badge */}
        <div style={{
          position: 'absolute',
          bottom: '-4px',
          right: '-4px',
          width: '28px',
          height: '28px',
          borderRadius: 'var(--radius-full)',
          backgroundColor: 'var(--color-error-soft)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px solid var(--bg-primary)',
        }}>
          <span style={{ color: 'var(--color-error)', fontSize: 'var(--font-lg)', fontWeight: 'var(--weight-bold)' }}>×</span>
        </div>
      </div>

      {/* Content */}
      <h3 className="text-h4" style={{ marginBottom: 'var(--space-2)' }}>{title}</h3>
      {description && (
        <p className="text-body-sm text-muted" style={{ maxWidth: '280px', marginBottom: 'var(--space-5)' }}>
          {description}
        </p>
      )}

      {/* Action */}
      {action && (
        <button
          onClick={action.onClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-2-5) var(--space-5)',
            backgroundColor: 'var(--color-brand)',
            color: 'var(--text-inverse)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-base)',
            fontWeight: 'var(--weight-medium)' as React.CSSProperties['fontWeight'],
            fontFamily: 'var(--font-sans)',
            cursor: 'pointer',
          }}
        >
          <RefreshIcon size={16} />
          {action.label}
        </button>
      )}

      {/* Hint */}
      {hint && (
        <p className="text-caption text-muted" style={{ marginTop: 'var(--space-4)' }}>{hint}</p>
      )}
    </div>
  );
}

// ============================================
// ERROR STATE
// ============================================

interface ErrorStateProps {
  /** Title */
  title?: string;
  /** Error message */
  message: string;
  /** Retry action */
  onRetry?: () => void;
  /** Retry button label */
  retryLabel?: string;
  /** Hint text at bottom */
  hint?: string;
  /** Custom className */
  className?: string;
}

/**
 * ErrorState - Display error with retry option
 */
export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Try Again',
  hint,
  className = '',
}: ErrorStateProps) {
  return (
    <div className={`error-state ${className}`} style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-10) var(--space-5)',
      textAlign: 'center',
    }}>
      {/* Icon with animation rings */}
      <div style={{
        position: 'relative',
        width: '80px',
        height: '80px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 'var(--space-5)',
      }}>
        <div style={{
          width: '60px',
          height: '60px',
          borderRadius: 'var(--radius-full)',
          backgroundColor: 'var(--color-error-soft)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <AlertTriangleIcon size={32} color="var(--color-error)" />
        </div>
      </div>

      {/* Content */}
      <h3 className="text-h4" style={{ marginBottom: 'var(--space-2)' }}>{title}</h3>
      <p className="text-body-sm text-muted" style={{ maxWidth: '280px', marginBottom: 'var(--space-5)' }}>
        {message}
      </p>

      {/* Retry */}
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-2-5) var(--space-5)',
            backgroundColor: 'var(--color-brand)',
            color: 'var(--text-inverse)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-base)',
            fontWeight: 'var(--weight-medium)' as React.CSSProperties['fontWeight'],
            fontFamily: 'var(--font-sans)',
            cursor: 'pointer',
          }}
        >
          <RefreshIcon size={16} />
          {retryLabel}
        </button>
      )}

      {/* Hint */}
      {hint && (
        <p className="text-caption text-muted" style={{ marginTop: 'var(--space-4)' }}>{hint}</p>
      )}
    </div>
  );
}

// ============================================
// LOADING STATE
// ============================================

interface LoadingStateProps {
  /** Loading message */
  message?: string;
  /** Size */
  size?: 'sm' | 'md' | 'lg';
  /** Inline (no padding) */
  inline?: boolean;
  /** Custom className */
  className?: string;
}

/**
 * LoadingState - Display loading spinner
 */
export function LoadingState({
  message,
  size = 'md',
  inline = false,
  className = '',
}: LoadingStateProps) {
  const sizes = { sm: 24, md: 40, lg: 56 };

  return (
    <div 
      className={`loading-state ${className}`} 
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: inline ? '0' : 'var(--space-10) var(--space-5)',
        gap: 'var(--space-3)',
      }}
    >
      <LoaderIcon size={sizes[size]} />
      {message && (
        <p className="text-body-sm text-muted">{message}</p>
      )}
    </div>
  );
}

// ============================================
// NOT FOUND STATE
// ============================================

interface NotFoundStateProps {
  /** Title */
  title?: string;
  /** Description */
  description?: string;
  /** Search term that wasn't found */
  searchTerm?: string;
  /** Action button */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Custom className */
  className?: string;
}

/**
 * NotFoundState - Display when search yields no results
 */
export function NotFoundState({
  title = 'No results found',
  description,
  searchTerm,
  action,
  className = '',
}: NotFoundStateProps) {
  return (
    <div className={`not-found-state ${className}`} style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-10) var(--space-5)',
      textAlign: 'center',
    }}>
      <div style={{
        width: '64px',
        height: '64px',
        borderRadius: 'var(--radius-full)',
        backgroundColor: 'var(--bg-surface)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 'var(--space-4)',
      }}>
        <SearchIcon size={32} color="var(--text-muted)" />
      </div>
      
      <h3 className="text-h4" style={{ marginBottom: 'var(--space-2)' }}>{title}</h3>
      
      {searchTerm && (
        <p className="text-body-sm text-muted" style={{ marginBottom: 'var(--space-2)' }}>
          No matches for &ldquo;<strong>{searchTerm}</strong>&rdquo;
        </p>
      )}
      
      {description && (
        <p className="text-body-sm text-muted" style={{ maxWidth: '280px', marginBottom: 'var(--space-5)' }}>
          {description}
        </p>
      )}

      {action && (
        <button
          onClick={action.onClick}
          style={{
            padding: 'var(--space-2-5) var(--space-5)',
            backgroundColor: 'var(--color-brand)',
            color: 'var(--text-inverse)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-base)',
            fontWeight: 'var(--weight-medium)' as React.CSSProperties['fontWeight'],
            fontFamily: 'var(--font-sans)',
            cursor: 'pointer',
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// ============================================
// SKELETON LOADER
// ============================================

interface SkeletonProps {
  /** Width */
  width?: string | number;
  /** Height */
  height?: string | number;
  /** Border radius */
  radius?: string | number;
  /** Variant */
  variant?: 'text' | 'rect' | 'circle';
  /** Custom className */
  className?: string;
}

/**
 * Skeleton - Loading placeholder
 */
export function Skeleton({
  width,
  height,
  radius,
  variant = 'rect',
  className = '',
}: SkeletonProps) {
  const variantStyles: Record<string, React.CSSProperties> = {
    text: { height: '1em', borderRadius: 'var(--radius-sm)' },
    rect: { borderRadius: radius || 'var(--radius-md)' },
    circle: { borderRadius: 'var(--radius-full)' },
  };

  return (
    <div 
      className={`skeleton animate-pulse ${className}`}
      style={{
        backgroundColor: 'var(--bg-surface)',
        width: width || '100%',
        height: height || '20px',
        ...variantStyles[variant],
      }}
    />
  );
}

// ============================================
// SKELETON CARD
// ============================================

interface SkeletonCardProps {
  /** Show image placeholder */
  showImage?: boolean;
  /** Number of text lines */
  lines?: number;
  /** Custom className */
  className?: string;
}

/**
 * SkeletonCard - Loading placeholder for cards
 */
export function SkeletonCard({
  showImage = true,
  lines = 2,
  className = '',
}: SkeletonCardProps) {
  return (
    <div 
      className={`skeleton-card ${className}`}
      style={{
        padding: 'var(--space-4)',
        backgroundColor: 'var(--bg-surface)',
        borderRadius: 'var(--radius-lg)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
      }}
    >
      {showImage && (
        <Skeleton height={120} radius="var(--radius-md)" />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton 
            key={i} 
            height={16} 
            width={i === lines - 1 ? '60%' : '100%'} 
          />
        ))}
      </div>
    </div>
  );
}
