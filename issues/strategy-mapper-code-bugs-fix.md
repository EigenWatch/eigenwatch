# Issue: Strategy Mapper Code Bugs — Symbol, TVS, and Metadata Preloading

**Date Discovered:** 2026-02-23
**Status:** Fixed
**Severity:** High
**Affected Endpoint:** `GET /api/v1/operators/{id}/strategies`

---

## Summary

Three code bugs in the strategy mapping pipeline caused the operator strategies endpoint to return:
- `strategy_symbol: "UNKNOWN"` for all strategies
- Missing `tvs_usd` field (despite data being present in the database)
- Missing `strategy_logo` field

---

## Bug 1: `getStrategySymbol()` Always Returns "UNKNOWN"

### Location

`backend/src/modules/operators/mappers/operator.mapper.ts` — line 412-418

### Before (Broken)

```typescript
private getStrategySymbol(address: string): string {
  // Strategy symbol mapping
  const symbols: Record<string, string> = {
    // Add known strategy addresses and symbols
  };
  return symbols[address?.toLowerCase()] || "UNKNOWN";
}
```

The method used an empty hardcoded `Record<string, string>`. No entries were ever added, so it always fell through to the `"UNKNOWN"` default.

Meanwhile, the async counterpart `getStrategySymbolAsync()` (line 273-290) correctly queries the `TokenMetadataService` and uses the `strategyMetadataCache`, but is not called from `mapToStrategyListItem()`.

The sibling method `getStrategyName()` (line 232-245) **did** correctly check `strategyMetadataCache` first — the symbol method just wasn't updated to match.

### After (Fixed)

```typescript
private getStrategySymbol(address: string): string {
  if (!address) return "UNKNOWN";
  const cached = this.strategyMetadataCache.get(address.toLowerCase());
  if (cached) return cached.symbol || "UNKNOWN";
  return "UNKNOWN";
}
```

Now reads from `strategyMetadataCache` — the same cache populated by `preloadStrategyMetadata()`.

---

## Bug 2: `tvs_usd` Missing from Strategy List Response

### Location

`backend/src/modules/operators/mappers/operator.mapper.ts` — `mapToStrategyListItem()` (line 318-343)

### Before (Broken)

```typescript
mapToStrategyListItem(strategyState: any, delegatorCount: number): OperatorStrategyListItem {
  // ...
  return {
    strategy_id: strategyState.strategy_id,
    strategy_address: strategyState.strategies?.address ?? "",
    strategy_name: this.getStrategyName(strategyState.strategies?.address),
    strategy_symbol: this.getStrategySymbol(strategyState.strategies?.address),
    max_magnitude: strategyState.max_magnitude.toString(),
    encumbered_magnitude: strategyState.encumbered_magnitude.toString(),
    available_magnitude: available.toString(),
    utilization_rate: utilization.toFixed(4),
    last_updated_at: strategyState.updated_at?.toISOString() ?? "",
    delegator_count: delegatorCount,
  };
}
```

No `tvs_usd` or `strategy_logo` in the return object. The `OperatorStrategyListItem` entity type was also missing these fields.

### After (Fixed)

Entity type updated (`strategy.entities.ts`):

```typescript
export interface OperatorStrategyListItem {
  strategy_id: string;
  strategy_address: string;
  strategy_name: string;
  strategy_symbol: string;
  strategy_logo: string | null;  // ← Added
  max_magnitude: string;
  encumbered_magnitude: string;
  available_magnitude: string;
  utilization_rate: string;
  tvs_usd: string;              // ← Added
  last_updated_at: string;
  delegator_count: number;
}
```

Mapper updated:

```typescript
mapToStrategyListItem(strategyState: any, delegatorCount: number): OperatorStrategyListItem {
  // ...
  const address = strategyState.strategies?.address ?? "";
  const cached = address
    ? this.strategyMetadataCache.get(address.toLowerCase())
    : null;

  return {
    strategy_id: strategyState.strategy_id,
    strategy_address: address,
    strategy_name: this.getStrategyName(address),
    strategy_symbol: this.getStrategySymbol(address),
    strategy_logo: cached?.logo_url ?? null,              // ← Added
    max_magnitude: strategyState.max_magnitude.toString(),
    encumbered_magnitude: strategyState.encumbered_magnitude.toString(),
    available_magnitude: available.toString(),
    utilization_rate: utilization.toFixed(4),
    tvs_usd: strategyState.tvs_usd?.toString() ?? "0",   // ← Added
    last_updated_at: strategyState.updated_at?.toISOString() ?? "",
    delegator_count: delegatorCount,
  };
}
```

