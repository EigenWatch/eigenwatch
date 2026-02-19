# EigenWatch Design System & Style Guide

**Version:** 2.0
**Last Updated:** 2026-02-17
**Scope:** Dashboard (`apps/dashboard`) and Web (`apps/web`) applications
**Stack:** Next.js 16 + Tailwind CSS v4 + Radix UI + Geist Font

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Color System](#2-color-system)
3. [Typography](#3-typography)
4. [Spacing & Layout](#4-spacing--layout)
5. [Component Architecture](#5-component-architecture)
6. [Data Display Patterns](#6-data-display-patterns)
7. [Charts & Visualization](#7-charts--visualization)
8. [Interactive States](#8-interactive-states)
9. [Motion & Animation](#9-motion--animation)
10. [Pro/Free Visual Gating](#10-profree-visual-gating)
11. [Responsive Design](#11-responsive-design)
12. [Anti-Drift Checklist](#12-anti-drift-checklist)
13. [Implementation Reference](#13-implementation-reference)

---

## 1. Design Philosophy

### The Vibe: "Dark Mode Professional"

EigenWatch sits between a Bloomberg Terminal and a modern Web3 analytics dashboard. It is data-dense, high-contrast, and utilitarian. Every visual choice serves legibility and trust.

### Core Principles

| Principle | Do | Don't |
|-----------|-----|-------|
| **Depth** | Use 1px borders to separate surfaces | Use drop shadows or glassmorphism |
| **Contrast** | Deep solid backgrounds with crisp text | Gray muddy backgrounds (#1a1a1a range) |
| **Gradients** | Functional ambient glows only | Rainbow buttons or decorative gradients |
| **Density** | Pack data tightly with clear hierarchy | Spread sparse data across large cards |
| **Color** | Use accent colors as signals (risk, status) | Use color for decoration |
| **Motion** | Subtle transitions on state changes | Bouncing, sliding, or attention-seeking animations |

### The Anti-AI Factor

The design avoids the "generic AI dashboard" look by:
- Using **deep, solid backgrounds** instead of glassmorphism
- Using **high-contrast borders** instead of blurry drop shadows
- Using **functional gradients** (background glows), not decorative ones
- Using **tabular data** over marketing-style cards
- Keeping typography **tight and monospaced** for numerical data

---

## 2. Color System

### 2.1 Current Implementation (globals.css)

The dashboard uses CSS custom properties via Tailwind v4's `@theme inline` directive. The dark theme is the default and only production theme for the dashboard.

### 2.2 Background Palette ("The Void")

These create the layered depth effect. The canvas is near-black; surfaces are slightly lighter.

| Token | Hex Value | CSS Variable | Tailwind Class | Usage |
|-------|-----------|--------------|----------------|-------|
| **Canvas** | `#09090B` | `--background` | `bg-background` | Page background, main body |
| **Surface** | `#18181B` | `--card` | `bg-card` | Cards, panels, modals |
| **Surface Alt** | `#27272A` | `--secondary` | `bg-secondary` | Elevated surfaces, hover states, muted areas |
| **Overlay** | `#18181B` | `--popover` | `bg-popover` | Popovers, dropdowns, tooltips |

**Proposed Addition (for deeper layering):**

| Token | Hex Value | Purpose |
|-------|-----------|---------|
| **Canvas Deep** | `#05060B` | Optional deeper background for hero sections and ambient glow areas |
| **Surface Hover** | `#161922` | Subtle lift on interactive card hover |

> **Rule:** The contrast between canvas and surface should be subtle (2-3 steps on a gray scale), not jarring. If a new page looks like it has "floating cards," the surface is too light.

### 2.3 Foreground & Text

| Token | Hex Value | CSS Variable | Tailwind Class | Usage |
|-------|-----------|--------------|----------------|-------|
| **Primary Text** | `#FFFFFF` | `--foreground` | `text-foreground` | Headings, values, primary content |
| **Secondary Text** | `#9F9FA9` | `--muted-foreground` | `text-muted-foreground` | Labels, descriptions, subtitles |
| **Tertiary Text** | `#6B7280` | (add as custom) | `text-label` | Table column headers, tiny labels |
| **Inverse Text** | `#09090B` | `--primary-foreground` | `text-primary-foreground` | Text on primary-colored backgrounds |

### 2.4 Signal Colors (Functional Accents)

These colors carry meaning. Never use them decoratively.

| Token | Hex Value | CSS Variable | Tailwind Class | Meaning |
|-------|-----------|--------------|----------------|---------|
| **Blue (Action)** | `#3B82F6` | `--chart-1` / `--sidebar-primary` | `text-blue-500` | Primary actions, links, active states |
| **Green (Success)** | `#22C55E` | `--chart-2` | `text-green-500` | Low risk, positive trends, active status |
| **Orange (Warning)** | `#F97316` | `--chart-3` | `text-orange-500` | Medium risk, caution states |
| **Purple (Brand)** | `#A855F7` | `--chart-4` | `text-purple-500` | EigenWatch brand accent, AVS indicators |
| **Pink** | `#EC4899` | `--chart-5` | `text-pink-500` | Chart series 5 |
| **Red (Danger)** | `#EF4444` | `--destructive` | `text-destructive` | High/critical risk, errors, slashing events |
| **Yellow (Warning Alt)** | `#F59E0B` | (add as custom) | `text-amber-500` | Medium risk badges, warning states |

### 2.5 Border & Divider Colors

| Token | Hex Value | CSS Variable | Usage |
|-------|-----------|--------------|-------|
| **Subtle Border** | `#FFFFFF1A` (white 10%) | `--border` | Default borders, table row dividers, card outlines |
| **Input Border** | `#FFFFFF26` (white 15%) | `--input` | Form inputs, interactive borders |
| **Active Border** | `#D4D4D8` | `--ring` | Focus rings, active highlights |
| **Highlight Border** | `#374151` | (add as custom) | Hover state borders |

### 2.6 Status Color Patterns

For badges, pills, and status indicators, use the **text + dim background** pattern:

```
Text Color + 10% opacity background of the same color
```

| Status | Text | Background | Example Class |
|--------|------|------------|---------------|
| Active / Low Risk | `#22C55E` | `rgba(34, 197, 94, 0.1)` | `text-green-500 bg-green-500/10` |
| Warning / Medium Risk | `#F59E0B` | `rgba(245, 158, 11, 0.1)` | `text-yellow-500 bg-yellow-500/10` |
| Danger / High Risk | `#F97316` | `rgba(249, 115, 22, 0.1)` | `text-orange-500 bg-orange-500/10` |
| Critical | `#EF4444` | `rgba(239, 68, 68, 0.1)` | `text-red-500 bg-red-500/10` |
| Info / Neutral | `#3B82F6` | `rgba(59, 130, 246, 0.1)` | `text-blue-500 bg-blue-500/10` |
| Inactive | `#9F9FA9` | `rgba(159, 159, 169, 0.1)` | `text-muted-foreground bg-muted` |

**Current Implementation** (from `RiskBadge.tsx`):
```tsx
const colors = {
  LOW: "bg-green-500/10 text-green-500 border-green-500/20",
  MEDIUM: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  HIGH: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  CRITICAL: "bg-red-500/10 text-red-500 border-red-500/20",
};
```

This pattern is correct and should be maintained across all new components.

---

## 3. Typography

### 3.1 Font Stack

| Role | Font | Variable | Fallback |
|------|------|----------|----------|
| **Sans (UI)** | Geist Sans | `--font-geist-sans` | `system-ui, sans-serif` |
| **Mono (Data)** | Geist Mono | `--font-geist-mono` | `ui-monospace, monospace` |

> **Note:** The suggested style guide mentions Inter, but the codebase uses **Geist** (loaded via `next/font/local`). Geist is a neo-grotesque that shares the same tight, modern feel as Inter. We keep Geist as the primary font.

### 3.2 Type Scale

| Element | Size | Weight | Color | Letter Spacing | Class |
|---------|------|--------|-------|----------------|-------|
| **Page Title** | 24-28px | 600 (SemiBold) | `foreground` (#FFF) | `-0.02em` | `text-2xl font-semibold tracking-tight` |
| **Section Heading** | 18-20px | 600 | `foreground` | `-0.01em` | `text-lg font-semibold` |
| **Card Title/Label** | 14px | 500 (Medium) | `muted-foreground` | normal | `text-sm font-medium text-muted-foreground` |
| **Card Value** | 26px | 500 | `foreground` | normal | `text-[26px] font-[500] text-foreground` |
| **Body Text** | 14px | 400 | `foreground` | normal | `text-sm` |
| **Muted Body** | 14px | 400 | `muted-foreground` | normal | `text-sm text-muted-foreground` |
| **Table Header** | 12px | 500-600 | `#6B7280` | `0.05em` | `text-xs font-medium uppercase tracking-wider text-gray-500` |
| **Table Cell** | 14px | 400 | `foreground` | normal | `text-sm` |
| **Badge Text** | 12px | 600 | (status color) | normal | `text-xs font-semibold` |
| **Tiny Tag** | 10px | 500 | `muted-foreground` | `0.03em` | `text-[10px] font-medium tracking-wide` |

### 3.3 Numerical Data Rules

**All tables and metric displays MUST use:**
```css
font-variant-numeric: tabular-nums;
```

This ensures numbers align vertically in columns. Apply via Tailwind: `tabular-nums`

**For addresses and hashes:** Use `font-mono` class (Geist Mono).

**For monetary values:** Right-align in tables. Use consistent decimal places.

### 3.4 Heading Patterns

```
Page Title: White, tight tracking, semibold
  └── Section Heading: White, slightly smaller, semibold
       └── Card Label: Gray (#9F9FA9), medium weight
            └── Card Value: White, large, medium weight
                 └── Subtitle/Trend: Gray, small
```

---

## 4. Spacing & Layout

### 4.1 Global Layout

The dashboard uses a fixed max-width container:

```tsx
// Current: apps/dashboard/app/layout.tsx
<div className="max-w-[1440px] mx-auto flex flex-col px-[108px]">
  {children}
</div>
```

| Property | Value | Notes |
|----------|-------|-------|
| Max Width | 1440px | Prevents ultra-wide stretching |
| Horizontal Padding | 108px (desktop) | Creates comfortable reading width (~1224px content) |
| Navbar Height | 65px | Fixed top navigation |
| Content Top Padding | 65px (pt-[65px]) | Clears the fixed navbar |

### 4.2 Spacing Scale

Use Tailwind's default spacing scale. Preferred values:

| Use Case | Spacing | Tailwind |
|----------|---------|----------|
| Between sections | 32-48px | `gap-8` to `gap-12` |
| Between cards in a grid | 16-24px | `gap-4` to `gap-6` |
| Card internal padding | 18-24px | `p-[18px]` or `p-6` |
| Between label and value | 6-8px | `gap-[6px]` or `gap-2` |
| Table row height | 48-60px | (via padding) |
| Icon spacing from text | 8-12px | `gap-2` to `gap-3` |

### 4.3 Grid Patterns

**Metric Cards (top of page):**
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  <StatCard ... />
  <StatCard ... />
  <StatCard ... />
  <StatCard ... />
</div>
```

**Two-column layout:**
```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  <SectionContainer>...</SectionContainer>
  <SectionContainer>...</SectionContainer>
</div>
```

### 4.4 Border Radius

| Element | Radius | Tailwind | CSS Variable |
|---------|--------|----------|--------------|
| Cards/Panels | 10-12px | `rounded-lg` (10px) or `rounded-[11.03px]` | `--radius` |
| Buttons | 8px | `rounded-md` | `calc(var(--radius) - 2px)` |
| Badges/Pills | 9999px | `rounded-full` | n/a |
| Inputs | 8px | `rounded-md` | `calc(var(--radius) - 2px)` |
| Small elements | 6px | `rounded-sm` | `calc(var(--radius) - 4px)` |

> **Current:** `CardContainer` uses `rounded-[11.03px]`. Standardize to `rounded-lg` (10px via `--radius: 0.625rem`) for consistency.

---

## 5. Component Architecture

### 5.1 The Metric Card (`StatCard`)

**File:** `components/shared/data/StatCard.tsx`

**Structure:**
```
┌─────────────────────────────────────────┐
│ [Label]                          [Icon] │
│                                         │
│ [Value - Large]                         │
│                                         │
│ [Subtitle / Trend]                      │
└─────────────────────────────────────────┘
```

**Rules:**
- Border: 1px via `Card` component (uses `--border` variable)
- Background: `bg-card` (#18181B)
- Padding: 18px (`p-[18px]`)
- Label: Small, `text-muted-foreground`, with optional `InfoTooltip`
- Icon: Top-right, `text-muted-foreground`, 24px area
- Value: `text-[26px] font-[500] text-foreground`
- Subtitle: `text-sm text-muted-foreground`
- Skeleton loading state required

**Current Implementation Status:** Correctly implemented. The hover shadow (`hover:shadow-md`) on `CardContainer` should be reconsidered - prefer border highlight instead to match the design philosophy.

**Recommended Update:**
```tsx
// CardContainer.tsx - prefer border highlight over shadow
<Card className="hover:border-[--highlight-border] transition-colors p-[18px] rounded-lg w-full">
```

### 5.2 The Data Table

**File:** `components/shared/table/ReuseableTable.tsx`

**Structure:**
```
┌──────────────────────────────────────────────────────┐
│ COLUMN A       COLUMN B       COLUMN C       STATUS  │  ← Header row
├──────────────────────────────────────────────────────┤
│ value          value          value          [pill]   │  ← Body row
│──────────────────────────────────────────────────────│
│ value          value          value          [pill]   │
│──────────────────────────────────────────────────────│
│ value          value          value          [pill]   │
└──────────────────────────────────────────────────────┘
│ ← Previous    Page 1 of 5    Next →                  │  ← Pagination
```

**Rules:**
- Header row: Transparent background, `text-xs uppercase tracking-wider text-gray-500 font-medium`
- Body rows: `border-b border-border` (1px bottom border). NO vertical borders between columns.
- Row height: Compact (48-60px via padding)
- Row hover: `bg-secondary/50` or `bg-muted/50`
- No shadows on table container
- Pagination: Compact, bottom of table

**Status Pill Pattern:**
```tsx
<span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-500/10 text-green-500 border border-green-500/20">
  <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> {/* Status dot */}
  Active
</span>
```

- Never use solid fill backgrounds
- Always include the 6px colored dot inside the pill
- Shape: `rounded-full` (pill)

### 5.3 Section Container

**File:** `components/shared/data/SectionContainer.tsx`

Used to group related content within a tab. Should have:
- Clear heading with optional tooltip
- Consistent internal padding
- Border separation from surrounding content

### 5.4 The Card Component (Radix)

**File:** `components/ui/card.tsx`

Uses Radix UI primitives. Current styling applies:
- `bg-card text-card-foreground` for colors
- Border via the base `border-border` class
- Content padding via `CardContent`

### 5.5 Tabs Component

Used extensively on the operator detail page (7 tabs). Current implementation uses Radix Tabs.

**Rules:**
- Tab triggers: `text-muted-foreground` when inactive, `text-foreground` when active
- Active indicator: Bottom border or background highlight
- Content area: No border separation from tabs (smooth transition)
- Tab content should load data lazily (only when tab is selected)

### 5.6 The Ambient Glow

For hero sections or emphasized areas, use a radial gradient behind content:

```css
.ambient-glow {
  position: relative;
}
.ambient-glow::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  height: 400px;
  background: radial-gradient(
    circle at 50% 0%,
    rgba(59, 130, 246, 0.12) 0%,
    transparent 50%
  );
  pointer-events: none;
  z-index: 0;
}
```

**Rules:**
- Only use on page-level hero areas, never on cards
- Keep opacity low (10-15%)
- Use `--sidebar-primary` (#3B82F6) as the glow color
- Never let the glow wash out text contrast

---

## 6. Data Display Patterns

### 6.1 Risk Indicators

**Current Implementation:** `RiskBadge.tsx`

Four levels with consistent color mapping:

| Level | Text Color | Background | Border |
|-------|-----------|------------|--------|
| LOW | `text-green-500` | `bg-green-500/10` | `border-green-500/20` |
| MEDIUM | `text-yellow-500` | `bg-yellow-500/10` | `border-yellow-500/20` |
| HIGH | `text-orange-500` | `bg-orange-500/10` | `border-orange-500/20` |
| CRITICAL | `text-red-500` | `bg-red-500/10` | `border-red-500/20` |

Always include the score alongside the badge: `"Score: 72/100"`

### 6.2 Utilization Badges

Same pattern as risk, but for allocation utilization:

| Level | Meaning |
|-------|---------|
| LOW (< 30%) | Under-utilized, green |
| MODERATE (30-60%) | Balanced, yellow |
| HIGH (60-85%) | Well-utilized, blue |
| VERY HIGH (> 85%) | Potentially risky, orange |

### 6.3 Address Display

```tsx
// Truncated address with copy button
<div className="flex items-center gap-2 font-mono text-sm">
  <span className="text-muted-foreground">
    {address.slice(0, 6)}...{address.slice(-4)}
  </span>
  <CopyButton value={address} />
</div>
```

### 6.4 Monetary Values

- Use `tabular-nums` for alignment
- Right-align in tables
- Include currency symbol/unit
- Use consistent decimal precision (2 for USD, variable for ETH)
- Large numbers: Use abbreviations (1.2M, 45.3K)

### 6.5 Percentage Values

- Display as "72.5%" not "0.725"
- Color-code when representing risk or performance
- Include +/- for trends

### 6.6 Timestamps

- Relative for recent (e.g., "2 hours ago")
- Absolute for historical (e.g., "Jan 15, 2026")
- Use `date-fns` for formatting (already in dependencies)

---

## 7. Charts & Visualization

### 7.1 Chart Library

**Library:** Recharts v3.5.1

### 7.2 Chart Color Palette

Use the CSS variable chart colors in order:

| Series | Color | CSS Variable |
|--------|-------|--------------|
| 1 | `#3B82F6` (Blue) | `--chart-1` |
| 2 | `#22C55E` (Green) | `--chart-2` |
| 3 | `#F97316` (Orange) | `--chart-3` |
| 4 | `#A855F7` (Purple) | `--chart-4` |
| 5 | `#EC4899` (Pink) | `--chart-5` |

### 7.3 Chart Styling Rules

- **Background:** Transparent (let the card background show through)
- **Grid lines:** `#FFFFFF0D` (white 5%) - barely visible
- **Axis labels:** `#6B7280` (gray-500), 11px
- **Tooltips:** `bg-card border border-border` with white text
- **Area fills:** 10-20% opacity of the line color
- **No decorative elements** - no gradient fills on bars, no 3D effects

### 7.4 Chart Container Pattern

```tsx
<SectionContainer title="TVL History" tooltip="Total Value Locked over time">
  <div className="h-[300px] w-full">
    <AreaChart data={data} ... />
  </div>
</SectionContainer>
```

### 7.5 Donut/Pie Charts

- Use for distribution/composition data (strategy breakdown, asset allocation)
- Center label showing the total
- Legend below or to the right
- Max 5-6 segments; group small ones as "Other"

---

## 8. Interactive States

### 8.1 Buttons

| Variant | Background | Text | Border | Hover |
|---------|-----------|------|--------|-------|
| **Primary** | `#3B82F6` (solid blue) | White | None | `#2563EB` (darker blue) |
| **Secondary** | Transparent | White | `1px solid --border` | `bg-secondary` |
| **Ghost** | Transparent | `muted-foreground` | None | `bg-secondary` |
| **Destructive** | `#EF4444` | White | None | Darker red |
| **Outline** | Transparent | `foreground` | `1px solid --border` | `bg-accent` |

**Rules:**
- No gradient buttons. Ever.
- Primary buttons are flat solid blue
- `rounded-md` (8px border radius)
- Padding: `px-4 py-2` for default, `px-3 py-1.5` for small

### 8.2 Hover States

| Element | Hover Effect |
|---------|-------------|
| Card | Border color shifts to `--highlight-border` (#374151), NO shadow |
| Table row | `bg-muted/50` background |
| Button | Background darkens by one step |
| Link | Underline or color shift to lighter shade |
| Tab | Text color shifts to `foreground` |

### 8.3 Focus States

- Use `ring` color (`#D4D4D8`) for focus outlines
- `outline-2 outline-offset-2 outline-ring`
- Always visible for keyboard navigation

### 8.4 Loading States

- Use `Skeleton` component for content placeholders
- Skeleton color: `bg-muted` (#27272A) with subtle pulse animation
- Match the layout of the loaded content exactly

```tsx
// Skeleton pattern for a StatCard
<Card>
  <CardContent>
    <div className="space-y-3">
      <Skeleton className="h-4 w-24" />   {/* Label */}
      <Skeleton className="h-8 w-32" />   {/* Value */}
      <Skeleton className="h-3 w-20" />   {/* Subtitle */}
    </div>
  </CardContent>
</Card>
```

### 8.5 Empty States

- Centered text: `text-muted-foreground`
- Subtle icon above the text
- Action button if applicable (e.g., "Connect Wallet" or "Try Different Filters")

### 8.6 Error States

- Use `destructive` color for error messages
- Toast notifications via `react-toastify` for transient errors
- Inline error text below form fields

---

## 9. Motion & Animation

### 9.1 Principles

- Motion should be **functional**, not decorative
- Use for state transitions, not entrance animations
- Keep durations short: 150-200ms for interactions, 300ms max for page transitions

### 9.2 Allowed Transitions

| Trigger | Property | Duration | Easing |
|---------|----------|----------|--------|
| Hover on card/button | `border-color`, `background-color` | 150ms | `ease` |
| Tab switch | `opacity` | 200ms | `ease-in-out` |
| Skeleton pulse | `opacity` | 2000ms | `ease-in-out` (loop) |
| Modal open/close | `opacity`, `transform` | 200ms | `ease-out` |
| Toast notification | `transform` (slide in) | 300ms | `ease-out` |

### 9.3 Forbidden

- Bouncing or spring animations on data elements
- Parallax scrolling on the dashboard
- Animated number counting (display values immediately)
- Decorative particle effects

---

## 10. Pro/Free Visual Gating

### 10.1 Blur/Lock Pattern

When a feature is behind the Pro paywall, show a teaser of the data structure with a blur overlay:

```
┌─────────────────────────────────────────────┐
│  [Table header visible]                      │
│  Row 1: [visible]                           │
│  Row 2: [blurred] ░░░░░░░░░░░░░░░░░░░░░░░ │
│  Row 3: [blurred] ░░░░░░░░░░░░░░░░░░░░░░░ │
│                                              │
│         ┌──────────────────────┐            │
│         │  🔒 Pro Feature      │            │
│         │  Unlock detailed     │            │
│         │  data with Pro       │            │
│         │                      │            │
│         │  [Upgrade to Pro]    │            │
│         └──────────────────────┘            │
│                                              │
└─────────────────────────────────────────────┘
```

**Implementation:**
```tsx
<div className="relative">
  {/* Teaser content */}
  <div className="blur-sm pointer-events-none select-none">
    <DataTable data={mockData} />
  </div>

  {/* Lock overlay */}
  <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[2px]">
    <ProUpgradeCard feature="Detailed Strategy Data" />
  </div>
</div>
```

### 10.2 ProUpgradeCard Component

```
┌─────────────────────────────┐
│  🔒 Pro Feature             │
│                              │
│  [Feature description]       │
│                              │
│  [Upgrade to Pro] (primary)  │
│  [Learn More]    (ghost)     │
└─────────────────────────────┘
```

- Background: `bg-card` with `border-border`
- Lock icon: `text-muted-foreground`
- Description: `text-muted-foreground text-sm`
- Primary CTA: Blue button
- Compact, not overwhelming

### 10.3 Free vs Paid Indicator

For sections that have both free and paid content, use a subtle badge:

```tsx
<div className="flex items-center gap-2">
  <h3 className="text-lg font-semibold">Strategy Breakdown</h3>
  <Badge className="bg-purple-500/10 text-purple-500 border-purple-500/20 text-[10px]">
    PRO
  </Badge>
</div>
```

### 10.4 Aggregate vs Detail Pattern

Free users see aggregates; paid users see the full table. The visual transition should be:

1. **Free:** Show the aggregate card (count, total, badge)
2. **Paid:** Show the aggregate card + expandable table below it

Never remove the aggregate when showing detail - it serves as a summary anchor.

---

## 11. Responsive Design

### 11.1 Breakpoints (Tailwind defaults)

| Breakpoint | Width | Usage |
|------------|-------|-------|
| `sm` | 640px | Mobile landscape |
| `md` | 768px | Tablet |
| `lg` | 1024px | Desktop |
| `xl` | 1280px | Large desktop |
| `2xl` | 1536px | Ultra-wide (max-w-[1440px] caps this) |

### 11.2 Dashboard Responsive Rules

| Element | Desktop (lg+) | Tablet (md) | Mobile (sm) |
|---------|---------------|-------------|-------------|
| Side padding | 108px | 48px | 16px |
| Metric grid | 4 columns | 2 columns | 1 column |
| Content grid | 2 columns | 1 column | 1 column |
| Table | Full columns | Scroll horizontal | Scroll horizontal |
| Tabs | Horizontal | Horizontal | Scroll horizontal |
| Charts | Full width | Full width | Full width |

### 11.3 Mobile Table Handling

On mobile, tables should horizontally scroll with the first column (identifier) sticky:

```tsx
<div className="overflow-x-auto">
  <table className="w-full min-w-[600px]">
    ...
  </table>
</div>
```

---

## 12. Anti-Drift Checklist

Before approving any new page or component, verify:

### Visual Checks

- [ ] **Borders over shadows:** Are there `shadow-*` classes? Replace with `border border-border`. Only the ambient glow is allowed to be soft.
- [ ] **Background depth:** Is the main background `#09090B`? Cards should be `#18181B`. The difference is subtle, not jarring.
- [ ] **No gradient buttons:** Primary buttons are solid `#3B82F6`. Secondary buttons are transparent with white border.
- [ ] **No glassmorphism:** No `backdrop-blur` on cards or surfaces (exception: Pro lock overlay).
- [ ] **Tabular nums:** All number-heavy tables/displays use `tabular-nums`.
- [ ] **Status pills use dim backgrounds:** No solid-fill status badges. Always `text-color + bg-color/10`.

### Structure Checks

- [ ] **Consistent card padding:** 18-24px (`p-[18px]` or `p-6`).
- [ ] **Section spacing:** 32-48px between major sections.
- [ ] **Type hierarchy correct:** Labels gray, values white, headings semibold.
- [ ] **Loading skeletons match layout:** Skeleton shapes match the final content layout.
- [ ] **Table headers uppercase:** `text-xs uppercase tracking-wider`.

### Functional Checks

- [ ] **No unnecessary motion:** Transitions limited to hover, focus, and tab changes.
- [ ] **Pro content properly gated:** Blur overlay + upgrade CTA, not just hidden content.
- [ ] **Tooltips present for technical terms:** Use `InfoTooltip` component from `educational-content.ts`.
- [ ] **Address truncation:** `0xABCD...1234` format with copy button.

---

## 13. Implementation Reference

### 13.1 CSS Variables Update (globals.css)

Add these custom properties to the `.dark` block for the expanded palette:

```css
.dark {
  /* Existing variables remain unchanged */

  /* New additions for expanded design system */
  --canvas-deep: #05060B;
  --surface-hover: #161922;
  --highlight-border: #374151;
  --text-label: #6B7280;
  --warning: #F59E0B;
  --warning-dim: rgba(245, 158, 11, 0.1);
  --success-dim: rgba(34, 197, 94, 0.1);
  --danger-dim: rgba(239, 68, 68, 0.1);
  --info-dim: rgba(59, 130, 246, 0.1);
  --purple-brand: #A855F7;
  --purple-dim: rgba(168, 85, 247, 0.1);
}
```

### 13.2 Theme Tokens in Tailwind v4

Register the new tokens in the `@theme inline` block:

```css
@theme inline {
  /* ... existing tokens ... */
  --color-canvas-deep: var(--canvas-deep);
  --color-surface-hover: var(--surface-hover);
  --color-highlight-border: var(--highlight-border);
  --color-text-label: var(--text-label);
  --color-warning: var(--warning);
}
```

### 13.3 Key File Paths

| File | Purpose |
|------|---------|
| `apps/dashboard/app/globals.css` | Theme variables, base styles |
| `apps/dashboard/components/ui/` | Radix UI component wrappers |
| `apps/dashboard/components/shared/data/` | Data display components |
| `apps/dashboard/components/shared/charts/` | Chart components |
| `apps/dashboard/components/shared/table/` | Table components |
| `apps/dashboard/lib/educational-content.ts` | Tooltip text content |
| `packages/ui/src/` | Shared cross-app components |

### 13.4 Component Naming Convention

- **UI primitives:** PascalCase, singular (`Button`, `Card`, `Badge`)
- **Data components:** PascalCase, descriptive (`StatCard`, `RiskBadge`, `MetricProgress`)
- **Layout components:** PascalCase, container-style (`SectionContainer`, `CardContainer`)
- **Page-specific components:** In `_components/` directories
- **Hooks:** `use` prefix, camelCase (`useOperator`, `useRiskAssessment`)
- **Server actions:** camelCase, verb prefix (`getOperators`, `getCommissionHistory`)

---

## Appendix: Color Reference Quick Sheet

```
BACKGROUNDS
  #09090B  ████  Canvas (page bg)
  #18181B  ████  Surface (cards)
  #27272A  ████  Elevated (hover, muted)
  #05060B  ████  Deep (hero glow areas)

TEXT
  #FFFFFF  ████  Primary (headings, values)
  #9F9FA9  ████  Secondary (descriptions)
  #6B7280  ████  Tertiary (labels, headers)

SIGNALS
  #3B82F6  ████  Blue (action, primary)
  #22C55E  ████  Green (success, low risk)
  #F59E0B  ████  Amber (warning, medium risk)
  #F97316  ████  Orange (high risk)
  #EF4444  ████  Red (critical, danger)
  #A855F7  ████  Purple (brand, AVS)
  #EC4899  ████  Pink (chart series 5)

BORDERS
  #FFFFFF1A  ████  Subtle (10% white)
  #FFFFFF26  ████  Input (15% white)
  #374151    ████  Highlight (hover)
  #D4D4D8    ████  Ring (focus)
```
