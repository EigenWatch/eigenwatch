# Implementation Plan: Enhanced Allocations, Commissions & Delegator Insights

## Executive Summary

This plan addresses issues with current allocation/commission endpoints and proposes enhanced endpoints that provide meaningful insights. The key principles:

1. **Never sum magnitudes across strategies** - magnitudes are ratios relative to different bases
2. **Always use USD values for aggregations** - USD is the common denominator
3. **Focus on utilization and risk metrics** - these tell the real story
4. **Provide delegator-centric views** - help delegators understand their exposure

---

## Current State Analysis

### Data Availability (as of current DB state)

| Table | Field | Populated |
|-------|-------|-----------|
| `operator_allocations` | `magnitude` | ✅ 32 rows |
| `operator_allocations` | `magnitude_usd` | ⚠️ 3/32 rows |
| `operator_allocations` | `allocation_percent` | ⚠️ 3/32 rows |
| `operator_allocations` | `applicable_commission_bips` | ❌ 0 rows |
| `operator_strategy_state` | `tvs_usd` | ✅ 572/585 rows |
| `operator_strategy_state` | `max_magnitude` | ⚠️ 2/585 rows |
| `operator_strategy_state` | `encumbered_magnitude` | ⚠️ 15/585 rows |
| `operator_delegator_shares` | `tvs_usd` | ✅ Fully populated |

### Issues with Current Endpoints

1. **`total_encumbered_magnitude`** - Summing ratios is meaningless
2. **Missing USD context** - Raw magnitudes don't convey value
3. **No risk metrics** - Utilization, concentration not surfaced
4. **No delegator perspective** - Can't see "how much of MY stake is at risk"

---

## Proposed Endpoint Structure

### 1. Allocation Overview (Enhanced)

**Endpoint:** `GET /operators/:id/allocations`

**Purpose:** Operator's allocation posture across all AVSs and strategies

```typescript
interface AllocationOverviewResponse {
  // Summary metrics (USD-based aggregations ARE meaningful)
  summary: {
    total_allocated_usd: string;           // Sum of all allocation USD values
    total_tvs_usd: string;                 // Total Value Secured
    overall_utilization_pct: string;       // Weighted avg utilization
    total_avs_count: number;
    total_operator_set_count: number;
    total_allocation_count: number;
  };

  // Per-strategy breakdown (utilization is meaningful per-strategy)
  by_strategy: {
    strategy_id: string;
    strategy_address: string;
    strategy_symbol: string;
    strategy_logo: string | null;
    tvs_usd: string;                       // Total value in this strategy
    allocated_usd: string;                 // Value allocated to AVSs
    available_usd: string;                 // Value NOT yet allocated
    utilization_pct: string;               // encumbered/max as percentage
    utilization_status: 'low' | 'moderate' | 'high' | 'critical';
    avs_count: number;                     // How many AVSs use this strategy
  }[];

  // Per-AVS breakdown (shows where value is going)
  by_avs: {
    avs_id: string;
    avs_address: string;
    avs_name: string;
    avs_logo: string | null;
    total_allocated_usd: string;           // USD allocated to this AVS
    allocation_share_pct: string;          // % of total allocations
    operator_set_count: number;
    strategies_used: {
      strategy_id: string;
      strategy_symbol: string;
      allocated_usd: string;
    }[];
  }[];

  // Risk indicators
  risk_metrics: {
    avs_concentration_hhi: number;         // 0-10000, higher = more concentrated
    strategy_concentration_hhi: number;
    highest_single_avs_exposure_pct: string;
    utilization_risk_level: 'low' | 'moderate' | 'high';
  };
}
```

**Utilization Status Thresholds:**
- `low`: < 50%
- `moderate`: 50-70%
- `high`: 70-90%
- `critical`: > 90%

---

### 2. Detailed Allocations (Enhanced)

**Endpoint:** `GET /operators/:id/allocations/detailed`

**Purpose:** Granular view of each allocation with commission info

