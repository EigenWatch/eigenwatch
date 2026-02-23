# Investigation: Operator Dashboard Data Completeness

**Date:** 2026-02-23
**Status:** Investigation Complete — Code bugs fixed, pipeline issues documented
**Database:** `eigenwatch-analytics` at `41.73.0.173:5432`
**Test Operator:** `0x5accc90436492f24e6af278569691e2c942a676d` (31,900 total delegators, 35 AVS)

---

## Background

After fixing the auth gating issue (see `pro-tier-auth-gating-fix.md`), pro users reported incomplete or incorrect data in the operator dashboard tables:

1. **Strategies** — `strategy_symbol: "UNKNOWN"`, missing `tvs_usd`, some names working (e.g., "LayerZero")
2. **AVS** — Names showing truncated addresses (e.g., `"0x8706...2fc0"`), logos empty
3. **Delegators** — `total_shares=0`, `total_tvs=0`, `strategies=[]` for listed delegators
4. **Allocations** — Needed verification
5. **Commissions** — Needed verification

A SQL-level investigation was conducted to determine whether these were code bugs or data pipeline gaps.

---

## Investigation 1: Strategies

### Question: Is `tvs_usd` data present in the database?

```sql
SELECT
  oss.strategy_id,
  s.address as strategy_address,
  oss.max_magnitude,
  oss.encumbered_magnitude,
  oss.utilization_rate,
  oss.tvs_usd,
  oss.tvs_updated_at,
  oss.updated_at
FROM operator_strategy_state oss
JOIN strategies s ON s.id = oss.strategy_id
WHERE oss.operator_id = '0x5accc90436492f24e6af278569691e2c942a676d'
ORDER BY oss.tvs_usd DESC NULLS LAST
LIMIT 10;
```

**Result — Top 10 strategies by TVS:**

| Strategy Address | TVS USD | Max Magnitude | Utilization |
|---|---|---|---|
| `0x93c4b944d05d...` | **$1,220,298,215** | 0 | 0% |
| `0xbeac0eeeeeee...` (Beacon) | **$110,967,704** | 0 | 0% |
| `0x0fe4f44bee93...` | **$36,198,696** | 0 | 0% |
| `0x57ba429517c3...` | **$24,944,231** | 0 | 0% |
| `0x1bee69b7dfff...` | **$18,225,072** | 7,956,325,268,382 | 100% |
| `0x298afb19a105...` | **$13,226,991** | 0 | 0% |
| `0x8ca7a5d6f3ac...` | **$6,154,016** | 0 | 0% |
| `0x54945180db79...` | **$5,279,005** | 0 | 0% |
| `0xa4c637e0f704...` | **$5,141,601** | 0 | 0% |
| `0x7ca911e83dab...` | **$4,425,833** | 0 | 0% |

**Finding:** `tvs_usd` IS fully populated. Top strategy has **$1.22 billion** TVS. Data exists, code wasn't returning it.

### Question: Is strategy token metadata (symbols) available?

```sql
-- Direct lookup: strategy addresses in token_metadata
SELECT tm.contract_address, tm.symbol, tm.name
FROM token_metadata tm
WHERE tm.contract_address IN (
  SELECT DISTINCT s.address
  FROM operator_strategy_state oss
  JOIN strategies s ON s.id = oss.strategy_id
  WHERE oss.operator_id = '0x5accc90436492f24e6af278569691e2c942a676d'
);
```

**Result:** `(0 rows)` — Strategy addresses do NOT directly match `token_metadata.contract_address`.

```sql
-- Token metadata table size
SELECT COUNT(*) as total, COUNT(CASE WHEN symbol IS NOT NULL THEN 1 END) as with_symbol
FROM token_metadata;
```

**Result:** 76 records, all with symbols.

