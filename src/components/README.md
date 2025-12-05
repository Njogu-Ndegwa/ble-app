# Components Architecture

This directory contains reusable components organized by their purpose and abstraction level.

## Directory Structure

```
/components
├── /ui                 # Pure UI Components (Presentational)
│   ├── Icons.tsx       # Centralized icon library
│   ├── Avatar.tsx      # User/entity avatars
│   ├── Badge.tsx       # Status badges and labels
│   ├── Button.tsx      # Button variants and groups
│   ├── Card.tsx        # Card containers and presets
│   ├── Form.tsx        # Form inputs and controls
│   ├── Layout.tsx      # Layout utilities
│   ├── Progress.tsx    # Progress indicators
│   ├── State.tsx       # Empty/error/loading states
│   └── index.ts        # Barrel export
│
├── /shared             # Workflow Components (Logic + UI)
│   ├── BatteryScanBind.tsx    # Battery scanning workflow
│   ├── BatteryCard.tsx        # Battery display card
│   ├── FlowTimeline.tsx       # Multi-step timeline
│   ├── FlowActionBar.tsx      # Bottom action bar
│   ├── PaymentCollection.tsx  # Payment interface
│   ├── SuccessReceipt.tsx     # Success/receipt display
│   ├── ScannerArea.tsx        # QR/barcode scanner UI
│   ├── InputModeToggle.tsx    # Scan/manual toggle
│   ├── /hooks
│   │   └── useBleScanner.ts   # BLE scanning logic
│   ├── types.ts               # Shared type definitions
│   └── index.ts               # Barrel export
│
└── Other existing components...
```

## Design Principles

### 1. Separation of Concerns

- **UI Components (`/ui`)**: Pure presentational components with no business logic
- **Shared Components (`/shared`)**: Workflow-specific components that combine UI with logic

### 2. UI Components

Located in `/ui`, these are **pure presentational components**:

- Accept data via props
- Emit events via callbacks
- No internal state management for business data
- Fully customizable via variants, sizes, and styles
- Consistent visual language across the app

#### Available UI Components

| Component | Description | Variants |
|-----------|-------------|----------|
| `Avatar` | User/entity avatar with initials or image | xs, sm, md, lg, xl |
| `AvatarGroup` | Stacked avatar display | - |
| `Badge` | Status/label badges | default, primary, success, warning, error |
| `StatusBadge` | Preset badges for common states | active, paid, due, connected, etc. |
| `Button` | Action buttons | primary, secondary, success, danger, ghost |
| `IconButton` | Icon-only button | Same as Button |
| `ButtonGroup` | Button container | row, column |
| `Card` | Container card | default, elevated, outlined, filled |
| `CustomerCard` | Customer info display | compact mode |
| `SelectableCard` | Card with selection indicator | radio, checkbox |
| `PreviewRow` | Key-value row for receipts | - |
| `StatCard` | Statistics display | with trend |
| `FormInput` | Text input with label/error | sm, md, lg |
| `FormGroup` | Field grouping | row, column |
| `FormSection` | Section with title | - |
| `FormRow` | Multi-column row | 2, 3, 4 columns |
| `ToggleGroup` | Option toggle (like tabs) | - |
| `EmptyState` | No data display | with action |
| `ErrorState` | Error with retry | - |
| `LoadingState` | Loading spinner | sm, md, lg |
| `NotFoundState` | Search no results | - |
| `Skeleton` | Loading placeholder | text, rect, circle |
| `SkeletonCard` | Card placeholder | with/without image |
| `ProgressBar` | Linear progress | default, success, warning, error |
| `QuotaBar` | Quota with icon | energy, swaps, custom |
| `StepProgress` | Step indicator | - |
| `CircularProgress` | Circular progress | - |
| `Screen` | Page/step container | with padding |
| `PageHeader` | Title + subtitle | left, center, right |
| `Grid` | CSS Grid layout | 1-4 columns, auto-fit |
| `Stack` | Flexbox stack | row, column |
| `Divider` | Visual separator | horizontal, vertical |
| `Spacer` | Empty space | fixed, auto |
| `Container` | Width constraint | sm, md, lg, xl |
| `Hint` | Helper text | with icon |

#### Icons

All icons are centralized in `Icons.tsx`:

```tsx
import { UserIcon, BatteryIcon, CheckIcon, Icon } from '@/components/ui';

// Direct use
<UserIcon size={24} color="white" />

// Dynamic use
<Icon name="check" size={18} />
```

### 3. Shared Components

Located in `/shared`, these combine UI with **workflow logic**:

| Component | Description | Used In |
|-----------|-------------|---------|
| `BatteryScanBind` | Full battery scan workflow (QR → BLE → Data) | Attendant, Sales |
| `BatteryCard` | Battery info display with charge level | Attendant, Sales |
| `FlowTimeline` | Step-by-step progress indicator | Attendant, Sales |
| `FlowActionBar` | Bottom navigation/action bar | Attendant, Sales |
| `PaymentCollection` | Payment interface with scan/manual input | Attendant, Sales |
| `SuccessReceipt` | Transaction success display | Attendant, Sales |
| `ScannerArea` | Scan trigger button | Multiple flows |
| `InputModeToggle` | Switch between scan/manual entry | Multiple flows |
| `useBleScanner` | Hook for BLE operations | Battery scanning |

## Usage Examples

### Using UI Components

```tsx
import { 
  Button, 
  Card, 
  Avatar, 
  Badge,
  FormInput,
  Grid 
} from '@/components/ui';

function MyComponent() {
  return (
    <Card variant="elevated">
      <div style={{ display: 'flex', gap: 12 }}>
        <Avatar name="John Doe" size="md" />
        <div>
          <h3>John Doe</h3>
          <Badge variant="success">Active</Badge>
        </div>
      </div>
      <FormInput 
        label="Email" 
        type="email" 
        required 
      />
      <Button variant="primary" fullWidth>
        Submit
      </Button>
    </Card>
  );
}
```

### Using Shared Components

```tsx
import { 
  BatteryScanBind, 
  FlowTimeline,
  FlowActionBar,
} from '@/components/shared';

function AttendantStep2() {
  return (
    <>
      <FlowTimeline 
        steps={ATTENDANT_STEPS} 
        currentStep={2} 
      />
      <BatteryScanBind
        mode="return"
        batteryData={oldBattery}
        onBatteryData={setOldBattery}
        scanState={bleScanState}
        onTriggerScan={handleScanTrigger}
      />
      <FlowActionBar
        onBack={handleBack}
        onAction={handleNext}
        actionLabel="Continue"
        actionDisabled={!oldBattery}
      />
    </>
  );
}
```

## Import Paths

```tsx
// UI Components
import { Button, Card, Avatar } from '@/components/ui';

// Shared Components  
import { BatteryScanBind, FlowTimeline } from '@/components/shared';

// Types
import type { BatteryData, BleScanState } from '@/components/shared';
```

## Adding New Components

1. **UI Component**: Add to `/ui` folder
   - Keep it pure (no business logic)
   - Export from `/ui/index.ts`
   - Support variants and customization

2. **Shared Component**: Add to `/shared` folder
   - Combine UI with workflow logic
   - Export from `/shared/index.ts`
   - Document which flows use it

## Benefits

- ✅ **Consistency**: Same UI across all screens
- ✅ **Reusability**: Write once, use everywhere
- ✅ **Maintainability**: Changes propagate automatically
- ✅ **Smaller Components**: Easy to understand and test
- ✅ **Clear Separation**: UI vs Logic
- ✅ **Type Safety**: Full TypeScript support
