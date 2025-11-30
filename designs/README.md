# Oves Station App - Design System

A mobile-first attendant app for battery swapping stations built with HTML, CSS, and vanilla JavaScript.

---

## Fonts

### Primary Font
- **Outfit** - Used for all UI text (headings, body, labels, buttons)
- Weights: 300 (Light), 400 (Regular), 500 (Medium), 600 (SemiBold), 700 (Bold)

### Monospace Font
- **DM Mono** - Used for numerical values, IDs, codes, and prices
- Weights: 400 (Regular), 500 (Medium)

```css
font-family: 'Outfit', sans-serif;      /* Primary */
font-family: 'DM Mono', monospace;      /* Numbers/Codes */
```

---

## Typography Scale

| Size | CSS Variable | Use Case |
|------|--------------|----------|
| 9px | `--font-xs` | Tiny badges, price periods, "Coming Soon" badges |
| 10px | `--font-sm` | Labels, captions, form labels, stat labels |
| 11px | `--font-base` | Detail values, small mono text, receipt rows |
| 12px | `--font-md` | Body text, inputs, descriptions, buttons |
| 13px | `--font-lg` | Emphasized body, card names (customer, battery), main buttons |
| 18px | `--font-2xl` | Page/section titles (Scan Battery, Success, etc.) |
| 20px | `--font-3xl` | Large mono values (stat values), onboarding titles |
| 24px | `--font-4xl` | Hero values (battery charge percentage) |

### Font Weight Usage
- **300**: Subtle/light text
- **400**: Regular body text
- **500**: Medium emphasis, labels
- **600**: Card titles, section headers, buttons
- **700**: Page titles, important headings

---

## Color System

### Dark Theme (Default)

| Variable | Value | Use |
|----------|-------|-----|
| `--bg-primary` | `#0a0f0f` | Main background |
| `--bg-secondary` | `#0f1515` | Cards, elevated surfaces |
| `--bg-tertiary` | `#141c1c` | Input backgrounds, nested elements |
| `--bg-elevated` | `#1a2424` | Hover states, highlights |
| `--border` | `#1e2d2d` | Card borders, dividers |
| `--border-subtle` | `#172222` | Subtle separators |
| `--text-primary` | `#f0fafa` | Headings, primary text |
| `--text-secondary` | `#94b8b8` | Descriptions, subtitles |
| `--text-muted` | `#5a8080` | Captions, placeholders |

### Brand Colors (Omnivoltaic Cyan/Teal)

| Variable | Value | Use |
|----------|-------|-----|
| `--accent` | `#00e5e5` | Primary accent, active states |
| `--accent-light` | `#33ffff` | Hover states |
| `--accent-dark` | `#00b8b8` | Pressed states |
| `--accent-soft` | `rgba(0, 229, 229, 0.15)` | Soft backgrounds |
| `--accent-glow` | `rgba(0, 229, 229, 0.4)` | Glow effects |

### Semantic Colors

| Variable | Value | Use |
|----------|-------|-----|
| `--success` | `#00d9a0` | Success states, confirmations |
| `--success-soft` | `rgba(0, 217, 160, 0.15)` | Success backgrounds |
| `--error` | `#ff5a5a` | Error states, warnings |
| `--error-soft` | `rgba(255, 90, 90, 0.15)` | Error backgrounds |
| `--info` | `#00b4d8` | Info badges, highlights |
| `--info-soft` | `rgba(0, 180, 216, 0.15)` | Info backgrounds |

---

## Border Radius

| Variable | Value | Use |
|----------|-------|-----|
| `--radius-sm` | `8px` | Small elements, inputs |
| `--radius-md` | `12px` | Buttons, cards |
| `--radius-lg` | `16px` | Large cards, modals |
| `--radius-xl` | `24px` | Hero sections, major containers |

---

## Spacing Guidelines

### Margins (margin-bottom)
- **1-2px**: Tightly related elements (name + subtitle)
- **4-6px**: Related elements within a group
- **8-12px**: Separating sections within a card
- **16-24px**: Major section separations
- **32px+**: Large visual breaks

### Padding
- **4-6px**: Small elements, badges
- **8-12px**: Buttons, inputs, small cards
- **14-16px**: Standard cards
- **20px**: Screen padding, major containers

---

## Component Patterns