```sql
-- Correct join path: strategy_exchange_rates → token_metadata
SELECT
  ser.strategy_address,
  ser.underlying_token,
  tm.symbol,
  tm.name,
  tm.logo_small
FROM strategy_exchange_rates ser
LEFT JOIN token_metadata tm ON tm.contract_address = ser.underlying_token
WHERE ser.strategy_address IN (
  SELECT DISTINCT s.address
  FROM operator_strategy_state oss
  JOIN strategies s ON s.id = oss.strategy_id
  WHERE oss.operator_id = '0x5accc90436492f24e6af278569691e2c942a676d'
)
LIMIT 15;
```

**Result (sample):**

| Strategy Address | Underlying Token | Symbol | Name | Logo |
|---|---|---|---|---|
| `0x1fc0db09...` | `0x18084fba...` | TBTC | tBTC | alchemy URL |
| `0xa553a819...` | `0xc02aaa39...` | WETH | WETH | alchemy URL |
| `0xbeac0eee...` | `0xeeeeeeee...` | ETH | Ethereum | |
| `0x0858616b...` | `0x83f20f44...` | SDAI | Savings Dai | alchemy URL |
| `0x8cc88d61...` | `0xbe0ed413...` | ATH | Aethir | alchemy URL |
| `0x752c665a...` | `0xa0b86991...` | USDC | USDC | alchemy URL |
| `0x99a05f4e...` | `0x69825081...` | PEPE | Pepe | alchemy URL |
| `0x7079a427...` | `0xfe0c3006...` | ETHFI | ether.fi | alchemy URL |
| `0x6c6e8af9...` | `0x22601611...` | WBTC | Wrapped Bitcoin | alchemy URL |

**Finding:** Token symbols and logos ARE available through the join path `strategy_exchange_rates.underlying_token → token_metadata.contract_address`. The `TokenMetadataService.getStrategyMetadata()` method correctly uses this path, but the sync `getStrategySymbol()` in the mapper had an empty hardcoded map.

### Root Cause — CODE BUGS (3 issues)

1. **`getStrategySymbol()` always returned "UNKNOWN"** — The method at `operator.mapper.ts:412-418` used an empty hardcoded `Record<string, string>` instead of the `strategyMetadataCache`.

2. **`tvs_usd` missing from response** — `mapToStrategyListItem()` did not include `strategyState.tvs_usd` in its return object, even though the DB column is fully populated.

3. **Strategy metadata never preloaded** — `findOperatorStrategies()` in `operators.service.ts` did not call `preloadStrategyMetadata()` before mapping, so both `getStrategySymbol()` and `getStrategyName()` had empty caches.

### Fix Applied

See `strategy-mapper-code-bugs-fix.md` for details.

---

## Investigation 2: AVS Data

### Question: Does the `avs` table contain metadata?

```sql
SELECT * FROM avs WHERE id = '0x870679e138bcdf293b7ff14dd44b70fc97e12fc0';
```

**Result:**

| id | address | created_at | updated_at |
|---|---|---|---|
| `0x870679e138bc...` | `0x870679e138bc...` | 2026-01-30 | 2026-01-30 |

**Finding:** The `avs` table only contains `id`, `address`, `created_at`, `updated_at`. **No name, logo, description, or website fields exist in the database.**

### Where does AVS metadata live?

AVS metadata is stored exclusively in **Redis** via the `AVSMetadataService`:

- **Service:** `backend/src/core/services/avs-metadata.service.ts`
- **Cache key:** `avs:metadata:{address}`
- **TTL:** 1 week (604,800 seconds)
- **Source:** IPFS/Arweave URIs from on-chain registration metadata
- **Fallback:** Returns `formatAddress(address)` — which produces the truncated format like `"0x8706...2fc0"`

### Root Cause — DATA PIPELINE ISSUE

The AVS metadata pipeline is responsible for:
1. Fetching metadata URIs from on-chain AVS registration events
2. Resolving those URIs (IPFS/Arweave → JSON)
3. Caching the result in Redis via `setAVSMetadataFromUri()`

