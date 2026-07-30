"use client";

import React from 'react';

export type ContentWidth = 'narrow' | 'default' | 'wide' | 'full';

interface ContentColumnProps {
  /** Which width token caps this column. Defaults to 'default'. */
  width?: ContentWidth;
  className?: string;
  children: React.ReactNode;
}

/**
 * ContentColumn — the single sanctioned way to cap content width.
 *
 * Maps to the --content-* tokens in design-system.css, which stay at the
 * phone width (430px) on mobile and widen at md/lg/xl breakpoints. Never
 * hardcode max-width / max-w-* in app code; use this instead.
 */
const ContentColumn: React.FC<ContentColumnProps> = ({
  width = 'default',
  className = '',
  children,
}) => (
  <div className={`content-col content-col--${width} ${className}`.trim()}>
    {children}
  </div>
);

export default ContentColumn;
