'use client';

import React from 'react';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AvatarVariant = 'default' | 'primary' | 'success' | 'warning' | 'error';

interface AvatarProps {
  /** Name to generate initials from */
  name?: string;
  /** First name (if separate from last name) */
  firstName?: string;
  /** Last name (if separate from first name) */
  lastName?: string;
  /** Direct initials override */
  initials?: string;
  /** Image URL */
  src?: string;
  /** Alt text for image */
  alt?: string;
  /** Size variant */
  size?: AvatarSize;
  /** Color variant */
  variant?: AvatarVariant;
  /** Custom className */
  className?: string;
  /** Custom style */
  style?: React.CSSProperties;
}

// Size mappings
const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: 'avatar-xs',
  sm: 'avatar-sm',
  md: 'avatar-md',
  lg: 'avatar-lg',
  xl: 'avatar-xl',
};

const SIZE_STYLES: Record<AvatarSize, React.CSSProperties> = {
  xs: { width: '24px', height: '24px', fontSize: '10px' },
  sm: { width: '32px', height: '32px', fontSize: '12px' },
  md: { width: '40px', height: '40px', fontSize: '14px' },
  lg: { width: '48px', height: '48px', fontSize: '16px' },
  xl: { width: '64px', height: '64px', fontSize: '20px' },
};

const VARIANT_CLASSES: Record<AvatarVariant, string> = {
  default: 'avatar-default',
  primary: 'avatar-primary',
  success: 'avatar-success',
  warning: 'avatar-warning',
  error: 'avatar-error',
};

/**
 * Get initials from name(s)
 */
export function getInitials(name?: string, firstName?: string, lastName?: string): string {
  if (firstName && lastName) {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  }
  if (name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }
  return '??';
}

/**
 * Avatar - User/entity avatar with initials or image
 * 
 * @example
 * <Avatar name="John Doe" size="md" />
 * <Avatar firstName="John" lastName="Doe" variant="primary" />
 * <Avatar src="/avatar.jpg" alt="User" />
 */
export default function Avatar({
  name,
  firstName,
  lastName,
  initials: initialsOverride,
  src,
  alt,
  size = 'md',
  variant = 'default',
  className = '',
  style,
}: AvatarProps) {
  const initials = initialsOverride || getInitials(name, firstName, lastName);
  const sizeClass = SIZE_CLASSES[size];
  const sizeStyle = SIZE_STYLES[size];
  const variantClass = VARIANT_CLASSES[variant];

  const baseStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    fontWeight: 600,
    textTransform: 'uppercase',
    flexShrink: 0,
    ...sizeStyle,
    ...style,
  };

  if (src) {
    return (
      <div 
        className={`avatar ${sizeClass} ${className}`}
        style={baseStyles}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img 
          src={src} 
          alt={alt || name || 'Avatar'} 
          style={{ 
            width: '100%', 
            height: '100%', 
            borderRadius: '50%',
            objectFit: 'cover',
          }} 
        />
      </div>
    );
  }

  return (
    <div 
      className={`avatar ${sizeClass} ${variantClass} ${className}`}
      style={baseStyles}
      title={name || `${firstName} ${lastName}`.trim()}
    >
      {initials}
    </div>
  );
}

// ============================================
// AVATAR GROUP
// ============================================

interface AvatarGroupProps {
  /** Maximum number of avatars to show */
  max?: number;
  /** Size for all avatars */
  size?: AvatarSize;
  /** Children (Avatar components) */
  children: React.ReactNode;
  /** Custom className */
  className?: string;
}

/**
 * AvatarGroup - Stack multiple avatars with overflow indicator
 */
export function AvatarGroup({
  max = 5,
  size = 'sm',
  children,
  className = '',
}: AvatarGroupProps) {
  const childArray = React.Children.toArray(children);
  const visibleChildren = childArray.slice(0, max);
  const remainingCount = childArray.length - max;

  return (
    <div 
      className={`avatar-group ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {visibleChildren.map((child, index) => (
        <div 
          key={index} 
          style={{ 
            marginLeft: index > 0 ? '-8px' : 0,
            zIndex: visibleChildren.length - index,
          }}
        >
          {React.isValidElement(child) 
            ? React.cloneElement(child as React.ReactElement<AvatarProps>, { size })
            : child
          }
        </div>
      ))}
      {remainingCount > 0 && (
        <Avatar
          initials={`+${remainingCount}`}
          size={size}
          variant="default"
          style={{ marginLeft: '-8px' }}
        />
      )}
    </div>
  );
}