The `strategy_logo` is sourced from the `StrategyMetadata.logo_url` field (populated via `strategy_exchange_rates.underlying_token → token_metadata.logo_small`).

---

## Bug 3: Strategy Metadata Never Preloaded Before Mapping

### Location

`backend/src/modules/operators/operators.service.ts` — `findOperatorStrategies()` (line 139-145)

### Before (Broken)

```typescript
const strategiesWithCounts = strategies.map((strategy) => {
  const delegatorCount = delegatorCounts.get(strategy.strategy_id) || 0;
  return this.operatorMapper.mapToStrategyListItem(strategy, delegatorCount);
});
```

`preloadStrategyMetadata()` was never called before the mapping loop. This meant:
- `strategyMetadataCache` was empty when `getStrategySymbol()` and `getStrategyName()` were called
- `getStrategyName()` fell through to `formatAddress()` for strategies not in the (also empty) hardcoded map
- `getStrategySymbol()` always returned "UNKNOWN"

### After (Fixed)

```typescript
// Preload strategy metadata (symbols, logos) before mapping
const strategyAddresses = strategies
  .map((s) => s.strategies?.address)
  .filter(Boolean);
await this.operatorMapper.preloadStrategyMetadata(strategyAddresses);

const strategiesWithCounts = strategies.map((strategy) => {
  const delegatorCount = delegatorCounts.get(strategy.strategy_id) || 0;
  return this.operatorMapper.mapToStrategyListItem(strategy, delegatorCount);
});
```

`preloadStrategyMetadata()` batch-fetches metadata for all strategy addresses via `TokenMetadataService.getStrategyMetadataBatch()`, which queries:

```
strategy_exchange_rates.underlying_token → token_metadata (symbol, name, logo_small)
```

This populates `strategyMetadataCache` before the mapping loop, so `getStrategySymbol()`, `getStrategyName()`, and `strategy_logo` all resolve correctly.

---

## Data Flow (After Fix)

```
1. findOperatorStrategies() fetches strategy states from DB
2. Extracts strategy addresses from results
3. Calls preloadStrategyMetadata(addresses)
   → TokenMetadataService.getStrategyMetadataBatch()
   → Queries: strategy_exchange_rates JOIN token_metadata
   → Populates strategyMetadataCache with { name, symbol, logo_url }
4. Maps each strategy using mapToStrategyListItem()
   → getStrategyName() reads from cache → "stETH", "WETH", etc.
   → getStrategySymbol() reads from cache → "stETH", "WETH", etc.
   → strategy_logo reads from cache → Alchemy logo URL or null
   → tvs_usd reads from strategyState.tvs_usd → "$1,220,298,215", etc.
```

---

## Files Changed

| File | Change |
|------|--------|
| `backend/src/modules/operators/mappers/operator.mapper.ts` | Fixed `getStrategySymbol()`, added `tvs_usd` and `strategy_logo` to `mapToStrategyListItem()` |
| `backend/src/modules/operators/entities/strategy.entities.ts` | Added `tvs_usd: string` and `strategy_logo: string \| null` to `OperatorStrategyListItem` |
| `backend/src/modules/operators/operators.service.ts` | Added `preloadStrategyMetadata()` call before mapping loop |

---

## Verification

Backend TypeScript build passes cleanly (`npx tsc --noEmit` — no errors).

Expected API response after fix:

```json
{
  "strategies": [
    {
      "strategy_id": "0x93c4b944d05dfe6df7645a86cd2206016c51564d",
      "strategy_address": "0x93c4b944d05dfe6df7645a86cd2206016c51564d",
      "strategy_name": "Lido Staked Ether",
      "strategy_symbol": "stETH",
      "strategy_logo": "https://static.alchemyapi.io/images/assets/8085.png",
      "tvs_usd": "1220298215.384804875589920522",
      "max_magnitude": "0",
      "encumbered_magnitude": "0",
      "utilization_rate": "0.0000",
      "delegator_count": 15234
    }
  ]
}
```
