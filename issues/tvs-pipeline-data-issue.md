# Issue: TVS Values Not Populated in Backend Tables

**Date Discovered:** 2026-01-22  
**Status:** Pending Pipeline Investigation  
**Affected Endpoint:** `GET /api/v1/operators/{id}/stats`

---

## Summary

The operator stats endpoint returns `total_tvs: 0` and empty `by_strategy` array because:

1. `operator_strategy_state` table has no records for operators
2. `operator_state.total_tvs` is `0` (likely computed from empty strategy states)
3. `operator_delegator_shares.tvs_usd` is `null` (not populated by pipeline)

---

## Observations

### Test Operator

```
ID: 0xa42cd0029f681b08b61f535e846f2a36f468c1c2
```

### Console Log Output

#### operator_state

```javascript
{
  operator_id: '0xa42cd0029f681b08b61f535e846f2a36f468c1c2',
  active_avs_count: 22,
  active_delegators: 357,
  total_delegators: 365,
  total_tvs: 0,                    // ❌ Should have a value
  tvs_updated_at: null,            // ❌ Never computed
  is_active: true,
  operational_days: 652,
  // ... other fields
}
```

#### operator_strategy_state

```javascript
[]; // ❌ EMPTY - No records for this operator
```

#### operator_delegator_shares (sample)

```javascript
{
  id: '0xa42cd0029f681b08b61f535e846f2a36f468c1c2-0x001461c431645ae6f6279054b6572bcbf66d2a91-0x54945180db7943c0ed0fee7edab2bd24620256bc',
  operator_id: '0xa42cd0029f681b08b61f535e846f2a36f468c1c2',
  staker_id: '0x001461c431645ae6f6279054b6572bcbf66d2a91',
  strategy_id: '0x54945180db7943c0ed0fee7edab2bd24620256bc',  // ✅ Has strategy reference
  shares: 50070226163852181n,                                 // ✅ Has shares
  tvs_usd: null,                                              // ❌ Not computed
  // ... other fields
}
```

---

## Data Flow Analysis

### Current State

```
operator_delegator_shares
  ├── Has records ✅
  ├── Has strategy_id references ✅
  ├── Has shares values ✅
  └── tvs_usd is NULL ❌

operator_strategy_state
  └── EMPTY ❌ (no records for operators)

operator_state
  ├── total_tvs = 0 ❌
  └── tvs_updated_at = null ❌
```

### Expected Data Flow

```
1. operator_delegator_shares.tvs_usd should be computed:
   tvs_usd = (shares * exchange_rate / 1e18) / 10**decimals * price_usd

2. operator_strategy_state should aggregate per (operator_id, strategy_id):
   - Sum of delegator shares for that strategy
   - tvs_usd = sum of delegator tvs_usd for that strategy
   - max_magnitude, encumbered_magnitude from allocation events

3. operator_state.total_tvs should be:
   - Sum of operator_strategy_state.tvs_usd for that operator
   OR
   - Sum of operator_delegator_shares.tvs_usd for that operator
```

---

## Pipeline Tasks to Verify/Fix

### 1. Delegator Shares TVS Calculation

**Table:** `operator_delegator_shares`  
**Column:** `tvs_usd`

**Expected Calculation:**

```python
# For each delegator share record:
exchange_rate = get_exchange_rate(strategy_address)  # From strategy_exchange_rates
token_decimals = get_token_decimals(underlying_token)  # From token_metadata
token_price = get_token_price(underlying_token)  # From token_prices

tvs_usd = ((shares * exchange_rate / 1e18) / 10**token_decimals) * token_price
```

**Questions:**

- Is there a job that populates `tvs_usd` on `operator_delegator_shares`?
- What triggers this calculation? (On new delegation? Daily batch?)
- Does this job have access to exchange rates and token prices?

---

### 2. Operator Strategy State Population

**Table:** `operator_strategy_state`

**Expected Records:**

