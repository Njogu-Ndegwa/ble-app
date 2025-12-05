# OVES Design System

A comprehensive design system for consistent UI across the application.

## Structure

```
/styles
├── tokens.ts           # TypeScript design tokens
├── design-system.css   # CSS custom properties & utilities
├── index.ts            # TypeScript exports
└── README.md           # This file
```

## Quick Start

### In CSS/Components

All design tokens are available as CSS custom properties:

```css
.my-component {
  font-size: var(--font-base);
  color: var(--text-primary);
  padding: var(--space-4);
  border-radius: var(--radius-md);
}
```

### In TypeScript

```tsx
import { typography, colors, spacing } from '@/styles';

// Use tokens for inline styles or styled-components
const styles = {
  fontSize: typography.body.fontSize,
  color: colors.text.primary,
};
```

---

## Typography

### Font Families

| Variable | Value |
|----------|-------|
| `--font-sans` | 'Outfit', system fonts |
| `--font-mono` | 'DM Mono', monospace |

### Font Sizes

| Variable | Size | Usage |
|----------|------|-------|
| `--font-2xs` | 10px | Micro text, badges |
| `--font-xs` | 11px | Small labels, hints |
| `--font-sm` | 12px | Secondary text, form labels |
| `--font-base` | 14px | Default body text |
| `--font-md` | 15px | Slightly larger body |
| `--font-lg` | 16px | Small headings, card titles |
| `--font-xl` | 18px | Section headings |
| `--font-2xl` | 20px | Page titles |
| `--font-3xl` | 24px | Large titles |
| `--font-4xl` | 28px | Display text |
| `--font-5xl` | 32px | Hero text |

### Typography Classes

```html
<h1 class="text-h1">Page Title</h1>
<h2 class="text-h2">Section Title</h2>
<p class="text-body">Body text</p>
<span class="text-caption text-muted">Helper text</span>
<code class="text-mono">CODE123</code>
```

| Class | Usage |
|-------|-------|
| `.text-display` | Hero/display text (28px bold) |
| `.text-h1` | Primary headings (24px bold) |
| `.text-h2` | Section headings (20px semibold) |
| `.text-h3` | Sub-section headings (18px semibold) |
| `.text-h4` | Card titles (16px semibold) |
| `.text-h5` | Small headings (15px medium) |
| `.text-h6` | Mini headings (14px medium) |
| `.text-body-lg` | Large body (15px) |
| `.text-body` | Default body (14px) |
| `.text-body-sm` | Small body (12px) |
| `.text-caption` | Captions (11px) |
| `.text-label` | Form labels (12px medium) |
| `.text-mono` | Monospace text |

---

## Colors

### Brand Colors

| Variable | Value | Usage |
|----------|-------|-------|
| `--color-brand` | #00e5e5 | Primary brand cyan |
| `--color-brand-light` | #33ffff | Lighter variant |
| `--color-brand-dark` | #00b8b8 | Darker variant |

### Background Colors

| Variable | Usage |
|----------|-------|
| `--bg-primary` | Main page background |
| `--bg-secondary` | Slightly elevated |
| `--bg-tertiary` | More elevated |
| `--bg-elevated` | Cards, modals |
| `--bg-surface` | Interactive surfaces (5% white) |
| `--bg-surface-hover` | Hover state (8% white) |
| `--bg-surface-active` | Active state (12% white) |

### Text Colors