```typescript
interface DetailedAllocationItem {
  allocation_id: string;

  // AVS/Operator Set info
  avs_id: string;
  avs_name: string;
  avs_logo: string | null;
  operator_set_id: string;
  operator_set_number: number;

  // Strategy info
  strategy_id: string;
  strategy_symbol: string;
  strategy_logo: string | null;

  // Magnitude (ratio) - kept for reference but not summed
  magnitude_raw: string;                   // Raw magnitude value
  magnitude_pct: string;                   // As percentage (e.g., "50.00")

  // USD value (the meaningful metric)
  allocated_usd: string;

  // Commission applicable to this allocation
  commission: {
    effective_bips: number;                // The actual commission that applies
    source: 'pi' | 'avs' | 'operator_set'; // Where it comes from
    display_pct: string;                   // e.g., "10.00" for 1000 bips
  } | null;

  // Timing
  allocated_at: string;
  effect_block: number;
}

interface DetailedAllocationsResponse {
  allocations: DetailedAllocationItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
  // Summary doesn't include magnitude sums
  summary: {
    total_allocated_usd: string;
    average_commission_bips: number;
  };
}
```

---

### 3. Commission Overview (Enhanced)

**Endpoint:** `GET /operators/:id/commission`

**Current implementation is good, but add:**

```typescript
interface CommissionOverviewResponse {
  // ... existing fields ...

  // NEW: Commission impact analysis
  impact_analysis: {
    // What delegators actually pay (weighted by allocation value)
    weighted_average_commission_bips: number;
    weighted_average_commission_pct: string;

    // Breakdown by source
    allocation_by_commission_source: {
      pi: { usd_amount: string; pct_of_total: string };
      avs: { usd_amount: string; pct_of_total: string };
      operator_set: { usd_amount: string; pct_of_total: string };
    };

    // Comparison context
    vs_network_average: 'lower' | 'similar' | 'higher';
    percentile_rank: number;  // e.g., 75 means lower than 75% of operators
  };
}
```

---

### 4. NEW: Delegator Risk Exposure

**Endpoint:** `GET /operators/:id/delegators/:staker_id/exposure`

**Purpose:** Show a specific delegator their risk exposure through this operator

```typescript
interface DelegatorExposureResponse {
  delegator: {
    staker_id: string;
    staker_address: string;
    total_delegated_usd: string;
  };

  operator: {
    operator_id: string;
    operator_name: string | null;
  };

  // Exposure breakdown
  exposure_by_avs: {
    avs_id: string;
    avs_name: string;

    // How much of delegator's stake is "at risk" for this AVS
    exposed_usd: string;               // delegator's share of allocated value
    exposure_pct: string;              // % of delegator's total stake

    // What happens if this AVS slashes
    max_slashing_pct: string;          // Maximum slashable (usually 100% of exposed)
    max_slashing_usd: string;
  }[];

  // Exposure by strategy (different angle)
  exposure_by_strategy: {
    strategy_id: string;
    strategy_symbol: string;
    delegator_shares: string;
    delegator_tvs_usd: string;
    utilization_pct: string;           // How much is allocated to AVSs
    at_risk_usd: string;               // TVS * utilization
  }[];

  // Risk summary
  risk_summary: {
    total_at_risk_usd: string;         // Total value that could be slashed
    at_risk_pct: string;               // % of total delegation
    highest_avs_exposure_name: string;
    highest_avs_exposure_usd: string;
    diversification_score: number;     // 0-100, higher = more diversified
  };
}
```

---

### 5. NEW: Operator Delegators (Enhanced)

**Endpoint:** `GET /operators/:id/delegators`

**Changes:**
1. Default sort by TVS (descending)
2. Add exposure metrics

```typescript
interface DelegatorListItem {
  staker_id: string;
  staker_address: string;

  // Value metrics
  total_tvs_usd: string;               // Total Value Secured
  share_of_operator_tvs_pct: string;   // e.g., "5.25" for 5.25%

  // Risk exposure (summarized)
  at_risk_usd: string;                 // Value exposed to potential slashing
  at_risk_pct: string;                 // % of their TVS at risk

  // Strategy breakdown
  strategies: {
    strategy_id: string;
    strategy_symbol: string;
    tvs_usd: string;
    shares: string;
  }[];

  // Timing
  delegated_at: string | null;
  is_active: boolean;
}

// Query params
interface ListDelegatorsDto {
  // ... existing filters ...
  sort_by?: 'tvs' | 'shares' | 'delegation_date' | 'at_risk';  // default: 'tvs'
  sort_order?: 'asc' | 'desc';  // default: 'desc'
}
```

---

## Implementation Phases

### Phase 1: Fix Critical Issues (Immediate)

1. **Strategy metadata case sensitivity** ([token-metadata.service.ts](src/core/services/token-metadata.service.ts))
   - Normalize addresses to lowercase before DB lookup

2. **Delegator default sort** ([delegator.dto.ts](src/modules/operators/dto/delegator.dto.ts))
   - Change default from `shares` to `tvs`