```sql
-- Should have one record per (operator_id, strategy_id) combination
-- Aggregated from operator_delegator_shares

INSERT INTO operator_strategy_state (operator_id, strategy_id, ...)
SELECT
  operator_id,
  strategy_id,
  -- Aggregated values
FROM operator_delegator_shares
GROUP BY operator_id, strategy_id;
```

**Questions:**

- Is there a job that creates/updates `operator_strategy_state` records?
- What populates `max_magnitude` and `encumbered_magnitude`? (From allocation events?)
- What populates `tvs_usd`? (Sum of delegator shares or separate calculation?)

---

### 3. Operator State Total TVS

**Table:** `operator_state`  
**Columns:** `total_tvs`, `tvs_updated_at`

**Expected Calculation:**

```sql
UPDATE operator_state
SET
  total_tvs = (
    SELECT COALESCE(SUM(tvs_usd), 0)
    FROM operator_strategy_state
    WHERE operator_id = operator_state.operator_id
  ),
  tvs_updated_at = NOW();
```

**Questions:**

- What job updates `operator_state.total_tvs`?
- Should it sum from `operator_strategy_state` or directly from `operator_delegator_shares`?

---

## Database Schema Reference

### operator_delegator_shares

```prisma
model operator_delegator_shares {
  id                   String     @id
  operator_id          String
  staker_id            String
  strategy_id          String
  shares               Decimal
  tvs_usd              Decimal?   // ← NEEDS TO BE POPULATED
  // ...
}
```

### operator_strategy_state

```prisma
model operator_strategy_state {
  id                   String
  operator_id          String
  strategy_id          String
  max_magnitude        Decimal
  encumbered_magnitude Decimal
  tvs_usd              Decimal?   // ← NEEDS TO BE POPULATED
  // ...
}
```

### operator_state

```prisma
model operator_state {
  operator_id  String
  total_tvs    Decimal?   // ← NEEDS TO BE POPULATED
  tvs_updated_at DateTime? // ← NEEDS TO BE UPDATED
  // ...
}
```

---

## Verification Steps After Pipeline Fix

1. **Check delegator shares TVS:**

   ```sql
   SELECT strategy_id, COUNT(*) as records,
          SUM(CASE WHEN tvs_usd IS NOT NULL THEN 1 ELSE 0 END) as with_tvs
   FROM operator_delegator_shares
   WHERE operator_id = '0xa42cd0029f681b08b61f535e846f2a36f468c1c2'
   GROUP BY strategy_id;
   ```

2. **Check operator strategy state:**

   ```sql
   SELECT * FROM operator_strategy_state
   WHERE operator_id = '0xa42cd0029f681b08b61f535e846f2a36f468c1c2';
   ```

3. **Check operator state TVS:**

   ```sql
   SELECT operator_id, total_tvs, tvs_updated_at
   FROM operator_state
   WHERE operator_id = '0xa42cd0029f681b08b61f535e846f2a36f468c1c2';
   ```

4. **Test API endpoint:**

   ```bash
   curl "http://localhost:8000/api/v1/operators/0xa42cd0029f681b08b61f535e846f2a36f468c1c2/stats"
   ```

   Expected response should have:
   - `tvs.total` > 0
   - `tvs.by_strategy` array with strategy entries
   - Each strategy should have `tvs_usd` value

---

## Related Code Changes (Already Implemented)

The following backend changes have been made to use precomputed TVS values:

1. **`operator.mapper.ts`** - `mapToStatistics()` now:
   - Uses `operator_state.total_tvs` instead of summing `max_magnitude`
   - Includes `tvs_usd` in strategy breakdown
   - Uses async `getStrategyNameAsync()` for strategy names

2. **`operator.entities.ts`** - `StrategyBreakdown` now includes `tvs_usd` field

3. **Deprecated methods:**
   - `calculateTotalTVS()` - no longer used
   - `getStrategyName()` - replaced by async version

These code changes are ready and will work correctly once the pipeline populates the TVS values.
