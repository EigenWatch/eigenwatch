# Pro vs Free Feature Gating Implementation Plan

**Version:** 1.0
**Last Updated:** 2026-02-17
**Dependency:** Authentication System (02-AUTHENTICATION_SYSTEM.md)

---

## Table of Contents

1. [Core Principle](#1-core-principle)
2. [Gating Architecture](#2-gating-architecture)
3. [Backend Implementation](#3-backend-implementation)
4. [Frontend Implementation](#4-frontend-implementation)
5. [Per-Tab Gating Specification](#5-per-tab-gating-specification)
6. [Gating UX Patterns](#6-gating-ux-patterns)
7. [Migration Strategy](#7-migration-strategy)

---

## 1. Core Principle

> **Free = Awareness. Paid = Decision-making.**

| Rule | Example |
|------|---------|
| Aggregates can be free. Individuals are paid. | Total delegators: free. Delegator list: paid. |
| Facts can be free. Interpretation is paid. | Commission rate: free. Commission volatility: paid. |
| Charts can be free. Tables with weights are paid. | TVS pie chart: free. Strategy table with %: paid. |
| Statuses are free. Rankings and scores are paid. | Utilization badge: free. HHI value: paid. |
| Operators see their own data. They pay for EigenWatch's judgment. | Raw data: free for own operator. Risk score: paid. |

### Free User Must Be Able To Answer

- Is this operator real?
- Is this operator generally risky?
- Is this operator active and relevant?

### Paid User Must Be Able To Answer

- Should I allocate capital here?
- What breaks first?
- What is the hidden risk?

---

## 2. Gating Architecture

### 2.1 Access Levels

```typescript
enum AccessLevel {
  PUBLIC = 'public',     // No auth required (API key only)
  FREE = 'free',         // Authenticated, free tier
  PRO = 'pro',           // Authenticated, pro tier
  ENTERPRISE = 'enterprise', // Future
}
```

### 2.2 How Gating Works

```
Request → Auth Guard → Tier Decorator → Service → Response
                          │
                          ├── @Public()     → No auth, full response
                          ├── @FreeTier()   → Auth required, free data
                          └── @ProTier()    → Auth required, pro data (or 403)
```

**For endpoints that serve both tiers (most endpoints):**

```
Request → Auth Guard → Service → Check user tier → Return filtered response
                                      │
                                      ├── Free user → Aggregates only
                                      └── Pro user  → Full detailed data
```

### 2.3 Response Strategy

Two approaches depending on the endpoint:

**Approach A: Single Endpoint, Filtered Response**

The same endpoint returns different data based on tier. The response includes a `tier_context` field so the frontend knows what's gated.

```json
{
  "data": {
    "total_delegators": 145,
    "delegation_hhi_label": "LOW",
    "delegator_list": null  // null for free users
  },
  "tier_context": {
    "user_tier": "free",
    "gated_fields": ["delegator_list"],
    "upgrade_message": "Unlock individual delegator data with Pro"
  }
}
```

**Approach B: Separate Endpoints**

Some data is only available via Pro-only endpoints that return 403 for free users.

```json
// 403 response for free users on pro endpoints
{
  "success": false,
  "error": {
    "code": "TIER_REQUIRED",
    "required_tier": "pro",
    "message": "This data requires a Pro subscription"
  }
}
```

### 2.4 Decision: When to Use Which Approach

| Scenario | Approach |
|----------|----------|
| Same endpoint, some fields hidden | A (filtered response) |
| Entire endpoint is pro-only | B (separate endpoint) |
| Table data with free summary | A (summary always included, rows conditional) |
| Risk scores and judgment | B (entirely pro) |

---

## 3. Backend Implementation

### 3.1 New Decorator: `@TierGated()`

```typescript
// src/core/decorators/tier-gated.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const TIER_KEY = 'required_tier';
export const TierGated = (tier: 'free' | 'pro' | 'enterprise') =>
  SetMetadata(TIER_KEY, tier);
```

### 3.2 New Guard: `TierGuard`

```typescript
// src/core/guards/tier.guard.ts
@Injectable()
export class TierGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredTier = this.reflector.getAllAndOverride<string>(TIER_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredTier) return true; // No tier requirement

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    const tierHierarchy = { free: 0, pro: 1, enterprise: 2 };
    if (tierHierarchy[user.tier] < tierHierarchy[requiredTier]) {
      throw new ForbiddenException({
        code: 'TIER_REQUIRED',
        required_tier: requiredTier,
        current_tier: user.tier,
        message: `This feature requires a ${requiredTier} subscription`,
      });
    }

    return true;
  }
}
```

### 3.3 Service-Level Filtering

For Approach A (filtered responses), services check the user tier:

```typescript
// In operator service methods
async getOperatorDelegators(
  operatorId: string,
  params: ListDelegatorsDto,
  userTier: UserTier,
): Promise<DelegatorResponse> {
  const summary = await this.getDelegatorSummary(operatorId);

  if (userTier === UserTier.FREE) {
    return {
      total_delegators: summary.total,
      delegation_hhi_label: summary.hhiLabel,
      delegator_list: null,
      tier_context: {
        user_tier: 'free',
        gated_fields: ['delegator_list'],
        upgrade_message: 'Unlock individual delegator data with Pro',
      },
    };
  }

  // Pro users get full data
  const delegators = await this.delegatorRepo.findMany(operatorId, params);
  return {
    total_delegators: summary.total,
    delegation_hhi_label: summary.hhiLabel,
    delegator_list: delegators,
    tier_context: { user_tier: 'pro', gated_fields: [] },
  };
}
```

### 3.4 Extracting User from Request

```typescript
// In controllers
@Get(':id/delegators')
async getDelegators(
  @Param('id') operatorId: string,
  @Query() params: ListDelegatorsDto,
  @Req() request: Request,
) {
  const user = request.user; // May be null for unauthenticated
  const tier = user?.tier ?? UserTier.FREE;
  return this.operatorService.getOperatorDelegators(operatorId, params, tier);
}
```

### 3.5 Response DTO: TierContext

```typescript
// src/shared/dto/tier-context.dto.ts
export class TierContextDto {
  user_tier: string;
  gated_fields: string[];
  upgrade_message?: string;
}
```

Add `tier_context` to the `ApiResponse` type:

```typescript
export interface ApiResponse<T> {
  success: boolean;
  message: string | null;
  data: T | null;
  meta?: ResponseMeta;
  pagination?: PaginationMeta;
  tier_context?: TierContextDto;  // NEW
  error?: ErrorDetails;
}
```

---

## 4. Frontend Implementation

### 4.1 Tier-Aware Hooks

```typescript
// hooks/crud/useOperator.ts - updated
export const useOperatorDelegators = (operatorId: string, params?: DelegatorParams) => {
  return useQuery({
    queryKey: QUERY_KEYS.delegators(operatorId, params),
    queryFn: () => getDelegators(operatorId, params),
    select: (data) => ({
      ...data.data,
      isGated: data.data?.tier_context?.gated_fields?.length > 0,
      tierContext: data.data?.tier_context,
    }),
  });
};
```

### 4.2 ProGate Component

A reusable wrapper that handles the blur/lock pattern:

```tsx
// components/shared/ProGate.tsx
interface ProGateProps {
  isGated: boolean;
  feature: string;
  description?: string;
  children: React.ReactNode;
  mockContent?: React.ReactNode; // Optional mock data to show blurred
}

export const ProGate = ({ isGated, feature, description, children, mockContent }: ProGateProps) => {
  if (!isGated) return <>{children}</>;

  return (
    <div className="relative">
      {/* Blurred teaser */}
      <div className="blur-sm pointer-events-none select-none" aria-hidden>
        {mockContent || children}
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-background/60">
        <ProUpgradeCard feature={feature} description={description} />
      </div>
    </div>
  );
};
```

### 4.3 ProUpgradeCard Component

```tsx
// components/shared/ProUpgradeCard.tsx
export const ProUpgradeCard = ({ feature, description }: { feature: string; description?: string }) => (
  <div className="flex flex-col items-center gap-4 p-6 bg-card border border-border rounded-lg max-w-sm text-center">
    <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
      <Lock className="w-5 h-5 text-purple-500" />
    </div>
    <div>
      <h3 className="text-sm font-semibold text-foreground mb-1">{feature}</h3>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
    <div className="flex gap-2">
      <Button variant="default" size="sm">Upgrade to Pro</Button>
      <Button variant="ghost" size="sm">Learn More</Button>
    </div>
  </div>
);
```

### 4.4 PRO Badge Component

```tsx
export const ProBadge = () => (
  <Badge className="bg-purple-500/10 text-purple-500 border-purple-500/20 text-[10px] font-semibold">
    PRO
  </Badge>
);
```

### 4.5 Usage in Tabs

```tsx
// Example: DelegatorsTab.tsx
const DelegatorsTab = ({ operatorId }: { operatorId: string }) => {
  const { data, isLoading } = useOperatorDelegators(operatorId);

  return (
    <div>
      {/* Free content: always visible */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <StatCard title="Total Delegators" value={data?.total_delegators} />
        <StatCard
          title="Delegation Concentration"
          value={<UtilizationBadge level={data?.delegation_hhi_label} />}
        />
      </div>

      {/* Gated content */}
      <ProGate
        isGated={data?.isGated}
        feature="Delegator Intelligence"
        description="See individual delegator positions, whale tracking, and exit anticipation"
      >
        <ReuseableTable
          data={data?.delegator_list}
          columns={delegatorColumns}
        />
      </ProGate>
    </div>
  );
};
```

---

## 5. Per-Tab Gating Specification

### 5.1 Strategy Tab

| Data Point | Access | Implementation |
|-----------|--------|----------------|
| Total strategies (count) | FREE | Always in response |
| Combined TVS | FREE | Always in response |
| Dominant asset (headline) | FREE | Always in response |
| TVS distribution chart (pie/bar) | FREE | No hover breakdowns, no % tooltips |
| Strategy table (full metadata) | PRO | `tier_context.gated_fields: ["strategy_list"]` |
| Strategy name, USD amount, % dominance | PRO | Within strategy_list |
| Delegator count per strategy | PRO | Within strategy_list |
| Strategy concentration metrics | PRO | Within strategy_list |

**Endpoint:** `GET /api/v1/operators/:id/strategies`

**Free Response:**
```json
{
  "data": {
    "total_strategies": 5,
    "combined_tvs": "245000000",
    "dominant_asset": "stETH",
    "tvs_distribution": [
      { "label": "stETH", "percentage": 45.2 },
      { "label": "cbETH", "percentage": 32.1 },
      { "label": "Other", "percentage": 22.7 }
    ],
    "strategy_list": null
  },
  "tier_context": {
    "user_tier": "free",
    "gated_fields": ["strategy_list"]
  }
}
```

### 5.2 AVS Tab

| Data Point | Access | Implementation |
|-----------|--------|----------------|
| Total AVSs | FREE | Always in response |
| Active vs inactive count | FREE | Always in response |
| Total allocated (single number) | FREE | Always in response |
| Average commission (headline) | FREE | Always in response |
| AVS relationship table | PRO | Gated |
| Per-AVS allocation | PRO | Gated |
| Per-AVS commission | PRO | Gated |
| AVS concentration metrics | PRO | Gated |

**Endpoint:** `GET /api/v1/operators/:id/avs`

### 5.3 Delegator Tab

| Data Point | Access | Implementation |
|-----------|--------|----------------|
| Total delegators | FREE | Always in response |
| Delegation HHI label (Low/Med/High) | FREE | Always in response |
| Delegator list | PRO | Gated |
| Individual delegator TVS | PRO | Gated |
| % stake per delegator | PRO | Gated |
| Delegation date & status | PRO | Gated |

**Endpoint:** `GET /api/v1/operators/:id/delegators`

### 5.4 Allocation Tab

| Data Point | Access | Implementation |
|-----------|--------|----------------|
| Utilization level badge | FREE | Always in response |
| Active AVSs count | FREE | Always in response |
| Operator sets count | FREE | Always in response |
| Strategy utilization badges | FREE | Always in response |
| Allocation by AVS (exact) | PRO | Gated |
| Strategy-level utilization | PRO | Gated |
| AVS concentration metrics | PRO | Gated |
| Largest AVS exposure (%) | PRO | Gated |
| Raw HHI values | PRO | Gated |

**Endpoint:** `GET /api/v1/operators/:id/allocations`

### 5.5 Commission Tab

| Data Point | Access | Implementation |
|-----------|--------|----------------|
| Current headline commission | FREE | Always in response |
| Network median | FREE | Always in response |
| Positioning label (Cheap/Average/Expensive) | FREE | Always in response |
| Estimated annual cost | PRO | Gated |
| Commission history | PRO | Gated |
| Commission volatility | PRO | Gated |
| Per-AVS commission | PRO | Gated |
| Stability & rate age | PRO | Gated |
| Comparative charts | PRO | Gated |

**Endpoint:** `GET /api/v1/operators/:id/commission`

### 5.6 Risk Analysis Tab (Entire Tab = PRO)

| Data Point | Access | Implementation |
|-----------|--------|----------------|
| Numeric risk score | PRO | Approach B (entire endpoint gated) |
| Risk breakdown | PRO | Performance, economic, network, confidence |
| Delegation stability | PRO | |
| Growth trajectory | PRO | |
| Percentile rankings | PRO | |

**Endpoint:** `GET /api/v1/operators/:id/risk` → `@TierGated('pro')`

**Free users:** Show the tab with a full-page ProGate overlay explaining what they'd see.

### 5.7 Advanced Metrics (Enterprise/Higher-Tier)

| Data Point | Access |
|-----------|--------|
| Raw HHI values | ENTERPRISE |
| Raw volatility metrics | ENTERPRISE |
| Raw growth rates | ENTERPRISE |
| Distribution CV raw | ENTERPRISE |
| Data sufficiency indicators | ENTERPRISE |

### 5.8 Cross-Feature Gating

| Feature | Access |
|---------|--------|
| Compare operators | PRO |
| Watchlist (basic, 5 items) | FREE |
| Watchlist (unlimited + alerts) | PRO |
| Delegate CTA | Always visible |
| Operator search | FREE (basic), PRO (advanced filters) |

---

## 6. Gating UX Patterns

### 6.1 Pattern: Aggregate + Gated Detail

```
┌──────────────────────────────────────────┐
│ Total Delegators: 145  │  HHI: LOW      │  ← FREE (always visible)
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│ DELEGATOR        TVS        % STAKE      │  ← Table header (visible)
├──────────────────────────────────────────┤
│ 0xABC...1234    $12.5M     8.6%         │  ← First row visible (teaser)
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │  ← Blurred rows
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│          [🔒 Upgrade to Pro]             │  ← Lock overlay
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
└──────────────────────────────────────────┘
```

### 6.2 Pattern: Full Tab Gate (Risk Analysis)

```
┌──────────────────────────────────────────────────┐
│  [Overview] [Allocations] [Commission] ...       │
│                                                   │
│  ┌────────────────────────────────────────────┐  │
│  │                                            │  │
│  │    🔒 Risk Analysis - Pro Feature          │  │
│  │                                            │  │
│  │    Get EigenWatch's proprietary risk        │  │
│  │    assessment including:                    │  │
│  │                                            │  │
│  │    • Numeric risk score (0-100)            │  │
│  │    • Performance breakdown                  │  │
│  │    • Economic security analysis            │  │
│  │    • Network position ranking              │  │
│  │    • Delegation stability metrics          │  │
│  │                                            │  │
│  │    [Upgrade to Pro]  [Learn More]          │  │
│  │                                            │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### 6.3 Pattern: Chart Without Interactivity

Free charts show the shape of data but prevent drill-down:
- No hover tooltips with exact values
- No click-to-zoom
- Axis labels may be simplified
- The chart serves as a visual teaser

---

## 7. Migration Strategy

### 7.1 Phase 1: Backend Tier Logic

1. Add `TierGuard` and `@TierGated()` decorator
2. Add `tier_context` to `ApiResponse` type
3. Add user tier extraction from JWT in controllers
4. Modify service methods to accept and filter by tier
5. Start with one tab (Delegators) as proof of concept
6. Test with mock JWT tokens

### 7.2 Phase 2: Frontend ProGate Components

1. Build `ProGate`, `ProUpgradeCard`, and `ProBadge` components
2. Build mock data generators for blurred teasers
3. Integrate with one tab (Delegators) as proof of concept
4. Test visual appearance matches the style guide

### 7.3 Phase 3: Roll Out to All Tabs

Apply gating to remaining tabs in order:
1. Delegators (simplest - aggregate vs list)
2. Strategies (similar pattern)
3. AVS (similar pattern)
4. Allocations (mix of badges and detail)
5. Commission (mix of headline and behavior)
6. Risk Analysis (entire tab gated)

### 7.4 Phase 4: Cross-Feature Gating

1. Operator comparison → Pro gate
2. Watchlist limits → Pro gate
3. Advanced search filters → Pro gate

---

## Appendix: Free vs Pro Quick Reference

| Tab | Free | Pro |
|-----|------|-----|
| **Strategy** | Count, total TVS, dominant asset, distribution chart | Full table with weights, delegator counts, concentration |
| **AVS** | Count, active/inactive, total allocated, avg commission | Relationship table, per-AVS allocation/commission |
| **Delegator** | Count, HHI badge | Full list, individual TVS, % stake, dates |
| **Allocation** | Utilization badge, counts | Exact amounts, strategy utilization, concentration |
| **Commission** | Current rate, network median, positioning label | History, volatility, per-AVS, annual cost |
| **Risk** | Nothing (full gate) | Score, breakdown, stability, rankings |
| **Compare** | Nothing (full gate) | Full comparison |
| **Watchlist** | 5 items, no alerts | Unlimited, with alerts |
