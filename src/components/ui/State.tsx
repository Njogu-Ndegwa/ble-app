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
      padding: '40px 20px',
      textAlign: 'center',
    }}>
      {/* Icon */}
      <div style={{
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '20px',
        position: 'relative',
      }}>
        <div style={{ color: 'rgba(255, 255, 255, 0.4)', width: '40px', height: '40px' }}>
          {icon || <PackageIcon size={40} />}
        </div>
        {/* X badge */}
        <div style={{
          position: 'absolute',
          bottom: '-4px',
          right: '-4px',
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          backgroundColor: 'rgba(239, 68, 68, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px solid var(--color-bg, #1a1a2e)',
        }}>
          <span style={{ color: '#ef4444', fontSize: '16px', fontWeight: 'bold' }}>×</span>
        </div>
      </div>

      {/* Content */}
      <h3 style={{
        fontSize: '16px',
        fontWeight: 600,
        color: 'white',
        marginBottom: '8px',
      }}>
        {title}
      </h3>
      {description && (
        <p style={{
          fontSize: '13px',
          color: 'rgba(255, 255, 255, 0.5)',
          maxWidth: '280px',
          marginBottom: '20px',
        }}>
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
            gap: '8px',
            padding: '10px 20px',
            backgroundColor: 'var(--color-primary, #6366f1)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <RefreshIcon size={16} />
          {action.label}
        </button>
      )}

      {/* Hint */}
      {hint && (
        <p style={{
          fontSize: '12px',
          color: 'rgba(255, 255, 255, 0.4)',
          marginTop: '16px',
        }}>
          {hint}
        </p>
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
      padding: '40px 20px',
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
        marginBottom: '20px',
      }}>
        <div style={{
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <AlertTriangleIcon size={32} color="#ef4444" />
        </div>
      </div>

      {/* Content */}
      <h3 style={{
        fontSize: '16px',
        fontWeight: 600,
        color: 'white',
        marginBottom: '8px',
      }}>
        {title}
      </h3>
      <p style={{
        fontSize: '13px',
        color: 'rgba(255, 255, 255, 0.5)',
        maxWidth: '280px',
        marginBottom: '20px',
      }}>
        {message}
      </p>

      {/* Retry */}
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            backgroundColor: 'var(--color-primary, #6366f1)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <RefreshIcon size={16} />
          {retryLabel}
        </button>
      )}

      {/* Hint */}
      {hint && (
        <p style={{
          fontSize: '12px',
          color: 'rgba(255, 255, 255, 0.4)',
          marginTop: '16px',
        }}>
          {hint}
        </p>
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
  const sizes = {
    sm: 24,
    md: 40,
    lg: 56,
  };

  return (
    <div 
      className={`loading-state ${className}`} 
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: inline ? '0' : '40px 20px',
        gap: '12px',
      }}
    >
      <LoaderIcon size={sizes[size]} />
      {message && (
        <p style={{
          fontSize: '13px',
          color: 'rgba(255, 255, 255, 0.6)',
        }}>
          {message}
        </p>
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
      padding: '40px 20px',
      textAlign: 'center',
    }}>
      <div style={{
        width: '64px',
        height: '64px',
        borderRadius: '50%',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '16px',
      }}>
        <SearchIcon size={32} color="rgba(255, 255, 255, 0.4)" />
      </div>
      
      <h3 style={{
        fontSize: '16px',
        fontWeight: 600,
        color: 'white',
        marginBottom: '8px',
      }}>
        {title}
      </h3>
      
      {searchTerm && (
        <p style={{
          fontSize: '13px',
          color: 'rgba(255, 255, 255, 0.5)',
          marginBottom: '8px',
        }}>
          No matches for &ldquo;<strong>{searchTerm}</strong>&rdquo;
        </p>
      )}
      
      {description && (
        <p style={{
          fontSize: '13px',
          color: 'rgba(255, 255, 255, 0.4)',
          maxWidth: '280px',
          marginBottom: '20px',
        }}>
          {description}
        </p>
      )}

      {action && (
        <button
          onClick={action.onClick}
          style={{
            padding: '10px 20px',
            backgroundColor: 'var(--color-primary, #6366f1)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 500,
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
    text: { height: '1em', borderRadius: '4px' },
    rect: { borderRadius: radius || '8px' },
    circle: { borderRadius: '50%' },
  };

  return (
    <div 
      className={`skeleton ${className}`}
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        animation: 'pulse 1.5s ease-in-out infinite',
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
        padding: '16px',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      {showImage && (
        <Skeleton height={120} radius={8} />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