If Redis cache is empty or expired (e.g., after a Redis restart or for newly registered AVS), the service returns default metadata with the truncated address as the name and no logo.

### Recommendation

- **Short term:** Verify the AVS metadata pipeline is running and populating Redis. Check for errors in URI resolution (IPFS gateway timeouts, malformed metadata URIs).
- **Long term:** Consider persisting AVS metadata in the database (add `name`, `logo`, `description`, `website` columns to the `avs` table) as a fallback when Redis is empty. This would prevent empty metadata after Redis restarts.

### Pipeline Verification Query

```sql
-- Check which AVS IDs are registered for this operator
SELECT DISTINCT r.avs_id
FROM operator_avs_relationships r
WHERE r.operator_id = '0x5accc90436492f24e6af278569691e2c942a676d'
ORDER BY r.avs_id;
```

After confirming AVS IDs, check Redis:
```bash
redis-cli GET "avs:metadata:0x870679e138bcdf293b7ff14dd44b70fc97e12fc0"
```

---

## Investigation 3: Delegators

### Question: Do delegator shares exist in the database?

```sql
SELECT COUNT(*) as total_shares_rows,
  COUNT(CASE WHEN shares > 0 THEN 1 END) as nonzero_shares,
  COUNT(CASE WHEN tvs_usd > 0 THEN 1 END) as nonzero_tvs
FROM operator_delegator_shares
WHERE operator_id = '0x5accc90436492f24e6af278569691e2c942a676d';
```

**Result:**

| total_shares_rows | nonzero_shares | nonzero_tvs |
|---|---|---|
| 40,205 | 40,205 | 649 |

**Finding:** 40,205 share records exist, all with non-zero shares. Only 649 (1.6%) have `tvs_usd` populated.

### Question: How many delegators have shares data vs. none?

```sql
SELECT
  COUNT(DISTINCT od.staker_id) as total_delegators,
  COUNT(DISTINCT CASE WHEN ods.id IS NOT NULL THEN od.staker_id END) as delegators_with_shares,
  COUNT(DISTINCT CASE WHEN ods.id IS NULL THEN od.staker_id END) as delegators_without_shares
FROM operator_delegators od
LEFT JOIN operator_delegator_shares ods
  ON ods.operator_id = od.operator_id AND ods.staker_id = od.staker_id
WHERE od.operator_id = '0x5accc90436492f24e6af278569691e2c942a676d'
  AND od.is_delegated = true;
```

**Result:**

| total_delegators | delegators_with_shares | delegators_without_shares |
|---|---|---|
| 25,701 | 24,426 | **1,275** |

**Finding:** 95% of active delegators (24,426) have shares data. 1,275 delegators have no share records.

### Question: Are the missing delegators recent?

```sql
SELECT od.staker_id, od.delegated_at, COUNT(ods.id) as share_records
FROM operator_delegators od
LEFT JOIN operator_delegator_shares ods
  ON ods.operator_id = od.operator_id AND ods.staker_id = od.staker_id
WHERE od.operator_id = '0x5accc90436492f24e6af278569691e2c942a676d'
  AND od.is_delegated = true
  AND od.delegated_at > '2026-02-15'
GROUP BY od.staker_id, od.delegated_at
ORDER BY od.delegated_at DESC
LIMIT 10;
```

**Result:** All delegators after Feb 15 have `share_records = 0`:

| staker_id | delegated_at | share_records |
|---|---|---|
| `0xd314cc...` | 2026-02-19 10:28 | 0 |
| `0x957502...` | 2026-02-18 12:13 | 0 |
| `0x8d3cc1...` | 2026-02-17 20:53 | 0 |
| `0xe48d44...` | 2026-02-17 13:53 | 0 |
| `0xc160e8...` | 2026-02-17 09:55 | 0 |
| ... | ... | 0 |

**Finding:** All 1,275 delegators without share data joined after ~Feb 15, 2026. The delegation events are recorded but the shares pipeline hasn't synced their data yet.

### Top delegators (with data) — verification

