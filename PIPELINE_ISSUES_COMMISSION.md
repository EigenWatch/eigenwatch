# Pipeline Issues - Commission Data

## Issue 1: Duplicate History Records (Critical)

**Table**: `operator_commission_history`

**Problem**: The same commission change event is being stored multiple times. For operator `0x5accc90436492f24e6af278569691e2c942a676d`, the event `0xeb98bc8d0ea8819798a3910d31b60503c2e6e352268720e9592cf43f0d0548d3-261` appears **18+ times**.

**Evidence**:

```sql
SELECT event_id, COUNT(*) FROM operator_commission_history GROUP BY event_id HAVING COUNT(*) > 1;
```

**Impact**: Inflates `changes_last_12m` metric (shows 108 when actual unique changes are far fewer).

**Expected**: Each unique event should only be stored once. Add deduplication logic using `event_id` as a unique constraint or upsert key.

---

## Issue 2: Network PI Commission Benchmarks are 0

**Table**: `network_daily_aggregates`

**Problem**: All PI commission benchmark columns (`mean_pi_commission_bips`, `median_pi_commission_bips`, `p25/p75/p90`) are `0` for all snapshots.

**Evidence**:

```sql
SELECT snapshot_date, mean_pi_commission_bips, median_pi_commission_bips
FROM network_daily_aggregates ORDER BY snapshot_date DESC LIMIT 5;
-- All return 0
```

**Root Cause Hypothesis**:

- Only 9 PI records exist vs 61 AVS records (Query #5).
- Either PI commissions are rare in the network, OR the aggregation query isn't correctly calculating/populating these fields.

**Expected**: If operators have PI commissions, the aggregation should calculate and populate the percentile values.

---

## Issue 3: `total_changes` Column Not Populated

**Table**: `operator_commission_rates`

**Problem**: The `total_changes` column is `NULL` for all records.

**Evidence**:

```sql
SELECT id, total_changes FROM operator_commission_rates LIMIT 10;
-- All return NULL
```

**Expected**: This field should contain the count of historical changes for each commission rate, updated when new history is recorded.

---

## Summary

| Issue                     | Severity | Table                         | Action                               |
| ------------------------- | -------- | ----------------------------- | ------------------------------------ |
| Duplicate history records | Critical | `operator_commission_history` | Add deduplication on `event_id`      |
| PI benchmarks are 0       | Medium   | `network_daily_aggregates`    | Review aggregation query             |
| `total_changes` is NULL   | Low      | `operator_commission_rates`   | Populate during state reconstruction |
