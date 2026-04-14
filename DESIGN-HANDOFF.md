# Thesis Tracker -- Developer Handoff Specification

**Version**: 1.0
**Date**: 2026-04-14
**Source Documents**: PRD v2.1, UX Design Review, Architecture v2.0
**Tech Stack**: React 19, Tailwind CSS, Radix UI, TanStack Table, Tiptap Editor

---

## Table of Contents

1. [Design Tokens](#1-design-tokens)
2. [Global Layout](#2-global-layout)
3. [Holdings Dashboard](#3-holdings-dashboard)
4. [Add Holding Modal](#4-add-holding-modal)
5. [Thesis Document View](#5-thesis-document-view)
6. [Weekly Log](#6-weekly-log)
7. [Bulk Upload Flow](#7-bulk-upload-flow)
8. [Multi-Step Generation Progress](#8-multi-step-generation-progress)
9. [Broker Research Sidebar](#9-broker-research-sidebar)
10. [Shared Components](#10-shared-components)
11. [Responsive Strategy](#11-responsive-strategy)
12. [Animation and Motion](#12-animation-and-motion)
13. [Accessibility Checklist](#13-accessibility-checklist)

---

## 1. Design Tokens

All values defined as Tailwind config extensions in `tailwind.config.ts`. Use token names in code, never raw values.

### Colours

```ts
// tailwind.config.ts — extend colors
colors: {
  // Brand
  brand: {
    900: '#0F172A',  // Primary text, page headers
    800: '#1E293B',  // Secondary text, subheadings
    700: '#334155',  // Body text
    500: '#64748B',  // Muted text, placeholders
    200: '#E2E8F0',  // Borders, dividers
    100: '#F1F5F9',  // Table row hover, subtle backgrounds
    50:  '#F8FAFC',  // Page background
  },

  // Accent — used for primary actions
  accent: {
    600: '#2563EB',  // Primary button background, active links
    700: '#1D4ED8',  // Primary button hover
    100: '#DBEAFE',  // Focus ring background, selected tab underline
    50:  '#EFF6FF',  // Cmd+K backdrop, active filter chip background
  },

  // Semantic — thesis status
  status: {
    green: {
      700: '#15803D',  // "Strengthened" text
      100: '#DCFCE7',  // "Strengthened" badge background
    },
    red: {
      700: '#B91C1C',  // "Weakened" text
      100: '#FEE2E2',  // "Weakened" badge background
    },
    grey: {
      700: '#4B5563',  // "Unchanged" text
      100: '#F3F4F6',  // "Unchanged" badge background
    },
    blue: {
      700: '#1D4ED8',  // "Generating" / "New" text
      100: '#DBEAFE',  // "Generating" / "New" badge background
    },
  },

  // Severity — risk badges
  severity: {
    high:   { text: '#991B1B', bg: '#FEE2E2' },
    medium: { text: '#92400E', bg: '#FEF3C7' },
    low:    { text: '#166534', bg: '#DCFCE7' },
  },

  // Surface
  surface: {
    page:    '#F8FAFC',  // App background
    card:    '#FFFFFF',  // Cards, modals, sidebar
    overlay: 'rgba(15, 23, 42, 0.5)',  // Modal overlay
  },

  // Feedback
  error:   { text: '#B91C1C', bg: '#FEE2E2', border: '#FECACA' },
  success: { text: '#15803D', bg: '#DCFCE7', border: '#BBF7D0' },
  warning: { text: '#92400E', bg: '#FEF3C7', border: '#FDE68A' },
}
```

### Typography

```ts
// tailwind.config.ts — extend fontFamily and fontSize
fontFamily: {
  sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
  mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
}

// Custom type scale (use these class names)
// page-title:      text-2xl  font-semibold  tracking-tight  text-brand-900      (24px / 700)
// section-heading: text-lg   font-semibold  text-brand-900                      (18px / 600)
// card-title:      text-base font-medium    text-brand-800                      (16px / 500)
// body:            text-sm   font-normal    text-brand-700  leading-relaxed     (14px / 400)
// body-small:      text-xs   font-normal    text-brand-500                      (12px / 400)
// mono-data:       text-sm   font-mono      text-brand-700  tabular-nums        (14px / 400)
// label:           text-sm   font-medium    text-brand-800                      (14px / 500)
// helper:          text-xs   font-normal    text-brand-500                      (12px / 400)
// error-text:      text-xs   font-normal    text-error-text                     (12px / 400)
```

### Spacing Scale

Use Tailwind defaults. Key recurring values:

| Token | Value | Usage |
|-------|-------|-------|
| `p-1` / `gap-1` | 4px | Inline icon-to-text gap, badge internal padding |
| `p-2` / `gap-2` | 8px | Between filter chips, inside compact inputs |
| `p-3` / `gap-3` | 12px | Table cell padding, small card padding |
| `p-4` / `gap-4` | 16px | Standard card padding, section gap |
| `p-6` / `gap-6` | 24px | Page margin (horizontal), between major sections |
| `p-8` / `gap-8` | 32px | Between screen regions (e.g., header to table) |
| `p-10` / `gap-10` | 40px | Page top/bottom margin |

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `rounded-sm` | 2px | Badges only |
| `rounded-md` | 6px | Inputs, dropdowns, cards |
| `rounded-lg` | 8px | Modals, large cards |
| `rounded-full` | 9999px | Filter chips, avatar placeholders |

### Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Cards at rest, table container |
| `shadow-md` | `0 4px 6px rgba(0,0,0,0.07)` | Dropdowns, popovers |
| `shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals |

### Focus Ring

All focusable elements: `ring-2 ring-accent-600 ring-offset-2`. Apply via Tailwind `focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2`.

---

## 2. Global Layout

### App Shell

```
+--------------------------------------------------------------+
| Top Bar (h-14, fixed)                                         |
| [Logo: "Thesis Tracker"]            [+ Add Holding] [Upload] |
+--------------------------------------------------------------+
|                                                                |
|  Page Content (max-w-7xl, mx-auto, px-6, pt-6)               |
|                                                                |
+--------------------------------------------------------------+
```

- **No sidebar navigation.** The app has two views: Dashboard and Holding Detail. Navigation uses breadcrumbs in the top bar.
- **Top bar**: `h-14`, `bg-surface-card`, `border-b border-brand-200`, `px-6`, `flex items-center justify-between`. Fixed position, content scrolls beneath.
- **Logo**: `text-lg font-semibold text-brand-900`. Plain text, no icon. Clicking returns to Dashboard.
- **Content area**: `max-w-7xl mx-auto px-6 pt-6 pb-10`. Vertically scrollable.
- **Persistent bulk progress banner**: When a bulk job is running, a banner sits between top bar and content. Details in section 7.

### Page Transitions

No page transition animations. Use React Router. On navigation, scroll to top.

---

## 3. Holdings Dashboard

### Overview

The default and only "home" screen. A single sortable, filterable table of all holdings. The primary user task is: scan status at a glance, click to drill into a thesis.

### Layout

```
+--------------------------------------------------------------+
| Holdings                                          [+ Add Holding] [Upload Spreadsheet] |
+--------------------------------------------------------------+
| [Search bar: full width]                                      |
| [Filter chips: All | Long | Short | Strengthened | ...]      |
+--------------------------------------------------------------+
| Ticker  | Company  | Position | Thesis Date | Last Update | Status       | Week Chg |
|---------|----------|----------|-------------|-------------|--------------|----------|
| AAPL    | Apple    | Long     | Apr 10      | Apr 7       | Strengthened | +3.2%    |
| ...     |          |          |             |             |              |          |
+--------------------------------------------------------------+
```

### Component: `HoldingsPage`

Top-level page wrapper. No props. Fetches holdings via `useHoldings()` hook.

### Component: `SearchBar`

```tsx
interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;  // default: "Search holdings by ticker or company name..."
}
```

**Implementation details**:
- Full width of content area.
- `h-10`, `rounded-md`, `border border-brand-200`, `bg-surface-card`.
- Left-aligned search icon (Radix `MagnifyingGlassIcon`, 16px, `text-brand-500`).
- Right-aligned `Cmd+K` keyboard hint badge: `text-xs text-brand-500 border border-brand-200 rounded-sm px-1`. Hide on screens below `md` breakpoint.
- Input: `text-sm text-brand-700 placeholder:text-brand-500`.

**Keyboard shortcut**:
- `Cmd+K` (macOS) / `Ctrl+K` (Windows) focuses the search input. Register globally via `useEffect` with `keydown` listener. Also support `/` as a secondary shortcut.
- When focused, `Escape` clears the input and blurs it.

**Filtering behavior**:
- Filters client-side. Match against `ticker` and `companyName` fields. Case-insensitive. Match anywhere in string (not just prefix).
- Debounce: none needed (client-side filter is instant). Update on every keystroke.

**States**:

| State | Appearance |
|-------|------------|
| Default | Border `brand-200`, placeholder text visible, Cmd+K badge visible |
| Focused | Border `accent-600`, ring `ring-2 ring-accent-100`, Cmd+K badge hidden |
| With value | Clear button (X icon) appears at right, Cmd+K badge hidden |
| Empty results | Table shows empty state (see below) |

### Component: `FilterChips`

```tsx
interface FilterChipsProps {
  activeFilters: string[];  // e.g., ['Long', 'Strengthened']
  onToggle: (filter: string) => void;
}
```

**Chip options**: `All`, `Long`, `Short`, `Strengthened`, `Weakened`, `Unchanged`.

**Layout**: Horizontal flex row, `gap-2`, below search bar with `mt-3`.

**Chip styling**:

| State | Classes |
|-------|---------|
| Inactive | `bg-surface-card border border-brand-200 text-brand-700 text-sm px-3 py-1 rounded-full cursor-pointer` |
| Active | `bg-accent-50 border border-accent-600 text-accent-600 text-sm font-medium px-3 py-1 rounded-full cursor-pointer` |
| Hover (inactive) | `bg-brand-100` |

**Behavior**:
- `All` is the default active chip. Clicking `All` clears all other filters.
- Direction chips (`Long`/`Short`) are mutually exclusive with each other but can combine with status chips.
- Status chips (`Strengthened`/`Weakened`/`Unchanged`) can combine with each other and with direction chips.
- Clicking an active chip deselects it. If no chips are selected, auto-select `All`.

### Component: `HoldingsTable`

Built on **TanStack Table**. No virtualization needed in v1 (target is < 500 rows).

```tsx
interface HoldingsTableProps {
  data: Holding[];
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  onRowClick: (holdingId: string) => void;
}
```

**Columns**:

| Column | Width | Alignment | Sortable | Rendering |
|--------|-------|-----------|----------|-----------|
| Ticker | `w-[100px]` | Left | Yes | `font-medium text-brand-900`. Clicking the row navigates. |
| Company | `flex-1` (fills remaining space) | Left | Yes | `text-brand-700`. Truncate with ellipsis if > 1 line. |
| Position | `w-[90px]` | Left | Yes | `DirectionBadge` component |
| Thesis Date | `w-[110px]` | Left | Yes | `text-sm text-brand-500`. Format: `MMM D, YYYY` (e.g., "Apr 10, 2026") |
| Last Update | `w-[110px]` | Left | Yes | Same format as Thesis Date. If no updates: `--` |
| Status | `w-[130px]` | Left | Yes | `StatusBadge` component |
| Week Chg | `w-[90px]` | Right | Yes | `mono-data`. Green if positive, red if negative. `+X.X%` / `-X.X%` format. If no data: `--` |

**Table styling**:
- Container: `bg-surface-card rounded-lg shadow-sm border border-brand-200 overflow-hidden`.
- Header row: `bg-brand-50 border-b border-brand-200`.
- Header cells: `text-xs font-medium text-brand-500 uppercase tracking-wider px-3 py-3`. Sortable headers show a cursor pointer and sort arrow icon.
- Body rows: `border-b border-brand-100`. Entire row is clickable (navigates to thesis view).
- Row hover: `bg-brand-100 cursor-pointer`.
- Cell padding: `px-3 py-3`.
- Sort indicator: Up/down arrow icon next to sorted column header text. Unsorted columns show no icon (not a subtle double-arrow).

**Default sort**: Alphabetical by Ticker, ascending.

**Empty states**:

No holdings at all:
```
Centered in table area, py-16:
"No holdings yet."                            (section-heading)
"Add your first holding to generate           (body, text-brand-500, mt-2)
 an investment thesis."
[+ Add Holding]  [Upload Spreadsheet]         (buttons, mt-6, gap-3)
```

No results from search/filter:
```
Centered in table area, py-16:
"No holdings match your search."              (section-heading)
"Try a different ticker or clear              (body, text-brand-500, mt-2)
 your filters."
[Clear Filters]                               (text button, mt-4)
```

**Loading state**: Skeleton table. Column headers render immediately. 8 skeleton rows, each cell is a `h-4 bg-brand-100 rounded animate-pulse` bar with randomized widths (30%-80% of cell width). Respect `prefers-reduced-motion`: if enabled, use `opacity-60` instead of `animate-pulse`.

### Component: `StatusBadge`

```tsx
interface StatusBadgeProps {
  status: 'strengthened' | 'weakened' | 'unchanged' | 'generating' | 'new' | 'failed';
}
```

| Status | Background | Text | Border | Extra |
|--------|------------|------|--------|-------|
| strengthened | `status-green-100` | `status-green-700` | none | -- |
| weakened | `status-red-100` | `status-red-700` | none | -- |
| unchanged | `status-grey-100` | `status-grey-700` | none | -- |
| generating | `status-blue-100` | `status-blue-700` | none | Pulsing animation |
| new | `transparent` | `status-blue-700` | `border border-status-blue-700` | -- |
| failed | `error-bg` | `error-text` | none | -- |

All badges: `inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-sm`. Always include the text label. Never colour-only.

### Component: `DirectionBadge`

```tsx
interface DirectionBadgeProps {
  direction: 'long' | 'short';
}
```

- Long: `text-xs font-medium text-brand-700 bg-brand-100 px-2 py-0.5 rounded-sm`. Arrow up icon (optional).
- Short: Same styling but with `text-brand-500`. Arrow down icon (optional).

---

## 4. Add Holding Modal

### Overview

Triggered by `+ Add Holding` button. Opens as a Radix `Dialog` modal, not a new page. The modal collects ticker, direction, benchmark, thesis bullets, and optional file uploads, then triggers generation.

### Layout

```
+--------------------------------------------------+
| Add Holding                               [X]    |
+--------------------------------------------------+
|                                                    |
| Ticker          [_______________]                  |
| (helper text)                                      |
|                                                    |
| Position        [Long] [Short]                     |
|                                                    |
| Benchmark       [S&P 500         v]                |
| (helper text)                                      |
|                                                    |
| Your investment thesis                             |
| +------------------------------------------------+ |
| | Write your key arguments for this position...  | |
| |                                                | |
| | Example:                                       | |
| | Strong pricing power -- raised prices 8%...    | |
| +------------------------------------------------+ |
| (helper text)                                      |
|                                                    |
| Broker Research (optional)                         |
| +------------------------------------------------+ |
| |  [icon] Drag and drop PDF or DOCX here,       | |
| |         or click to browse.                    | |
| +------------------------------------------------+ |
|                                                    |
|                     [Cancel]  [Generate Thesis]    |
+--------------------------------------------------+
```

### Modal Container

- Radix `Dialog.Root` + `Dialog.Portal` + `Dialog.Overlay` + `Dialog.Content`.
- Overlay: `bg-surface-overlay backdrop-blur-sm`.
- Content: `bg-surface-card rounded-lg shadow-lg w-full max-w-lg mx-4 p-6`. Centered vertically and horizontally. Max height: `max-h-[90vh]`, overflow: `overflow-y-auto`.
- Close button: Radix `Dialog.Close`, top right, `p-2 text-brand-500 hover:text-brand-900`.
- Title: `Dialog.Title`, `text-lg font-semibold text-brand-900`.

### Component: `AddHoldingModal`

```tsx
interface AddHoldingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: AddHoldingInput) => void;
}

interface AddHoldingInput {
  ticker: string;
  direction: 'long' | 'short';
  benchmark: string;
  bullets: string;
  files: File[];
}
```

### Form Fields

#### Ticker Input

- Label: `"Ticker"` (label class).
- Input: `h-10 w-full rounded-md border border-brand-200 px-3 text-sm text-brand-700`.
- Placeholder: `"e.g., AAPL, TSLA, VOD.L"`.
- Helper: `"Use the exchange-specific format for non-US stocks (e.g., VOD.L for London)."` (helper class, `mt-1`).
- Validation: Required. Show error state on blur if empty.
- Error message: `"Ticker is required."` or `"Enter a valid ticker symbol."` (error-text class, `mt-1`).
- Error state: `border-error-border` replaces default border. Error message appears below helper text.

**States**:

| State | Border | Background |
|-------|--------|------------|
| Default | `brand-200` | `surface-card` |
| Hover | `brand-300` | `surface-card` |
| Focus | `accent-600` + focus ring | `surface-card` |
| Error | `error-border` | `surface-card` |
| Error + Focus | `error-border` + `ring-2 ring-error-bg` | `surface-card` |

#### Position Toggle

- Label: `"Position"` (label class).
- Implementation: Radix `ToggleGroup.Root` with `type="single"`.
- Two items: `"Long"` and `"Short"`.
- Default: `"Long"` selected.
- Container: `inline-flex rounded-md border border-brand-200 overflow-hidden`.
- Item: `px-4 py-2 text-sm font-medium`.
- Selected: `bg-accent-600 text-white`.
- Unselected: `bg-surface-card text-brand-700 hover:bg-brand-100`.

#### Benchmark Dropdown

- Label: `"Benchmark"` (label class).
- Implementation: Radix `Select.Root`.
- Default value: `"S&P 500"`.
- Helper: `"Performance will be measured against this index."` (helper class).
- Options:
  - S&P 500
  - NASDAQ Composite
  - FTSE 100
  - Euro Stoxx 50
  - Nikkei 225
  - Hang Seng
  - ASX 200
- Trigger styling: Same as text input (`h-10 w-full rounded-md border border-brand-200 px-3 text-sm`).
- Dropdown content: `bg-surface-card rounded-md shadow-md border border-brand-200 py-1`.
- Item: `px-3 py-2 text-sm text-brand-700 hover:bg-brand-100 cursor-pointer`.
- Selected item: `font-medium` with a checkmark icon on the left.

#### Thesis Bullets Textarea

- Label: `"Your investment thesis"` (label class).
- Textarea: `w-full min-h-[160px] rounded-md border border-brand-200 p-3 text-sm text-brand-700 leading-relaxed resize-y`.
- Placeholder (appears as dimmed text inside the textarea):
  ```
  Write your key arguments for this position, one per line.

  Example:
  Strong pricing power -- raised prices 8% with no volume loss
  Market share gains of 3pp in Q1, driven by new product launch
  FCF yield of 8% supports aggressive buyback program
  Key risk: EU regulatory review expected Q3 2026
  ```
- Helper: `"The more specific you are, the better the generated thesis. Include your conviction, key data points, and known risks."` (helper class, `mt-1`).
- Validation: Required. Error message: `"Enter at least one argument for your thesis."`.
- Same focus/error states as Ticker Input.

#### Broker Research Upload

- Label: `"Broker Research"` with `"(optional)"` appended in `text-brand-500 font-normal`.
- Implementation: `FileDropZone` component (see section 10).
- Drop zone: `min-h-[80px] border-2 border-dashed border-brand-200 rounded-md flex flex-col items-center justify-center p-4 cursor-pointer`.
- Icon: Upload cloud icon, 24px, `text-brand-400`.
- Text: `"Drag and drop PDF or DOCX files here, or click to browse."` (body-small, `text-brand-500`).
- Constraint: `"PDF or DOCX, up to 50 MB per file."` (body-small, `text-brand-400 mt-1`).
- After file selected: Show filename with file icon, file size, and a remove button (X icon). Each file is a row: `flex items-center gap-2 text-sm text-brand-700 py-1`.
- Accept: `.pdf,.docx` MIME types.

**Drop zone states**:

| State | Border | Background |
|-------|--------|------------|
| Default | `border-brand-200` dashed | `transparent` |
| Hover / Drag over | `border-accent-600` dashed | `accent-50` |
| Invalid file drag | `border-error-border` dashed | `error-bg` |
| File selected | Hidden (replaced by file list) | -- |

### Buttons

- `Cancel`: Radix `Dialog.Close`. `text-sm font-medium text-brand-700 hover:text-brand-900 px-4 py-2`.
- `Generate Thesis`: Primary button. `bg-accent-600 hover:bg-accent-700 text-white text-sm font-medium px-4 py-2.5 rounded-md`. Disabled (`opacity-50 cursor-not-allowed`) until Ticker and Bullets are non-empty.

**Button area**: `flex justify-end gap-3 mt-6 pt-4 border-t border-brand-200`.

### Submission Behavior

On submit:
1. Validate all required fields. Show inline errors if invalid.
2. Disable `Generate Thesis` button. Change label to `"Generating..."` with a small spinner icon.
3. POST to `/api/holdings` then POST to `/api/holdings/:id/generate`.
4. Close modal. Navigate to thesis detail page. Show multi-step progress (section 8).

---

## 5. Thesis Document View

### Overview

The main view when a user clicks a holding. Displays the complete thesis using a tabbed layout. All content is editable inline.

### Layout

```
+--------------------------------------------------------------+
| < Holdings / AAPL                                              |
+--------------------------------------------------------------+
| Apple Inc. (AAPL)                                    Long     |
| Generated: Apr 10, 2026 | Benchmark: S&P 500                  |
|                                   [Revise Thesis] [Export PDF] |
+--------------------------------------------------------------+
| [Summary+Pillars] [Quality+Valuation] [Assumptions+Risks]     |
| [Sources] [Weekly Log (12)]                                    |
+--------------------------------------------------------------+
|                                                                |
|  (Active tab content)                                          |
|                                                                |
+--------------------------------------------------------------+
```

### Component: `ThesisDetailPage`

Top-level page. Fetches holding + thesis + logs via `useThesis(holdingId)`.

```tsx
interface ThesisDetailPageProps {
  holdingId: string;  // from route params
}
```

### Header Section

**Breadcrumb**: `< Holdings / AAPL`. The `<` is a back arrow icon (Radix `ArrowLeftIcon`). `"Holdings"` is a link (`text-brand-500 hover:text-accent-600`). `"/ AAPL"` is current page (`text-brand-900 font-medium`). Container: `flex items-center gap-2 text-sm`.

**Company name**: `text-2xl font-semibold text-brand-900 mt-4`.

**Direction**: `DirectionBadge` right-aligned in the same row as company name. Use `flex justify-between items-start`.

**Meta line**: `text-sm text-brand-500 mt-1`. Format: `"Generated: Apr 10, 2026 | Benchmark: S&P 500"`. Pipe separator with `mx-2`.

**Action buttons**: Right-aligned below meta line. `flex gap-3 mt-3`.
- `Revise Thesis`: Secondary button. `border border-brand-200 text-brand-700 hover:bg-brand-100 text-sm font-medium px-3 py-2 rounded-md`.
- `Export PDF`: Secondary button. Same styling. P1 feature -- show as disabled in v1 with a tooltip: `"Coming soon"`.

### Tab Navigation

Implementation: Radix `Tabs.Root` + `Tabs.List` + `Tabs.Trigger` + `Tabs.Content`.

**Tabs**:

| Tab Label | Value | Content |
|-----------|-------|---------|
| Summary + Pillars | `summary` | Investment thesis narrative + pillar cards |
| Quality + Valuation | `quality` | Quality assessment + valuation scenarios |
| Assumptions + Risks | `risks` | Key assumptions list + risks list |
| Sources | `sources` | Sources list + broker research sidebar |
| Weekly Log (N) | `log` | Full weekly log timeline |

**Tab bar styling**:
- Container: `border-b border-brand-200 mt-6`.
- Tab trigger: `px-4 py-3 text-sm font-medium text-brand-500 hover:text-brand-900 border-b-2 border-transparent`.
- Active tab: `text-accent-600 border-b-2 border-accent-600`.
- The `(N)` count on Weekly Log is a `bg-brand-100 text-brand-700 text-xs font-medium px-1.5 py-0.5 rounded-full ml-1.5` badge.

**ARIA**: `role="tablist"` on container. Each trigger: `role="tab"`, `aria-selected`. Each content: `role="tabpanel"`, `aria-labelledby`.

**Default tab**: `summary` when navigating from Dashboard. If arriving from a "weekly update" notification, default to `log`.

### Tab Content: Summary + Pillars

#### Investment Thesis Section

- No explicit section heading (it is the first thing visible in the tab).
- Content: 2-3 paragraphs of narrative text.
- Styling: `text-sm text-brand-700 leading-relaxed` on a card: `bg-surface-card rounded-lg p-6 shadow-sm border border-brand-200`.
- Click-to-edit behavior (see inline editing spec below).

#### Thesis Pillars Section

- Heading: `"Thesis Pillars"`, section-heading class, `mt-8`.
- Each pillar is a `PillarCard` component.

```tsx
interface PillarCardProps {
  pillar: {
    id: string;
    title: string;
    body: string;
    sortOrder: number;
  };
  totalPillars: number;
  onUpdate: (id: string, data: Partial<Pillar>) => void;
  onDelete: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
}
```

**Pillar card layout**:
```
+------------------------------------------------------+
| Pillar 1                                   [v] [^] [x] |
| Pricing Power in Inflationary Environment              |
| [2-3 sentences of evidence]                            |
+------------------------------------------------------+
```

- Card: `bg-surface-card rounded-lg p-4 shadow-sm border border-brand-200 mt-3`.
- Pillar number: `text-xs font-medium text-brand-500 uppercase tracking-wider`.
- Pillar title: `text-base font-medium text-brand-900 mt-1`. Click to edit.
- Pillar body: `text-sm text-brand-700 leading-relaxed mt-2`. Click to edit.
- Controls (top right, visible on hover or focus-within):
  - Move up: `ArrowUpIcon`, disabled if first pillar.
  - Move down: `ArrowDownIcon`, disabled if last pillar.
  - Delete: `TrashIcon`, triggers confirmation (see below).
  - All controls: `p-1 text-brand-400 hover:text-brand-700 rounded`.
- Keyboard reorder: When pillar is focused, `Alt+ArrowUp` and `Alt+ArrowDown` reorder. Announce change via `aria-live`.

**"Add Pillar" button**: Below last pillar card. `text-sm text-accent-600 hover:text-accent-700 font-medium flex items-center gap-1.5`. Plus icon. Only shown if fewer than 5 pillars exist.

**Delete pillar confirmation**: Radix `AlertDialog`. Title: `"Remove this pillar?"`. Description: `"Pillar [N]: [Title] will be permanently removed."`. Buttons: `[Cancel]` (secondary), `[Remove]` (destructive: `bg-red-600 hover:bg-red-700 text-white`).

### Tab Content: Quality + Valuation

#### Quality Assessment

- Heading: `"Quality Assessment"`, section-heading.
- Three subsections displayed as a 1-column list of labeled blocks:

```
Financial Strength
[Click-to-edit narrative text: ROIC, margins, FCF, leverage...]

Competitive Position
[Click-to-edit narrative text: moat, disruption risk, market position...]

ESG & Governance
[Click-to-edit narrative text or "None identified"]
```

- Subsection label: `text-sm font-medium text-brand-800 mt-4 first:mt-0`.
- Subsection body: `text-sm text-brand-700 leading-relaxed mt-1`. Click to edit.
- Container card: `bg-surface-card rounded-lg p-6 shadow-sm border border-brand-200`.

#### Valuation and Expected Return

- Heading: `"Valuation & Expected Return"`, section-heading, `mt-8`.
- Layout: Structured key-value pairs.

```
Current Price        $187.42
Investment Goal      Re-rate to sector median P/E over 12-18 months

Upside Case          [Editable text]
Base Case            [Editable text]
Downside Case        [Editable text]
```

- Container card: Same as Quality.
- Key: `text-sm font-medium text-brand-500 w-[160px] shrink-0`.
- Value: `text-sm text-brand-700`. Click to edit for text fields.
- Use a `dl` / `dt` / `dd` layout for semantics.
- Rows: `flex gap-4 py-2 border-b border-brand-100 last:border-0`.

### Tab Content: Assumptions + Risks

#### Key Assumptions

- Heading: `"Key Assumptions"`, section-heading.
- Each assumption is a structured row.

```tsx
interface AssumptionRowProps {
  assumption: { id: string; text: string; sortOrder: number };
  onUpdate: (id: string, text: string) => void;
  onDelete: (id: string) => void;
}
```

- Row layout: Bullet icon + editable text + delete button.
- Bullet: `w-1.5 h-1.5 rounded-full bg-brand-400 mt-2 shrink-0`.
- Text: `text-sm text-brand-700 leading-relaxed`. Click to edit.
- Delete: `TrashIcon`, `text-brand-300 hover:text-red-600`, visible on hover/focus.
- "Add Assumption" link below the list. Same style as "Add Pillar".
- Container card: Same styling as other sections.

#### Risks

- Heading: `"Risks"`, section-heading, `mt-8`.
- Each risk is a structured row with severity.

```tsx
interface RiskRowProps {
  risk: { id: string; text: string; severity: 'high' | 'medium' | 'low'; sortOrder: number };
  onUpdate: (id: string, data: Partial<Risk>) => void;
  onDelete: (id: string) => void;
}
```

- Row layout: Severity badge + editable text + delete button.
- Severity badge: `SeverityBadge` component. Radix `Select` dropdown on click to change severity.

```tsx
interface SeverityBadgeProps {
  severity: 'high' | 'medium' | 'low';
  editable?: boolean;
  onChange?: (severity: 'high' | 'medium' | 'low') => void;
}
```

| Severity | Background | Text |
|----------|------------|------|
| High | `severity-high-bg` | `severity-high-text` |
| Medium | `severity-medium-bg` | `severity-medium-text` |
| Low | `severity-low-bg` | `severity-low-text` |

Badge styling: `text-xs font-medium px-2 py-0.5 rounded-sm cursor-pointer`.

- "Add Risk" link below the list. Same style as "Add Pillar".
- Container card: Same styling.

### Tab Content: Sources

- Heading: `"Sources & Research"`, section-heading.
- Two groups: **Web Sources** and **Broker Research**.

**Web sources**: Bulleted list.
- Each source: `text-sm text-accent-600 hover:underline` (linked) + date in `text-brand-500 ml-2`.
- Format: `"Reuters: Apple Q1 Earnings Beat Expectations — Apr 5, 2026"`.

**Broker Research**: Rendered by `BrokerResearchSidebar` component (section 9), embedded in this tab as the lower section rather than a sidebar.

### Tab Content: Weekly Log

See section 6 for full specification.

### Inline Editing Specification

Used across all narrative and structured sections of the thesis.

**Component: `EditableText`**

```tsx
interface EditableTextProps {
  value: string;
  onSave: (newValue: string) => void;
  multiline?: boolean;       // default: false — single line input vs textarea
  placeholder?: string;
  className?: string;        // pass-through for display text styling
}
```

**State machine**:

```
DISPLAY ──(click/Enter)──> EDITING ──(blur/Escape)──> SAVING ──(success)──> DISPLAY
                                                          └──(error)──> EDITING (with error)
```

**Display state**:
- Renders the text with the passed `className`.
- On hover: `outline outline-1 outline-brand-200 rounded -m-2 p-2` (subtle editable hint). Use negative margin + padding so the outline does not shift layout.
- Cursor: `cursor-text`.
- `aria-label`: `"Edit [section name]. Click or press Enter to edit."`.
- `role="button"`, `tabIndex={0}`.

**Editing state**:
- Replace text with a Tiptap editor instance (for multiline narrative) or a plain `<input>` (for single-line fields like pillar titles).
- The editor/input is pre-filled with the current value, focused, with text selected.
- Tiptap config: Minimal toolbar. Support **bold**, *italic*, bullet lists only. No headings, no images, no tables. The toolbar appears above the editing area only when text is selected (floating toolbar pattern).
- Border: `border border-accent-600 rounded-md`.
- `Escape`: Revert changes, exit edit mode. Announce `"Edit cancelled"` via `aria-live`.

**Saving state**:
- On blur (or explicit save): Debounce 500ms, then PATCH to API.
- Show a small `"Saving..."` indicator: `text-xs text-brand-400` positioned absolute top-right of the editing block.
- On success: Replace with `"Saved"` + checkmark for 1.5s, then fade out. Announce `"Changes saved"` to `aria-live="polite"` region.
- On failure: Show `"Failed to save. Click to retry."` in `text-xs text-error-text`. Keep the editor open with the user's changes.

**First-time hint**: On the first visit to any thesis view, show a dismissible banner above the tab content: `"Click any section to edit. Changes save automatically."`. Styling: `bg-accent-50 text-accent-600 text-sm px-4 py-2.5 rounded-md flex items-center justify-between`. Dismiss button: X icon. Persist dismissal in `localStorage`.

---

## 6. Weekly Log

### Overview

The living section of the thesis. Reverse-chronological entries with a two-tier layout: a numeric summary line (always visible) and an expandable narrative below.

### Layout

```
+--------------------------------------------------------------+
| Weekly Log                                                     |
+--------------------------------------------------------------+
| Week of Apr 7, 2026     +3.2%   vs S&P: +1.8%  [Strengthened] |
| > Pillar 2 strengthened: Q1 earnings confirmed 3pp market...  |
|   Sources: Reuters (Apr 5), Morgan Stanley note (Apr 3)        |
+--------------------------------------------------------------+
| Week of Mar 31, 2026    -1.1%   vs S&P: -0.3%  [Weakened]     |
| > Pillar 1 weakened: Competitor announced aggressive...        |
|   Sources: Bloomberg (Mar 29)                                  |
+--------------------------------------------------------------+
| Week of Mar 24, 2026    +0.8%   vs S&P: +0.2%  [Unchanged]    |  <-- collapsed
+--------------------------------------------------------------+
```

### Component: `WeeklyLog`

```tsx
interface WeeklyLogProps {
  entries: WeeklyLogEntry[];
  benchmarkName: string;
}

interface WeeklyLogEntry {
  id: string;
  weekDate: string;         // ISO date string
  priceChangePct: number | null;
  indexChangePct: number | null;
  relativePerf: number | null;
  thesisImpact: 'strengthened' | 'weakened' | 'unchanged' | 'failed';
  summary: string;
  pillarRefs: { pillarId: string; pillarTitle: string; impact: string }[];
  sources: { title: string; date: string; url?: string }[];
}
```

### Component: `WeeklyLogEntry`

```tsx
interface WeeklyLogEntryProps {
  entry: WeeklyLogEntry;
  benchmarkName: string;
  defaultExpanded: boolean;  // true for first 4 entries
}
```

**Tier 1 (always visible)**:

Layout: `flex items-center justify-between py-3 px-4 cursor-pointer`.

| Element | Styling | Notes |
|---------|---------|-------|
| Date | `text-sm font-medium text-brand-900 w-[180px]` | Format: `"Week of Apr 7, 2026"` |
| Price change | `text-sm font-mono tabular-nums w-[70px] text-right` | Green if positive, red if negative. `+X.X%` format |
| vs Index | `text-sm font-mono tabular-nums text-brand-500 w-[120px] text-right` | Format: `"vs S&P: +1.8%"`. Green/red colouring |
| Status badge | `StatusBadge` component, `w-[110px]` | Right-aligned |
| Expand/collapse | Radix `ChevronDownIcon` / `ChevronUpIcon`, `text-brand-400 w-5 h-5` | Rotates on toggle |

When price data unavailable: Show `"Price unavailable"` in `text-brand-400 italic` in place of price and vs index.

**Tier 2 (expandable narrative)**:

- Container: `px-4 pb-4 pt-0 ml-0`.
- Toggle: Use `<details>` / `<summary>` natively, styled via Tailwind, OR use Radix `Collapsible`. Apply `aria-expanded` to the Tier 1 row.
- Narrative text: `text-sm text-brand-700 leading-relaxed`.
- Pillar and assumption references in the text should be `font-medium` (bold).
- Sources line: `text-xs text-brand-500 mt-2 italic`. Format: `"Sources: Reuters (Apr 5), Morgan Stanley note (Apr 3)"`.

**Expand/collapse behavior**:
- Default: First 4 entries expanded, rest collapsed.
- Click Tier 1 row to toggle.
- Keyboard: `Enter` or `Space` on focused Tier 1 row toggles.
- Animation: Collapsible content uses `transition-all duration-200 ease-out`. Height animates from 0 to auto (use CSS `grid-template-rows: 0fr` to `1fr` trick for smooth animation, or Radix `Collapsible` with `forceMount` + CSS).

**Entry separator**: `border-b border-brand-100` between entries. Last entry has no bottom border.

**Container**: `bg-surface-card rounded-lg shadow-sm border border-brand-200 overflow-hidden`.

**Empty state** (no entries):
```
Centered, py-12:
"No weekly updates yet."                             (card-title)
"The first update will appear after the next         (body, text-brand-500, mt-2)
 scheduled monitoring run on Monday, [date]."
```

**Failed entry**:
```
Tier 1: Week of Apr 7, 2026    --    --    [Update Failed]
Tier 2: "Weekly analysis could not be completed. Reason: [error text].
         This will be retried automatically."
         [Retry Now] button (text-sm, accent)
```

**Loading state** (during weekly monitoring): The most recent row shows `StatusBadge` with `"Updating..."` status (pulsing blue badge). Tier 2 shows skeleton text (2 lines, pulsing).

---

## 7. Bulk Upload Flow

### Overview

Multi-step flow for importing a portfolio from a spreadsheet. Steps: File Upload, Validation/Preview, Generation Progress, Results.

### Step 1: File Upload

Triggered by `Upload Spreadsheet` button on dashboard. Opens as a Radix `Dialog` modal.

**Modal title**: `"Import Holdings from Spreadsheet"`.

**Instructions block**: `bg-brand-50 rounded-md p-4 text-sm text-brand-700 mb-4`.
```
Upload an Excel (.xlsx) or CSV file with your holdings. Each row becomes a thesis.

Required columns: Ticker, Direction (Long or Short), Thesis Bullets

[Download Template]
```

`Download Template` link: `text-accent-600 hover:underline font-medium`. Triggers download of `.xlsx` template file.

**Drop zone**: `FileDropZone` component.
- Size: `min-h-[200px] w-full`.
- States: Same as Add Holding file drop zone.
- Accepted types: `.xlsx`, `.csv`.
- After file selected: Show filename + file size + replace button. Transition to validation.

### Step 2: Validation / Preview

Replaces drop zone content in the same modal. Modal widens to `max-w-3xl`.

**Validating state**: `"Reviewing your file..."` with a spinner. Brief (< 2 seconds typically).

**Success (all rows valid)**:
```
[check icon] 47 holdings found. Ready to generate.

| #  | Ticker | Direction | Bullets Preview              | [Remove] |
|----|--------|-----------|------------------------------|----------|
| 1  | AAPL   | Long      | Strong pricing power, mar... | [x]      |
| 2  | TSLA   | Short     | Margin compression from...   | [x]      |
...

                                            [Cancel]  [Generate All]
```

**With errors**:
```
[warning icon] 47 rows found. 3 need attention.

Rows with errors are highlighted. Fix them below or remove them to continue.
```

Error rows: `bg-error-bg/50` background on the entire row. Error column shows the issue in `text-error-text text-xs`.

**Validation table**: Use TanStack Table. Columns:

| Column | Width | Notes |
|--------|-------|-------|
| # | `w-[50px]` | Row number |
| Ticker | `w-[100px]` | Editable inline if error |
| Direction | `w-[90px]` | Editable inline if error (dropdown) |
| Bullets Preview | `flex-1` | Truncated to 1 line, ellipsis. Tooltip shows full text on hover. |
| Issue | `w-[150px]` | Only shown if errors exist. Red text. |
| Remove | `w-[50px]` | X icon button |

**Buttons for error state**:
- `Skip Errors and Generate [N]`: Secondary button. Label dynamically shows valid count.
- `Cancel`: Text button.

### Step 3: Generation Progress

Modal closes. A **persistent banner** appears between the top bar and page content on every page.

### Component: `BulkProgressBanner`

```tsx
interface BulkProgressBannerProps {
  jobId: string;
  total: number;
  completed: number;
  failed: number;
  estimatedTimeRemaining: string | null;  // e.g., "4 minutes"
  onCancel: () => void;
  onViewDetails: () => void;
}
```

**Layout**: Full-width bar, `bg-accent-50 border-b border-accent-100 px-6 py-3`.

```
Generating theses: 12 of 47 complete.     [============================__________] 60%     ~4 min remaining     [Cancel Remaining]
```

| Element | Styling |
|---------|---------|
| Status text | `text-sm font-medium text-accent-700` |
| Progress bar | `h-2 bg-brand-200 rounded-full overflow-hidden` container. Fill: `bg-accent-600 rounded-full transition-all duration-300`. |
| ETA | `text-sm text-brand-500` |
| Cancel | `text-sm text-brand-500 hover:text-brand-700 underline` |

Progress bar width: `(completed / total) * 100%`.

**ETA calculation**: Track average time per completed thesis. `estimatedTimeRemaining = avgTime * (total - completed)`. Format as minutes (rounded up). Show `"Less than a minute"` when under 60s.

**WebSocket**: Subscribe to `bulk:{jobId}` channel. Events: `progress` (count update), `complete`, `error` (per-row).

### Step 4: Results

When the bulk job completes, the banner changes to a completion state.

**All succeeded**:
```
All 47 theses generated successfully.                                                   [View Dashboard] [Dismiss]
```
`bg-success-bg border-b border-success-border`.

**With failures**:
```
44 of 47 theses generated. 3 failed.                                                    [View Details] [Dismiss]
```
`bg-warning-bg border-b border-warning-border`.

`View Details` opens a result modal:

```
+--------------------------------------------------+
| Import Results                            [X]     |
+--------------------------------------------------+
| 44 succeeded. 3 failed.                           |
|                                                    |
| Failed:                                            |
| | Ticker | Error                        | Action | |
| |--------|------------------------------|--------| |
| | XYZ    | No market data found.        | [Retry]| |
| | ABC    | Generation timed out.        | [Retry]| |
| | DEF    | Unable to parse broker file. | [Retry]| |
|                                                    |
|                    [Retry All Failed]  [Done]      |
+--------------------------------------------------+
```

**Result table columns**:

| Column | Width | Notes |
|--------|-------|-------|
| Ticker | `w-[100px]` | `font-medium text-brand-900` |
| Error | `flex-1` | `text-sm text-error-text` |
| Action | `w-[80px]` | `Retry` text button, `text-accent-600 hover:underline` |

**Retry behavior**: Clicking `Retry` on a row triggers generation for that single holding. The row shows a spinner during retry. On success: row disappears from error table and appears on dashboard. On failure again: error message updates.

`Retry All Failed`: Triggers all failed rows simultaneously. Banner reappears with progress.

---

## 8. Multi-Step Generation Progress

### Overview

Shown when generating a single thesis (from Add Holding or Revise Thesis). Appears on the thesis detail page immediately after submission.

### Component: `GenerationProgress`

```tsx
interface GenerationProgressProps {
  ticker: string;
  steps: GenerationStep[];
  onCancel: () => void;
}

interface GenerationStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
}
```

**Default steps**:

1. `"Searching for latest market data..."`
2. `"Analysing broker research..."` (only if files uploaded -- omit otherwise)
3. `"Building thesis pillars..."`
4. `"Assessing financial quality..."`
5. `"Compiling thesis document..."`

### Layout

Centered in the thesis content area. `max-w-md mx-auto py-16 text-center`.

```
Generating thesis for AAPL

  [check] Searching for latest market data
  [spin]  Building thesis pillars...
  [ ]     Assessing financial quality
  [ ]     Compiling thesis document

  This typically takes 30-60 seconds.

  Cancel generation
```

**Title**: `"Generating thesis for [TICKER]"`. `text-lg font-semibold text-brand-900`.

**Steps list**: `mt-8 text-left inline-block`. Each step is a row: `flex items-center gap-3 py-2`.

| Step Status | Icon | Text Styling |
|-------------|------|-------------|
| Pending | Empty circle: `w-5 h-5 rounded-full border-2 border-brand-200` | `text-brand-400` |
| Active | Spinner: `w-5 h-5 animate-spin text-accent-600` (use Radix spinner or CSS animation) | `text-brand-900 font-medium` |
| Completed | Checkmark in green circle: `w-5 h-5 rounded-full bg-status-green-100 text-status-green-700 flex items-center justify-center` | `text-brand-500 line-through` (subtle) |
| Failed | X in red circle: `w-5 h-5 rounded-full bg-error-bg text-error-text` | `text-error-text` |

**Subtext**: `"This typically takes 30-60 seconds."`. `text-sm text-brand-500 mt-6`.

**Cancel link**: `"Cancel generation"`. `text-sm text-brand-500 hover:text-brand-700 underline mt-2`. On click: cancel the generation job, navigate back to dashboard. Confirm with: `"Cancel thesis generation for [TICKER]?"` dialog.

**On completion**: The progress view is replaced with the full thesis content. Use a brief fade transition (200ms). Show a toast notification: `"Thesis generated for [TICKER]."` (see Toast spec in section 10).

**On failure**: Last active step shows failed state. Below steps, show: `"Could not generate thesis for [TICKER]. [Reason]."` + `[Try Again]` button + `[Edit Input and Retry]` link (reopens Add Holding modal pre-filled).

**WebSocket**: Subscribe to `generation:{holdingId}` channel. Events: `step` (step ID + status), `complete`, `error`.

---

## 9. Broker Research Sidebar

### Overview

A section within the Thesis Document View (Sources tab) that manages uploaded broker research files for a holding.

### Component: `BrokerResearchPanel`

```tsx
interface BrokerResearchPanelProps {
  holdingId: string;
  documents: Document[];
  onUpload: (files: File[]) => void;
  onDelete: (documentId: string) => void;
}

interface Document {
  id: string;
  filename: string;
  fileType: 'pdf' | 'docx';
  fileSize: number;          // bytes
  createdAt: string;         // ISO date
}
```

### Layout

```
+------------------------------------------------------+
| Broker Research                                        |
+------------------------------------------------------+
| Morgan_Stanley_AAPL_Q1_2026.pdf                        |
| 12.4 MB  |  Uploaded Apr 3, 2026              [Delete] |
|                                                        |
| Goldman_Sachs_Tech_Sector.pdf                          |
| 8.1 MB   |  Uploaded Mar 15, 2026             [Delete] |
+------------------------------------------------------+
| +----------------------------------------------------+ |
| |  [icon] Drag and drop files here,                  | |
| |         or click to browse.                        | |
| |  PDF or DOCX, up to 50 MB per file.               | |
| +----------------------------------------------------+ |
+------------------------------------------------------+
```

**Section heading**: `"Broker Research"`, section-heading class.

**File list**: Each file is a row.

| Element | Styling |
|---------|---------|
| File icon | PDF icon or DOCX icon, `w-5 h-5 text-brand-400`. Use distinct icons per type. |
| Filename | `text-sm font-medium text-brand-900 truncate max-w-[300px]` |
| File size | `text-xs text-brand-500`. Format: `"12.4 MB"` |
| Upload date | `text-xs text-brand-500`. Format: `"Uploaded Apr 3, 2026"` |
| Delete | `TrashIcon`, `text-brand-300 hover:text-red-600 p-1 rounded`. Visible on hover or focus-within. |

Row: `flex items-center gap-3 py-3 border-b border-brand-100 last:border-0 group`.

**Delete confirmation**: Radix `AlertDialog`.
- Title: `"Remove this file?"`.
- Description: `"[filename] will no longer be used in weekly analysis."`.
- Buttons: `[Keep]` (secondary), `[Remove]` (destructive).

**Drop zone**: Below the file list. `FileDropZone` component, `min-h-[80px]`. Always visible (not hidden behind a button).

**Upload progress**: Replace the drop zone temporarily with a progress indicator.
```
Uploading Morgan_Stanley_AAPL_Q1_2026.pdf...    [==============____] 67%
```
- Progress bar: `h-1.5 bg-brand-200 rounded-full overflow-hidden`. Fill: `bg-accent-600`.
- Filename: `text-sm text-brand-700`.
- Percentage: `text-sm text-brand-500 font-mono`.

**Upload success**: File appears in the list with a brief `bg-success-bg` flash (300ms) then fades to normal.

**Upload errors**:
- Wrong file type: Inline error below drop zone. `"This file type is not supported. Please upload a PDF or DOCX file."`. `text-error-text text-xs mt-2`.
- Too large: `"This file exceeds the 50 MB limit."`.
- Parse failed: `"We could not read this file. It may be scanned or image-only."`.

**Empty state** (no files):
```
"No research uploaded for this holding."          (body, text-brand-500)
"Upload broker PDFs or reports to improve         (body-small, text-brand-400, mt-1)
 thesis quality and weekly analysis."
```
Then the drop zone immediately below.

---

## 10. Shared Components

### Component: `FileDropZone`

Reused in: Add Holding modal, Bulk Upload, Broker Research panel.

```tsx
interface FileDropZoneProps {
  accept: string;                    // MIME types, e.g., ".pdf,.docx" or ".xlsx,.csv"
  maxSizeMB: number;                 // e.g., 50
  multiple?: boolean;                // default: false
  onFilesSelected: (files: File[]) => void;
  constraintText?: string;           // e.g., "PDF or DOCX, up to 50 MB per file."
  className?: string;
}
```

**Implementation**:
- Wraps a hidden `<input type="file">` with the specified `accept`.
- The visible drop zone is a `<div>` with `role="button"`, `tabIndex={0}`, `aria-label="Upload file. Drag and drop or press Enter to browse."`.
- On click or `Enter`/`Space` keypress: trigger the hidden file input.
- On drag enter: apply hover state.
- On drop: validate file type and size. If invalid, show error state briefly (2s) then revert.
- On drag leave: revert to default state.

**States** (as defined in section 4 drop zone states).

### Component: `Toast`

Radix `Toast.Provider` at app root.

```tsx
interface ToastProps {
  title: string;
  variant?: 'default' | 'success' | 'error';
  duration?: number;  // ms, default: 4000
}
```

- Position: Bottom-right, `fixed bottom-6 right-6`.
- Styling: `bg-surface-card border border-brand-200 shadow-md rounded-lg px-4 py-3 text-sm text-brand-700 max-w-sm`.
- Success variant: Left border `border-l-4 border-l-status-green-700`.
- Error variant: Left border `border-l-4 border-l-error-border`.
- Close button: X icon, top-right.
- Animation: Slide in from right (200ms ease-out), slide out to right on dismiss (150ms ease-in).
- Auto-dismiss after `duration` ms. Pause timer on hover.

### Component: `SkeletonLoader`

```tsx
interface SkeletonLoaderProps {
  variant: 'table' | 'document' | 'text-block';
  rows?: number;  // for table variant
}
```

- Base element: `div` with `bg-brand-100 rounded animate-pulse`.
- Respect `prefers-reduced-motion`: Replace `animate-pulse` with static `opacity-60`.
- Table variant: Column headers visible, N rows of skeleton bars.
- Document variant: Mimic thesis layout (header block, tab bar, content blocks).
- Text-block variant: 3 lines of varying width (100%, 85%, 65%).

### Component: `ConfirmDialog`

Wraps Radix `AlertDialog` for reuse.

```tsx
interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;       // e.g., "Remove"
  cancelLabel?: string;       // default: "Cancel"
  variant?: 'default' | 'destructive';
  onConfirm: () => void;
}
```

- Destructive variant: Confirm button uses `bg-red-600 hover:bg-red-700 text-white`.
- Default variant: Confirm button uses primary accent styling.

---

## 11. Responsive Strategy

The PRD states mobile is a non-goal (NG5). The primary target is desktop (1280px+). However, the app should not break on tablet-sized screens (1024px) or on a laptop with a smaller viewport (down to 768px).

### Breakpoints

Use Tailwind defaults:

| Breakpoint | Min Width | Usage |
|------------|-----------|-------|
| `sm` | 640px | Not targeted but should not break |
| `md` | 768px | Minimum supported width |
| `lg` | 1024px | Comfortable layout |
| `xl` | 1280px | Primary design target |

### Per-Component Responsive Behavior

**Holdings Table** (`md` to `xl`):
- At `xl`: All columns visible.
- At `lg`: Hide `Thesis Date` column. All others visible.
- At `md`: Hide `Thesis Date` and `Last Update` columns. Ticker column sticky on horizontal scroll.
- Below `md`: Stack into card layout -- each holding is a card with key data points. NOT a priority for v1 but should not crash.

**Add Holding Modal**:
- At `xl`/`lg`: `max-w-lg` centered.
- At `md`: `max-w-lg mx-4`.
- Below `md`: Full-width with `mx-2 my-2 rounded-lg`.

**Thesis Document View**:
- At `xl`: Full width within `max-w-7xl`.
- At `lg`: Same layout, content naturally narrows.
- At `md`: Tabs may need horizontal scrolling. Use `overflow-x-auto` on tab bar with `scrollbar-hide` utility. Or truncate tab labels (e.g., "Summary" instead of "Summary + Pillars").

**Bulk Upload Modal**:
- At `xl`/`lg`: `max-w-3xl`.
- At `md`: `max-w-2xl mx-4`. Validation table scrolls horizontally.

**Broker Research Panel**:
- No special responsive behavior needed. Filenames truncate naturally.

**Bulk Progress Banner**:
- At `xl`/`lg`: All elements in a single row.
- At `md`: Stack into two rows: status text + cancel on first row, progress bar on second row.

---

## 12. Animation and Motion

Keep animations minimal and functional. Finance users prioritize data over flair.

### Global Rule

All animations respect `prefers-reduced-motion: reduce`. When active, replace:
- `animate-pulse` with static `opacity-60`.
- Slide/fade transitions with instant state changes.
- Spinner animations with a static loading icon.

### Specific Animations

| Element | Trigger | Animation | Duration | Easing | Notes |
|---------|---------|-----------|----------|--------|-------|
| Modal open | Dialog opens | Overlay: fade in. Content: fade in + scale from 95% to 100% | 200ms | `ease-out` | Radix handles this natively with `data-[state=open]` |
| Modal close | Dialog closes | Reverse of open | 150ms | `ease-in` | -- |
| Weekly log expand | Click tier 1 | Height: 0 to auto | 200ms | `ease-out` | Use CSS grid trick or Radix Collapsible |
| Weekly log collapse | Click tier 1 | Height: auto to 0 | 150ms | `ease-in` | -- |
| Toast enter | Toast created | Slide in from right + fade in | 200ms | `ease-out` | Radix Toast handles this |
| Toast exit | Dismiss / timeout | Slide out to right + fade out | 150ms | `ease-in` | -- |
| Progress bar fill | Progress updates | Width transition | 300ms | `ease-in-out` | `transition-all duration-300` |
| Status badge pulse | `generating` status | Opacity 100% to 50% loop | 1500ms | `ease-in-out` | `animate-pulse` |
| Skeleton pulse | Loading state | Opacity 100% to 50% loop | 1500ms | `ease-in-out` | `animate-pulse` |
| Editable hover outline | Mouse enter | Outline appears | 150ms | `ease-out` | `transition-all duration-150` |
| File upload success | Upload completes | Background flash green | 300ms | `ease-out` | `bg-success-bg` to transparent |
| Generation step check | Step completes | Scale from 0 to 100% | 200ms | spring / `ease-out` | Checkmark icon |
| Inline save indicator | Save completes | Fade in, hold 1.5s, fade out | 200ms in, 200ms out | `ease-out` | -- |

---

## 13. Accessibility Checklist

Reference: WCAG 2.1 AA. The UX Design Review (Part 3) contains detailed accessibility notes. This section translates them into implementation requirements.

### Keyboard Navigation

| Context | Keys | Behavior |
|---------|------|----------|
| Dashboard | `Cmd+K` / `Ctrl+K` / `/` | Focus search bar |
| Search bar (focused) | `Escape` | Clear input, blur |
| Holdings table | `Tab` | Move between interactive elements (sort buttons, row links) |
| Holdings table | `Enter` on row | Navigate to thesis detail |
| Thesis tabs | `ArrowLeft` / `ArrowRight` | Move between tabs |
| Thesis tabs | `Enter` / `Space` | Activate tab |
| Editable text (display) | `Enter` / `Space` | Enter edit mode |
| Editable text (editing) | `Escape` | Cancel edit, revert changes |
| Pillar card (focused) | `Alt+ArrowUp` / `Alt+ArrowDown` | Reorder pillar |
| Modal open | `Tab` | Cycle through modal elements (focus trapped) |
| Modal open | `Escape` | Close modal |
| Weekly log entry | `Enter` / `Space` | Toggle expand/collapse |
| File drop zone | `Enter` / `Space` | Open file browser |

### ARIA Requirements

| Component | ARIA Attributes |
|-----------|----------------|
| Holdings table | `<table>` with `<caption>`: "Portfolio holdings with thesis status and recent performance." All headers: `<th scope="col">`. |
| Sortable column | `aria-sort="ascending"` / `"descending"` / `"none"` on `<th>`. |
| Search bar | `role="searchbox"`, `aria-label="Search holdings by ticker or company name"`. |
| Filter chips | `role="group"`, `aria-label="Filter holdings"`. Each chip: `role="checkbox"` / `aria-pressed`. |
| Thesis tabs | `role="tablist"` on container. `role="tab"` + `aria-selected` on triggers. `role="tabpanel"` + `aria-labelledby` on content. |
| Editable sections | `role="button"` + `aria-label="Edit [section]. Click or press Enter to edit."` in display mode. |
| Weekly log entries | `aria-expanded="true"` / `"false"` on the collapsible trigger. |
| Status badges | Always include text label. Add `<span class="sr-only">Status:</span>` prefix for screen readers. |
| Progress indicators | `role="progressbar"` + `aria-valuenow` + `aria-valuemin="0"` + `aria-valuemax="100"`. |
| File drop zone | `role="button"` + `aria-label="Upload file. Drag and drop or press Enter to browse."` |
| Save confirmation | Visually hidden `aria-live="polite"` region announces "Changes saved" on auto-save. |
| Toast notifications | Radix Toast uses `aria-live` natively. Verify it announces on creation. |

### Colour Contrast

All text-on-background combinations must meet 4.5:1 contrast ratio (WCAG AA).

Key pairs to verify:

| Text Colour | Background | Ratio | Pass? |
|-------------|------------|-------|-------|
| `status-green-700` (#15803D) | `status-green-100` (#DCFCE7) | 4.8:1 | Yes |
| `status-red-700` (#B91C1C) | `status-red-100` (#FEE2E2) | 5.1:1 | Yes |
| `status-grey-700` (#4B5563) | `status-grey-100` (#F3F4F6) | 5.9:1 | Yes |
| `brand-700` (#334155) | `surface-card` (#FFFFFF) | 9.1:1 | Yes |
| `brand-500` (#64748B) | `surface-card` (#FFFFFF) | 4.6:1 | Yes (borderline) |
| `accent-600` (#2563EB) | `surface-card` (#FFFFFF) | 4.6:1 | Yes (borderline) |
| `error-text` (#B91C1C) | `surface-card` (#FFFFFF) | 5.7:1 | Yes |

### Focus Management

| Trigger | Focus Target |
|---------|-------------|
| Modal opens | First focusable element in modal (Ticker input for Add Holding) |
| Modal closes | The button that triggered the modal |
| Navigate to thesis detail | Thesis page heading (company name) |
| Generation completes | Thesis page heading |
| Tab switch | First focusable element in tab panel content |
| Inline edit activates | The input/textarea that replaces display text |
| Inline edit saves/cancels | The editable region (back to display mode) |
| Pillar deleted | The previous pillar's card (or "Add Pillar" if last one) |
| Toast appears | No focus change. Screen reader announces via `aria-live`. |

### Minimum Touch/Click Targets

All interactive elements: minimum `44px` x `44px` effective touch area. For smaller visual elements (e.g., delete icon on file row), use padding to achieve the minimum target: `p-2` on a 20px icon = 36px, pad to `p-3` for 44px.

---

*End of Developer Handoff Specification. This document is the single source of truth for building the Thesis Tracker UI. If any detail is ambiguous or conflicts with the PRD/UX Design Review, this document takes precedence for implementation decisions.*
