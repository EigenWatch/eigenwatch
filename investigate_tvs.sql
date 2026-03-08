-- ============================================================
-- TVS Investigation Queries
-- Replace 'YOUR_OPERATOR_ADDRESS' with the specific operator address you are investigating.
-- Example Operator: 0x5accc90436492f24e6af278569691e2c942a676d
-- ============================================================

-- 1. Get Operator ID from Address
-- Run this first to get the ID for subsequent queries if you prefer filtering by ID (which is faster)
SELECT id, address, total_tvs, tvs_updated_at 
FROM operator_state 
JOIN operators ON operator_state.operator_id = operators.id
WHERE operators.address = 'YOUR_OPERATOR_ADDRESS';

-- 2. Single Delegators Shares & TVS
-- View individual delegators, their shares, and calculated TVS (USD) for the operator.
-- Useful for spotting anomalies in specific delegator values.
SELECT 
    ods.staker_id,
    s.address as staker_address,
    str.address as strategy_address,
    ods.shares,
    ods.tvs_usd,
    ods.shares_updated_at
FROM operator_delegator_shares ods
JOIN stakers s ON ods.staker_id = s.id
JOIN strategies str ON ods.strategy_id = str.id
JOIN operators o ON ods.operator_id = o.id
WHERE o.address = 'YOUR_OPERATOR_ADDRESS'
-- AND s.address = 'SPECIFIC_DELEGATOR_ADDRESS' -- Uncomment to filter for a single delegator
ORDER BY ods.tvs_usd DESC NULLS LAST
LIMIT 50;

-- 3. Strategies & Operator Strategy State
-- View the aggregated state for each strategy tailored to this operator.
-- Includes max_magnitude (cap) and current TVS/Shares.
SELECT 
    str.address as strategy_address,
    oss.max_magnitude,
    oss.encumbered_magnitude,
    oss.utilization_rate,
    oss.tvs_usd as strategy_total_tvs_usd,
    oss.tvs_updated_at
FROM operator_strategy_state oss
JOIN strategies str ON oss.strategy_id = str.id
JOIN operators o ON oss.operator_id = o.id
WHERE o.address = 'YOUR_OPERATOR_ADDRESS'
ORDER BY oss.tvs_usd DESC NULLS LAST;

-- 4. Discrepancy Check (Sum of Delegators vs Strategy State)
-- Verify if the sum of individual delegator TVS matches the aggregated strategy TVS.
-- Significant differences indicate synchronization issues or calculation bugs.
SELECT 
    str.address as strategy_address,
    COUNT(ods.staker_id) as delegator_count,
    SUM(ods.tvs_usd) as sum_delegator_tvs_usd,
    oss.tvs_usd as strategy_state_tvs_usd,
    (SUM(COALESCE(ods.tvs_usd, 0)) - COALESCE(oss.tvs_usd, 0)) as difference,
    CASE 
        WHEN ABS(SUM(COALESCE(ods.tvs_usd, 0)) - COALESCE(oss.tvs_usd, 0)) > 1 THEN 'MISMATCH' 
        ELSE 'OK' 
    END as status
FROM operator_delegator_shares ods
JOIN operator_strategy_state oss ON ods.operator_id = oss.operator_id AND ods.strategy_id = oss.strategy_id
JOIN strategies str ON ods.strategy_id = str.id
JOIN operators o ON ods.operator_id = o.id
WHERE o.address = 'YOUR_OPERATOR_ADDRESS'
GROUP BY str.address, oss.tvs_usd
ORDER BY difference DESC;

-- 5. Global Operator State TVS
-- Check the top-level total TVS for the operator.
SELECT 
    o.address,
    os.total_tvs as operator_total_tvs,
    os.tvs_updated_at
FROM operator_state os
JOIN operators o ON os.operator_id = o.id
WHERE o.address = 'YOUR_OPERATOR_ADDRESS';