### Cards
```css
background: var(--bg-secondary);
border: 1px solid var(--border);
border-radius: var(--radius-lg);  /* 16px */
padding: 14px;
margin-bottom: 12px;
```

### Buttons
```css
padding: 12px 16px;
border-radius: var(--radius-md);  /* 12px */
font-size: 13px;
font-weight: 500;
```

### Form Inputs
```css
padding: 10px 12px;
border-radius: var(--radius-md);
font-size: 12px;
background: var(--bg-secondary);
border: 1px solid var(--border);
```

### Avatars
```css
width: 36px;
height: 36px;
border-radius: 50%;
font-size: 13px;
```

### Badges/Status Pills
```css
padding: 4px 10px;
border-radius: 16px;
font-size: 11px;
font-weight: 500;
```

---

## Screen Structure

### Header
- Fixed height, padding: `12px 20px`
- Contains: Logo (32px height), status badge, theme toggle

### Main Content
- Padding: `0 16px 90px` (bottom padding for action bar)
- Scrollable area

### Action Bar (Bottom)
- Fixed to bottom
- Gradient background fading up
- Padding: `12px 16px`
- Max-width: `430px` (mobile constraint)

---

## Progress Indicators

### Step Dots
- Inactive: `8px` circle, `var(--border)` background
- Active: `24px` pill, `var(--accent)` background
- Completed: `8px` circle, `var(--success)` background

---

## Animations

### Transitions
- Standard: `0.2s ease` or `0.25s ease`
- Theme transition: `0.3s ease`
- Loading animations: `1.2s ease-in-out infinite`

### Key Animations
- `pulse` - Status indicator pulse
- `scanLine` - Scanner sweep effect
- `batteryFill` - Splash screen battery charging
- `arrowBounce` - Directional indicators
- `loadingDot` - Loading state dots

---

## Responsive Breakpoints

### Height-based (Mobile-first)
```css
@media (max-height: 700px) {
    /* Compact mode for shorter screens */
}

@media (min-height: 800px) {
    /* Expanded mode for taller screens */
}
```

### Container Max-Width
- App container: `430px` (standard mobile width)

---

## File Structure

```
test-designs/
├── index.html          # Single-file app (HTML + CSS + JS)
├── README.md           # This file
└── assets/
    ├── Logo-Oves.png   # App logo
    ├── Bikes Oves.png  # Hero image (3 bikes)
    ├── Attendant.png   # Role icon
    ├── Sales.png       # Role icon
    ├── Keypad.png      # Role icon
    └── Rider.png       # Role icon
```

---

## Theme Support

- **Dark Mode** (Default): `:root` styles
- **Light Mode**: `[data-theme="light"]` override
- Theme preference saved to `localStorage` as `swapflow-theme`

---

## User Workflows

### Attendant Swap Flow (6 Steps)

| Step | Screen | Action | Purpose |
|------|--------|--------|---------|
| 1 | Scan Customer | Scan customer's QR code | Identify the customer |
| 2 | Scan Old Battery | Scan battery customer brought | Verify battery belongs to customer |
| 3 | Scan New Battery | Scan fresh battery to give | Select new battery for swap |
| 4 | Review & Cost | Display swap summary | Show energy differential & cost |
| 5 | Confirm Payment | Scan customer QR after payment | Confirm payment received |
| 6 | Success | Transaction complete | Show receipt & hand over battery |

**Energy Calculation:**
- Cost is based on energy differential between old battery (returned) and new battery (issued)
- Formula: `(New Battery % - Old Battery %) × Rate + Service Fee - Discounts`

### Sales Rep Flow (4 Steps)

| Step | Screen | Action | Purpose |
|------|--------|--------|---------|
| 1 | Customer Registration | Enter customer details | Collect name, phone, ID, vehicle info |
| 2 | Select Plan | Choose subscription | Weekly, Monthly, or Pay-Per-Swap |
| 3 | Assign Battery | Scan battery | Link battery to new customer |
| 4 | Success | Registration complete | Show summary & next steps |

---

## Key Design Principles

1. **Mobile-first**: Designed for handheld use by station attendants
2. **Minimal steps**: Complete tasks with least interaction
3. **High contrast**: Easy visibility in various lighting
4. **Consistent spacing**: 4px base unit system
5. **Clear hierarchy**: Typography scale creates visual order
6. **Feedback-rich**: Animations confirm user actions



