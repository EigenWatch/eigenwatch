-- ============================================================
-- Commission Data Investigation for Operator
-- Operator Address: 0x5accc90436492f24e6af278569691e2c942a676d
-- Run each query separately in Beekeeper
-- ============================================================

-- 1. Find the operator's internal ID from the address
SELECT id, address FROM operators WHERE address = '0x5accc90436492f24e6af278569691e2c942a676d';

-- 2. Check operator_commission_rates for this operator (current rates)
SELECT * FROM operator_commission_rates WHERE operator_id IN (
    SELECT id FROM operators WHERE address = '0x5accc90436492f24e6af278569691e2c942a676d'
);

-- 3. Check operator_commission_history for this operator (historical changes)
SELECT * FROM operator_commission_history WHERE operator_id IN (
    SELECT id FROM operators WHERE address = '0x5accc90436492f24e6af278569691e2c942a676d'
) ORDER BY changed_at DESC LIMIT 20;

-- 4. Check network_daily_aggregates for PI commission benchmarks
SELECT 
    snapshot_date,
    mean_pi_commission_bips,
    median_pi_commission_bips,
    p25_pi_commission_bips,
    p75_pi_commission_bips,
    p90_pi_commission_bips
FROM network_daily_aggregates
ORDER BY snapshot_date DESC
LIMIT 5;

-- 5. Summary: Count of all commission rates by type across the entire network
SELECT commission_type, COUNT(*) as count FROM operator_commission_rates GROUP BY commission_type;

-- 6. Summary: Count of all commission history records
SELECT COUNT(*) as total_history_records FROM operator_commission_history;