| Variable | Usage |
|----------|-------|
| `--text-primary` | Main text (#f0fafa) |
| `--text-secondary` | Secondary text (#94b8b8) |
| `--text-muted` | Muted/disabled text (#5a8080) |
| `--text-inverse` | Text on brand colors |

### Semantic Colors

| Variable | Soft Variant | Usage |
|----------|--------------|-------|
| `--color-success` | `--color-success-soft` | Positive actions, confirmations |
| `--color-warning` | `--color-warning-soft` | Warnings, cautions |
| `--color-error` | `--color-error-soft` | Errors, destructive actions |
| `--color-info` | `--color-info-soft` | Informational |

---

## Spacing

Based on a 4px grid. Use multiples of 4px for consistency.

| Variable | Value |
|----------|-------|
| `--space-0` | 0px |
| `--space-0-5` | 2px |
| `--space-1` | 4px |
| `--space-1-5` | 6px |
| `--space-2` | 8px |
| `--space-2-5` | 10px |
| `--space-3` | 12px |
| `--space-3-5` | 14px |
| `--space-4` | 16px |
| `--space-5` | 20px |
| `--space-6` | 24px |
| `--space-8` | 32px |
| `--space-10` | 40px |
| `--space-12` | 48px |
| `--space-16` | 64px |
| `--space-20` | 80px |

### Spacing Classes

```html
<div class="p-4 mb-3 gap-2">Content</div>
```

- `m-{n}`, `mt-{n}`, `mb-{n}`, etc. - Margins
- `p-{n}`, `px-{n}`, `py-{n}`, etc. - Padding
- `gap-{n}` - Flex/Grid gap

---

## Border Radius

| Variable | Value | Usage |
|----------|-------|-------|
| `--radius-none` | 0 | No rounding |
| `--radius-sm` | 4px | Subtle rounding |
| `--radius-md` | 8px | Standard (default) |
| `--radius-lg` | 12px | Cards, modals |
| `--radius-xl` | 16px | Large containers |
| `--radius-2xl` | 20px | Feature cards |
| `--radius-3xl` | 24px | Hero elements |
| `--radius-full` | 9999px | Circles, pills |

---

## Shadows

| Variable | Usage |
|----------|-------|
| `--shadow-sm` | Subtle elevation |
| `--shadow-md` | Standard elevation |
| `--shadow-lg` | High elevation |
| `--shadow-xl` | Highest elevation |
| `--shadow-card` | Card shadow |
| `--shadow-glow` | Brand glow effect |
| `--shadow-glow-success` | Success glow |
| `--shadow-glow-error` | Error glow |

---

## Transitions

| Variable | Duration | Usage |
|----------|----------|-------|
| `--transition-fast` | 100ms | Hover states |
| `--transition-normal` | 200ms | Default animations |
| `--transition-slow` | 300ms | Complex animations |

---

## Component Sizes

### Buttons

| Variable | Value |
|----------|-------|
| `--btn-height-sm` | 32px |
| `--btn-height-md` | 40px |
| `--btn-height-lg` | 48px |

### Inputs

| Variable | Value |
|----------|-------|
| `--input-height-sm` | 32px |
| `--input-height-md` | 40px |
| `--input-height-lg` | 48px |

### Avatars

| Variable | Value |
|----------|-------|
| `--avatar-xs` | 24px |
| `--avatar-sm` | 32px |
| `--avatar-md` | 40px |
| `--avatar-lg` | 48px |
| `--avatar-xl` | 64px |

### Icons

| Variable | Value |
|----------|-------|
| `--icon-xs` | 12px |
| `--icon-sm` | 16px |
| `--icon-md` | 20px |
| `--icon-lg` | 24px |
| `--icon-xl` | 32px |

---

## Z-Index

| Variable | Value | Usage |
|----------|-------|-------|
| `--z-base` | 0 | Default |
| `--z-dropdown` | 100 | Dropdowns |
| `--z-sticky` | 200 | Sticky elements |
| `--z-overlay` | 300 | Overlay backgrounds |
| `--z-modal` | 400 | Modal dialogs |
| `--z-popover` | 500 | Popovers |
| `--z-toast` | 600 | Toast notifications |
| `--z-tooltip` | 700 | Tooltips |
| `--z-max` | 9999 | Above everything |

---

## Light Theme

All variables automatically adjust for light mode when `data-theme="light"` is set on the HTML element.

```html
<html data-theme="light">
```

---

## Best Practices

1. **Always use variables** - Never hardcode colors, sizes, or spacing
2. **Use semantic names** - `--text-muted` not `#5a8080`
3. **Consistent spacing** - Stick to the 4px grid
4. **Typography hierarchy** - Use heading classes appropriately
5. **Responsive sizes** - Use relative units where appropriate

### Do ✅

```css
.card {
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  background: var(--bg-surface);
  color: var(--text-primary);
}
```

### Don't ❌

```css
.card {
  padding: 16px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
  color: #f0fafa;
}
```
