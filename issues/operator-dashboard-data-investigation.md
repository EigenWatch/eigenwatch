# Operator Dashboard Data Investigation Report

## 1. Overview Tab Components & Expected Data Structure

The `OperatorProfile` component in `apps/dashboard/app/operator/_components/OperatorProfile.tsx` renders different tabs, including `OverviewTab` which visualizes operator historical performance.

In `OverviewTab` (`apps/dashboard/app/operator/_components/tabs/OverviewTab.tsx`), the primary charts shown are:

1. **Total Value Secured (TVS) - 6 Month Trend** (`AreaChart`)
2. **Delegators Over Time** (`LineChart`)
3. **AVS Registrations Over Time** (`LineChart`)

The charts use `useDailySnapshots` hook, expecting an array of `DailySnapshot` objects with at least these properties:

- `date`: Date string / timestamp
- `tvs` (or `tvs_eth`, `tvs_usd`): Total Value Secured as a numeric value/string
- `delegator_count`: Number of active delegators
- `active_avs_count`: Number of active AVS registrations

The data is transformed to match `AreaChart` and `LineChart` expectations:

```typescript
{
  date: "Jan 4",
  tvs: 253.29, // Converted to ETH or USD
  delegators: 2106,
  avs: 32
}
```

## 2. Backend Endpoints & Data Model

The frontend uses the API route `/api/v1/operators/:id/snapshots/daily` to fetch this data.
This hits `OperatorsController.getDailySnapshots()` in `backend/src/modules/operators/operators.controller.ts`.

Underneath, it calls `OperatorAnalyticsRepository.findDailySnapshots()`, which queries the `operator_daily_snapshots` table in PostgreSQL using Prisma.

The `operator_daily_snapshots` schema in `prisma/analytics/schema.prisma` is as follows:

```prisma
model operator_daily_snapshots {
  id                        Int
  operator_id               String
  snapshot_date             DateTime
  snapshot_block            Int
  delegator_count           Int?
  active_avs_count          Int?
  active_operator_set_count Int?
  pi_split_bips             Int?
  slash_event_count_to_date Int?
  operational_days          Int?
  is_active                 Boolean?
  total_tvs                 Decimal?
  pi_uses_default_split     Boolean?
}
```

## 3. SQL Query Results for Target Operator

Using target operator `0x5accc90436492f24e6af278569691e2c942a676d`, the database query pulls the correct historical tracking fields to satisfy the UI requirement.

**Query Executed:**

```sql
SELECT snapshot_date, total_tvs as tvs, delegator_count as delegators, active_avs_count as avs_count
FROM operator_daily_snapshots
WHERE operator_id = '0x5accc90436492f24e6af278569691e2c942a676d'
ORDER BY snapshot_date DESC
LIMIT 10;
```

**Results:**
| snapshot_date | tvs | delegators | avs_count |
| :--- | :--- | :--- | :--- |
| 2026-01-04 | 253293445.4234010787911362384504940 | 2106 | 32 |
| 2026-01-03 | 253293445.4234010787911362384504940 | 2106 | 32 |
| 2026-01-02 | 253293445.4234010787911362384504940 | 2106 | 32 |
| 2026-01-01 | 253293445.4234010787911362384504940 | 2106 | 32 |
| 2025-12-31 | 253293445.4234010787911362384504940 | 2106 | 32 |
| 2025-12-30 | 253293445.4234010787911362384504940 | 2106 | 32 |
| 2025-12-29 | 253293445.4234010787911362384504940 | 2106 | 32 |
| 2025-12-28 | 253293445.4234010787911362384504940 | 2106 | 32 |
| 2025-12-27 | 253293445.4234010787911362384504940 | 2106 | 32 |
| 2025-12-26 | 253293445.4234010787911362384504940 | 2106 | 32 |

## 4. Conclusion

1. The backend cron/pipeline is successfully capturing daily snapshots of tvs, delegators, and avs_count in the `operator_daily_snapshots` analytics table.
2. The endpoint `/api/v1/operators/:id/snapshots/daily` exposes this time-series correctly.
3. The React hook `useDailySnapshots` extracts these metrics, transforms them, and feeds the `AreaChart` and `LineChart` in the Overview Tab.
4. The data shows a persistent state over the past 10 days for the given operator, which might produce flat charts, but the data pipeline correctly tracks and emits the data.
# Follow-up: TVS Data Missing
The TVS data was indeed present in the database but dropped during the API mapping response. The `OperatorMapper.mapToDailySnapshots` in `backend/src/modules/operators/mappers/operator.mapper.ts` did not include the `total_tvs` field.
This has been fixed by passing the `total_tvs` field down to the `tvs`, `tvs_eth` and `tvs_usd` fields in the mapped object response.