### Phase 2: Enhanced Allocation Overview

1. Remove `total_encumbered_magnitude` from response
2. Add USD-based aggregations
3. Add utilization metrics per strategy
4. Add risk indicators (HHI, concentration)

**Files to modify:**
- [operator-allocation.repository.ts](src/modules/operators/repositories/operator-allocation.repository.ts)
- [operator.mapper.ts](src/modules/operators/mappers/operator.mapper.ts)
- [allocation.dto.ts](src/modules/operators/dto/allocation.dto.ts)
- [allocation.entities.ts](src/modules/operators/entities/allocation.entities.ts)

### Phase 3: Enhanced Commission Overview

1. Add `impact_analysis` section
2. Calculate weighted average commission
3. Add network comparison

**Files to modify:**
- [operator-avs.repository.ts](src/modules/operators/repositories/operator-avs.repository.ts)
- [commission-response.dto.ts](src/modules/operators/dto/commission-response.dto.ts)

### Phase 4: Delegator Exposure Endpoint

1. Create new endpoint `/operators/:id/delegators/:staker_id/exposure`
2. Calculate per-AVS exposure
3. Calculate risk summary

**Files to create/modify:**
- New: `delegator-exposure.dto.ts`
- New: `delegator-exposure.entities.ts`
- Modify: [operators.controller.ts](src/modules/operators/operators.controller.ts)
- Modify: [operators.service.ts](src/modules/operators/operators.service.ts)

### Phase 5: AVS Metadata Caching

1. Create `avs_metadata` table (or use existing `avs` table with new columns)
2. Create `AVSMetadataService`
3. Handle both direct JSON and URI-based metadata
4. Normalize to consistent structure
5. Cache in Redis (24h TTL)

---

## Data Pipeline Requirements

The following fields need to be populated by the data pipeline:

| Table | Field | Calculation |
|-------|-------|-------------|
| `operator_allocations` | `magnitude_usd` | `shares * (magnitude/max_magnitude) * exchange_rate * price` |
| `operator_allocations` | `allocation_percent` | `magnitude / max_magnitude * 100` |
| `operator_allocations` | `applicable_commission_bips` | Resolve from PI → AVS → Operator Set hierarchy |
| `operator_strategy_state` | `max_magnitude` | From `MaxMagnitudeUpdated` events |
| `operator_strategy_state` | `encumbered_magnitude` | From `EncumberedMagnitudeUpdated` events |
| `operator_strategy_state` | `utilization_rate` | `encumbered / max * 100` |

---

## API Response Examples

### Allocation Overview Example

```json
{
  "summary": {
    "total_allocated_usd": "1250000.00",
    "total_tvs_usd": "5000000.00",
    "overall_utilization_pct": "65.5",
    "total_avs_count": 3,
    "total_operator_set_count": 5,
    "total_allocation_count": 8
  },
  "by_strategy": [
    {
      "strategy_id": "0x93c4...",
      "strategy_symbol": "stETH",
      "tvs_usd": "3500000.00",
      "allocated_usd": "875000.00",
      "available_usd": "2625000.00",
      "utilization_pct": "25.0",
      "utilization_status": "low",
      "avs_count": 2
    }
  ],
  "by_avs": [
    {
      "avs_id": "0xe8e5...",
      "avs_name": "EigenDA",
      "total_allocated_usd": "500000.00",
      "allocation_share_pct": "40.0",
      "operator_set_count": 2,
      "strategies_used": [
        { "strategy_symbol": "stETH", "allocated_usd": "300000.00" },
        { "strategy_symbol": "cbETH", "allocated_usd": "200000.00" }
      ]
    }
  ],
  "risk_metrics": {
    "avs_concentration_hhi": 3400,
    "strategy_concentration_hhi": 4900,
    "highest_single_avs_exposure_pct": "40.0",
    "utilization_risk_level": "moderate"
  }
}
```

---

## Migration Notes

1. **Backward Compatibility:** Keep old response fields temporarily with deprecation notices
2. **Versioning:** Consider `/v2/` prefix for new endpoints or feature flag
3. **Documentation:** Update OpenAPI/Swagger specs

---

## Next Steps

1. [ ] Review and approve this plan
2. [ ] Implement Phase 1 fixes (case sensitivity, sort default)
3. [ ] Create DTOs and entities for new response structures
4. [ ] Implement enhanced allocation overview
5. [ ] Implement delegator exposure endpoint
6. [ ] Implement AVS metadata caching
7. [ ] Update API documentation
