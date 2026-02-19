# Dashboard Optimization Plan

**Version:** 1.0
**Last Updated:** 2026-02-17
**Scope:** `apps/dashboard` - reducing API calls, server-side data loading, React Query caching strategy

---

## Table of Contents

1. [Current Problems](#1-current-problems)
2. [Target Architecture](#2-target-architecture)
3. [Server Actions Refactor](#3-server-actions-refactor)
4. [React Query Strategy](#4-react-query-strategy)
5. [Per-Page Optimization](#5-per-page-optimization)
6. [Implementation Plan](#6-implementation-plan)

---

## 1. Current Problems

### 1.1 Excessive API Calls

The current operator detail page makes **multiple independent API calls on mount** via React Query hooks:

```
OverviewTab mounts → triggers:
  - useRiskAssessment(operatorId)      → GET /operators/:id/risk
  - useOperatorActivity(operatorId)    → GET /operators/:id/activity
  - useDailySnapshots(operatorId)      → GET /operators/:id/snapshots/daily

Each tab has its own hooks, ALL mounted in a client component.
```

**Problem:** When the user lands on the operator detail page, multiple API calls fire simultaneously, even for tabs the user hasn't clicked yet.

### 1.2 All Data Fetched Client-Side

The current flow is:

```
Browser → Client Component → useQuery → Server Action → Axios → Backend API
```

This means:
- **No SSR data** - the page renders empty, then fills in with loading skeletons
- **Waterfall requests** - parent data loads, then child data loads
- **Duplicate network hops** - Server Action runs on the server but is triggered from the client

### 1.3 Current Data Flow

```
Page Component (client)
  └── useQuery hook
       └── Server Action (runs on Next.js server)
            └── Axios → Backend API (http://localhost:8000)
                 └── Response
            └── handleApiAction wraps response
       └── React Query caches
  └── Component renders with data
```

### 1.4 Server Actions Are Already "use server"

The existing server actions in `apps/dashboard/actions/` are already marked `"use server"` and use Axios. This is good - they run on the Next.js server, not the browser. But they're only called from `useQuery` on the client, so we're not using Next.js's RSC (React Server Component) capabilities.

---

## 2. Target Architecture

### 2.1 New Data Flow

```
Page (Server Component) ─── Server Action ─── Backend API
  │                                                │
  │  Initial data passed as props                  │
  │                                                │
  ▼                                                │
Client Component                                   │
  │                                                │
  └── useQuery (hydrated with server data)         │
       └── Background refresh only ────────────────┘
```

### 2.2 Principles

1. **Server Components load initial data** - The page renders on the server with data already fetched
2. **React Query hydrates from server data** - `initialData` or `placeholderData` from props
3. **React Query handles background refresh** - Stale-while-revalidate pattern
4. **Tabs lazy-load** - Only fetch data for the active tab
5. **Batch related data** - One API call for the "overview" instead of 5 separate calls

### 2.3 Target Call Pattern (Operator Detail Page)

**On page load (server-side):**
```
1x GET /operators/:id          → Overview + stats (combined)
```

**On tab click (client-side, lazy):**
```
GET /operators/:id/strategies   → Only when Strategy tab clicked
GET /operators/:id/avs          → Only when AVS tab clicked
GET /operators/:id/delegators   → Only when Delegators tab clicked
GET /operators/:id/allocations  → Only when Allocations tab clicked
GET /operators/:id/commission   → Only when Commission tab clicked
GET /operators/:id/risk         → Only when Risk tab clicked
```

**On OverviewTab render (client-side):**
```
GET /operators/:id/activity     → Activity timeline (after page load)
GET /operators/:id/snapshots    → Chart data (after page load)
```

---

## 3. Server Actions Refactor

### 3.1 Keep Server Actions for Initial Data

Server Actions are the right abstraction for fetching data on the server. Keep them but use them differently:

**Before (client-side only):**
```tsx
// page.tsx (client component)
"use client";
export default function OperatorPage({ params }) {
  const { data } = useOperator(params.operator_id);
  return <OperatorDetail data={data} />;
}
```

**After (server + client hybrid):**
```tsx
// page.tsx (server component - no "use client")
import { getOperator, getOperatorStats } from "@/actions/operators";

export default async function OperatorPage({ params }) {
  const { operator_id } = await params;

  // Fetch on the server during SSR
  const [operatorRes, statsRes] = await Promise.all([
    getOperator(operator_id),
    getOperatorStats(operator_id),
  ]);

  return (
    <OperatorDetail
      initialOperator={operatorRes.data?.data}
      initialStats={statsRes.data?.data}
      operatorId={operator_id}
    />
  );
}
```

### 3.2 Client Component Hydrates with Server Data

```tsx
// _components/OperatorDetail.tsx (client component)
"use client";

export function OperatorDetail({ initialOperator, initialStats, operatorId }) {
  // React Query with initialData - no loading state on first render
  const { data: operator } = useOperator(operatorId, {
    initialData: initialOperator,
  });

  const { data: stats } = useOperatorStats(operatorId, {
    initialData: initialStats,
  });

  // Rest of component...
}
```

### 3.3 Updated Hook Pattern

```typescript
// hooks/crud/useOperator.ts - updated to accept initialData
export const useOperator = (
  operatorId: string,
  options?: { initialData?: OperatorDetail }
) => {
  return useQuery({
    queryKey: QUERY_KEYS.operator(operatorId),
    queryFn: () => getOperator(operatorId),
    select: (data) => data.data?.data,
    initialData: options?.initialData
      ? { success: true, data: { data: options.initialData }, message: '', error: null, errorCode: undefined }
      : undefined,
    staleTime: 60_000, // 1 minute before background refresh
  });
};
```

---

## 4. React Query Strategy

### 4.1 Caching Configuration

```typescript
// Provider.tsx - updated QueryClient config
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,        // 1 minute: data is "fresh"
      gcTime: 5 * 60_000,       // 5 minutes: keep in cache after unmount
      refetchOnWindowFocus: false, // Don't refetch on tab switch
      refetchOnMount: false,     // Don't refetch if data exists and is fresh
      retry: 1,                  // One retry on failure
    },
  },
});
```

### 4.2 Per-Query Stale Times

| Data Type | Stale Time | Rationale |
|-----------|-----------|-----------|
| Operator overview | 1 min | Changes rarely |
| Operator stats | 1 min | Changes rarely |
| Operator list | 2 min | Paginated, less critical |
| Daily snapshots | 5 min | Historical data, very stable |
| Risk assessment | 5 min | Computed daily |
| Commission | 5 min | Changes rarely |
| Delegators | 2 min | Can change with delegation events |
| Allocations | 2 min | Can change |
| AVS relationships | 5 min | Changes rarely |
| Network stats | 5 min | Aggregated |
| Activity timeline | 2 min | New events possible |

### 4.3 Query Key Structure

Current `queryKey.ts` is well-structured. Keep the pattern:

```typescript
export const QUERY_KEYS = {
  operators: (params?: any) => ['operators', params] as const,
  operator: (id: string) => ['operators', id] as const,
  operatorStats: (id: string) => ['operators', id, 'stats'] as const,
  // ... etc
};
```

### 4.4 Prefetching on Tab Hover

For tab navigation, prefetch data when the user hovers over a tab:

```tsx
const handleTabHover = (tabName: string) => {
  switch (tabName) {
    case 'strategies':
      queryClient.prefetchQuery({
        queryKey: QUERY_KEYS.strategies(operatorId),
        queryFn: () => getOperatorStrategies(operatorId),
        staleTime: 60_000,
      });
      break;
    // ... etc
  }
};
```

---

## 5. Per-Page Optimization

### 5.1 Operator List Page (`/operator`)

**Current:** Client component fetches operators list via `useOperators()`

**Target:**
```tsx
// app/operator/page.tsx (server component)
export default async function OperatorsPage() {
  const operatorsRes = await getOperators({ limit: 20, offset: 0 });

  return (
    <OperatorListView
      initialData={operatorsRes.data?.data}
      initialPagination={operatorsRes.data?.pagination}
    />
  );
}
```

Client component handles pagination, search, and sorting with React Query for subsequent pages.

### 5.2 Operator Detail Page (`/operator/[operator_id]`)

**Current:** All data fetched client-side across multiple hooks

**Target:**
```tsx
// app/operator/[operator_id]/page.tsx (server component)
export default async function OperatorDetailPage({ params }) {
  const { operator_id } = await params;

  // Fetch overview data server-side (what the user sees first)
  const [overviewRes, statsRes] = await Promise.all([
    getOperator(operator_id),
    getOperatorStats(operator_id),
  ]);

  return (
    <OperatorProfile
      initialOverview={overviewRes.data?.data}
      initialStats={statsRes.data?.data}
      operatorId={operator_id}
    />
  );
}
```

**Tab Data Loading:**

Each tab component fetches its own data only when mounted (when the tab is selected):

```tsx
// Lazy tab loading
const [activeTab, setActiveTab] = useState('overview');

// Only render the active tab's component
{activeTab === 'overview' && <OverviewTab operator={operator} />}
{activeTab === 'strategies' && <StrategiesTab operatorId={operatorId} />}
{activeTab === 'avs' && <AVSTab operatorId={operatorId} />}
// ... etc
```

This is **different from the current approach** where all tab components are mounted and each fires their own API calls.

### 5.3 Backend: Combined Overview Endpoint

Consider a new endpoint that combines overview + stats to reduce SSR calls from 2 to 1:

```
GET /api/v1/operators/:id/full-overview
```

Returns:
```json
{
  "data": {
    "overview": { ... },
    "statistics": { ... },
    "quick_risk": { "level": "LOW", "score": null } // Level free, score pro
  }
}
```

This is optional but reduces the SSR waterfall.

### 5.4 Dashboard Home (`/`)

Currently shows "Coming Soon." When implemented, should server-side fetch:
- Network stats
- User's watchlist (if authenticated)
- Trending operators

---

## 6. Implementation Plan

### 6.1 Phase 1: Server Component Pages

**Goal:** Move initial data fetching to server components.

1. Convert `app/operator/page.tsx` to async server component
2. Fetch initial operator list server-side
3. Pass as `initialData` to client component
4. Verify no loading spinner on initial page load

**Files to modify:**
- `app/operator/page.tsx` → Server component
- `app/operator/_components/` → Accept initialData props
- `hooks/crud/useOperator.ts` → Support initialData option

### 6.2 Phase 2: Operator Detail SSR

1. Convert `app/operator/[operator_id]/page.tsx` to async server component
2. Fetch overview + stats server-side
3. Pass to `OperatorProfile` client component
4. Implement lazy tab loading (only active tab renders)

**Files to modify:**
- `app/operator/[operator_id]/page.tsx` → Server component
- `app/operator/[operator_id]/layout.tsx` → If exists, keep as server component
- `app/operator/_components/tabs/` → Each tab self-contained with own data fetching
- `app/operator/_components/OperatorProfileHeader.tsx` → Accept server data

### 6.3 Phase 3: React Query Tuning

1. Update `QueryClient` defaults (staleTime, gcTime, refetchOnMount)
2. Set per-query stale times
3. Add tab hover prefetching
4. Remove duplicate queries (audit all hooks)
5. Add `refetchOnWindowFocus: false` globally

**Files to modify:**
- `app/Provider.tsx` → QueryClient config
- `hooks/crud/*.ts` → Per-hook staleTime

### 6.4 Phase 4: Audit & Remove Redundancy

1. Audit all API calls on the operator detail page
2. Identify duplicate/unnecessary calls
3. Remove React Query calls that duplicate server-fetched data
4. Consider combining backend endpoints where multiple calls could be one

### 6.5 Performance Metrics

Track before and after:

| Metric | Current (estimate) | Target |
|--------|-------------------|--------|
| API calls on operator detail load | 5-8 | 1 (SSR) + 1-2 (active tab) |
| Time to first meaningful paint | ~2-3s | ~500ms (SSR) |
| Time to interactive | ~3-4s | ~1s |
| Total API calls per page view | 8-12 | 3-5 |

---

## Appendix: Current Hook → Server Action Mapping

| Hook | Server Action | Called From | SSR Candidate |
|------|--------------|-------------|---------------|
| `useOperators` | `getOperators` | Operator list page | YES |
| `useOperator` | `getOperator` | Operator detail page | YES |
| `useOperatorStats` | `getOperatorStats` | Operator detail page | YES |
| `useRiskAssessment` | `getRiskAssessment` | OverviewTab | NO (lazy tab) |
| `useOperatorActivity` | `getOperatorActivity` | OverviewTab | NO (client) |
| `useDailySnapshots` | `getDailySnapshots` | OverviewTab | NO (client) |
| `useOperatorStrategies` | `getOperatorStrategies` | StrategiesTab | NO (lazy tab) |
| `useOperatorAVS` | `getOperatorAVS` | AVSTab | NO (lazy tab) |
| `useOperatorDelegators` | `getDelegators` | DelegatorsTab | NO (lazy tab) |
| `useOperatorAllocations` | `getAllocations` | AllocationsTab | NO (lazy tab) |
| `useCommissionOverview` | `getCommissionOverview` | CommissionTab | NO (lazy tab) |
| `useCommissionHistory` | `getCommissionHistory` | CommissionTab | NO (lazy tab) |