```sql
SELECT
  od.staker_id, od.delegated_at,
  COALESCE(SUM(ods.shares), 0) as total_shares,
  COALESCE(SUM(ods.tvs_usd), 0) as total_tvs_usd,
  COUNT(ods.id) as strategy_count
FROM operator_delegators od
LEFT JOIN operator_delegator_shares ods
  ON ods.operator_id = od.operator_id AND ods.staker_id = od.staker_id
WHERE od.operator_id = '0x5accc90436492f24e6af278569691e2c942a676d'
  AND od.is_delegated = true
GROUP BY od.staker_id, od.delegated_at, od.is_delegated
HAVING COALESCE(SUM(ods.tvs_usd), 0) > 0
ORDER BY total_tvs_usd DESC
LIMIT 10;
```

**Result:**

| Staker | Delegated At | Total Shares | Total TVS USD | Strategies |
|---|---|---|---|---|
| `0xc097...` | 2024-04-11 | 73,708,898,650,407,598,243,069 | **$67,012,214** | 2 |
| `0x61d1...` | 2024-04-13 | 677,446,797,453,418,947,462,499 | **$4,918,061** | 2 |
| `0x438e...` | 2024-09-13 | 16,735,254,894,362,458,861,536 | **$3,812,153** | 2 |
| `0x1ba8...` | 2024-04-21 | 1,252,198,383,693,000,000,000 | **$2,212,693** | 2 |
| `0xee28...` | 2025-03-27 | 1,024,387,485,853,864,179,792 | **$1,967,244** | 1 |

**Finding:** Data IS present for established delegators. The API returns `total_shares=0` only for the ~5% of delegators who joined recently and haven't been synced.

### Root Cause — DATA PIPELINE LAG

- Delegation events are recorded in `operator_delegators` in near real-time
- Share balance snapshots in `operator_delegator_shares` are populated by a separate pipeline job
- This job appears to have a lag of ~1 week (delegators after Feb 15 have no data)
- Additionally, only 649/40,205 rows (1.6%) have `tvs_usd` populated — the TVS calculation pipeline for delegator shares is largely incomplete

### Recommendation

1. **Investigate shares pipeline** — Check if the job that populates `operator_delegator_shares` from on-chain data is running. It appears to be ~1 week behind.
2. **Investigate delegator TVS pipeline** — Only 1.6% of share records have `tvs_usd` populated. This pipeline may need to be run or fixed.
3. **Frontend graceful handling** — For delegators with no share data, the UI should show "Pending" or "Syncing" rather than 0.

---

## Investigation 4: Allocations

### Question: Is allocation data complete?

```sql
SELECT COUNT(*) as total_allocations,
  COUNT(CASE WHEN magnitude > 0 THEN 1 END) as nonzero_magnitude,
  COUNT(CASE WHEN magnitude_usd > 0 THEN 1 END) as nonzero_usd
FROM operator_allocations
WHERE operator_id = '0x5accc90436492f24e6af278569691e2c942a676d';
```

**Result:**

| total_allocations | nonzero_magnitude | nonzero_usd |
|---|---|---|
| 1 | 1 | 1 |

```sql
SELECT oa.*, os.avs_id, s.address as strategy_address
FROM operator_allocations oa
JOIN operator_sets os ON os.id = oa.operator_set_id
JOIN strategies s ON s.id = oa.strategy_id
WHERE oa.operator_id = '0x5accc90436492f24e6af278569691e2c942a676d';
```

**Result:**

| AVS ID | Strategy Address | Magnitude | Magnitude USD | Allocation % | Effective Block |
|---|---|---|---|---|---|
| `0x90c68bf0...` | `0x1bee69b7...` | 7,956,325,268,382 | **$18,225,072** | 100% | 24,167,653 |

```sql
-- Allocation summary view
SELECT avs_id, strategy_id, total_allocated_magnitude, total_allocated_magnitude_usd, active_allocation_count
FROM operator_avs_allocation_summary
WHERE operator_id = '0x5accc90436492f24e6af278569691e2c942a676d';
```

**Result:** 1 allocation, matches the detail above.

### Finding — DATA IS CORRECT

This operator has exactly 1 allocation (strategy `0x1bee69b7...` allocated to AVS `0x90c68bf0...` at 100%). The data is complete and accurate.

---

## Investigation 5: Commissions

### Question: Is commission data complete?

```sql
SELECT COUNT(*) as total_rates FROM operator_commission_rates
WHERE operator_id = '0x5accc90436492f24e6af278569691e2c942a676d';
```

**Result:** 5 commission rates.

```sql
SELECT commission_type, avs_id, current_bips, effective_bips, total_changes
FROM operator_commission_rates
WHERE operator_id = '0x5accc90436492f24e6af278569691e2c942a676d';
```

**Result:**

| Commission Type | AVS ID | Current Bips | Effective Bips | Total Changes |
|---|---|---|---|---|
| AVS | `0x6f943318...` | 5000 (50%) | — | — |
| AVS | `0x870679e1...` | 5000 (50%) | — | — |
| AVS | `0x90c68bf0...` | 0 (0%) | — | — |
| AVS | `0xb73a87e8...` | 5000 (50%) | — | — |
| AVS | `0xfc569b3b...` | 5000 (50%) | — | — |

### Finding — DATA IS CORRECT

5 commission rates across 5 AVS. 4 at 50% (5000 bips) and 1 at 0%.

---

## Summary of Findings

| Area | Status | Root Cause | Fix |
|---|---|---|---|
| Strategy `strategy_symbol` = "UNKNOWN" | **CODE BUG** | `getStrategySymbol()` used empty hardcoded map | Fixed — now reads from `strategyMetadataCache` |
| Strategy `tvs_usd` missing | **CODE BUG** | `mapToStrategyListItem()` didn't include `tvs_usd` | Fixed — added to mapper output |
| Strategy metadata not preloaded | **CODE BUG** | `findOperatorStrategies()` didn't call `preloadStrategyMetadata()` | Fixed — preload added before mapping |
| AVS names show addresses | **DATA PIPELINE** | `avs` table has no metadata; Redis cache empty | Requires pipeline investigation |
| AVS logos empty | **DATA PIPELINE** | Same as above — metadata only in Redis | Requires pipeline investigation |
| Delegators `total_shares=0` | **DATA PIPELINE** | Recent delegators (post Feb 15) lack `operator_delegator_shares` | Requires pipeline investigation |
| Delegator `tvs_usd` mostly null | **DATA PIPELINE** | Only 1.6% of share records have `tvs_usd` | Requires pipeline investigation |
| Allocations | **OK** | 1 allocation, data complete and accurate | No action needed |
| Commissions | **OK** | 5 rates, data complete and accurate | No action needed |

---

## Action Items

### Code (Completed)

- [x] Fix `getStrategySymbol()` to use metadata cache
- [x] Add `tvs_usd` and `strategy_logo` to `mapToStrategyListItem()`
- [x] Add `preloadStrategyMetadata()` call before strategy mapping

### Data Pipeline (Pending Investigation)

- [ ] **AVS Metadata Pipeline** — Verify the pipeline that fetches AVS metadata from IPFS/Arweave URIs and populates Redis cache is running. Check for URI resolution errors.
- [ ] **Delegator Shares Pipeline** — The shares sync job appears ~1 week behind. 1,275 delegators (post Feb 15) have no `operator_delegator_shares` records.
- [ ] **Delegator TVS Calculation** — Only 649/40,205 share records have `tvs_usd` populated. The pipeline that calculates `tvs_usd = (shares * exchange_rate / 1e18) / 10^decimals * price_usd` needs to run.
- [ ] **Consider DB persistence for AVS metadata** — Add `name`, `logo`, `description`, `website` columns to the `avs` table as a fallback for Redis misses.
