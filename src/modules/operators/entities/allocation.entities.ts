// ============================================================================
// SRC/MODULES/OPERATORS/ENTITIES/ALLOCATION.ENTITIES.TS
// ============================================================================

// Utilization status based on percentage thresholds
export type UtilizationStatus = "low" | "moderate" | "high" | "critical";
export type UtilizationRiskLevel = "low" | "moderate" | "high";

// Helper to determine utilization status from percentage
export function getUtilizationStatus(utilizationPct: number): UtilizationStatus {
  if (utilizationPct < 50) return "low";
  if (utilizationPct < 70) return "moderate";
  if (utilizationPct < 90) return "high";
  return "critical";
}

export function getUtilizationRiskLevel(
  avgUtilization: number,
): UtilizationRiskLevel {
  if (avgUtilization < 50) return "low";
  if (avgUtilization < 75) return "moderate";
  return "high";
}

// ============================================================================
// ALLOCATION OVERVIEW (Enhanced)
// ============================================================================

export interface AllocationSummary {
  total_allocated_usd: string;
  total_tvs_usd: string;
  overall_utilization_pct: string;
  total_avs_count: number;
  total_operator_set_count: number;
  total_allocation_count: number;
}

export interface StrategyAllocationBreakdown {
  strategy_id: string;
  strategy_address: string;
  strategy_symbol: string;
  strategy_logo: string | null;
  tvs_usd: string;
  allocated_usd: string;
  available_usd: string;
  utilization_pct: string;
  utilization_status: UtilizationStatus;
  avs_count: number;
}

export interface AVSStrategyUsage {
  strategy_id: string;
  strategy_symbol: string;
  allocated_usd: string;
}

export interface AVSAllocationBreakdown {
  avs_id: string;
  avs_address: string;
  avs_name: string;
  avs_logo: string | null;
  total_allocated_usd: string;
  allocation_share_pct: string;
  operator_set_count: number;
  strategies_used: AVSStrategyUsage[];
}

export interface AllocationRiskMetrics {
  avs_concentration_hhi: number;
  strategy_concentration_hhi: number;
  highest_single_avs_exposure_pct: string;
  utilization_risk_level: UtilizationRiskLevel;
}

export interface OperatorAllocationsOverview {
  summary: AllocationSummary;
  by_strategy: StrategyAllocationBreakdown[];
  by_avs: AVSAllocationBreakdown[];
  risk_metrics: AllocationRiskMetrics;
}

// ============================================================================
// DETAILED ALLOCATIONS (Enhanced)
// ============================================================================

export interface AllocationCommission {
  effective_bips: number;
  source: "pi" | "avs" | "operator_set";
  display_pct: string;
}

export interface DetailedAllocationItem {
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
  // Magnitude (ratio) - kept for reference
  magnitude_raw: string;
  magnitude_pct: string;
  // USD value (the meaningful metric)
  allocated_usd: string;
  // Commission applicable
  commission: AllocationCommission | null;
  // Timing
  allocated_at: string;
  effect_block: number;
}

export interface DetailedAllocationsSummary {
  total_allocated_usd: string;
  average_commission_bips: number;
}

export interface DetailedAllocationsResponse {
  allocations: DetailedAllocationItem[];
  summary: DetailedAllocationsSummary;
}

// ============================================================================
// ALLOCATION HISTORY
// ============================================================================

export interface AllocationHistoryItem {
  snapshot_date: string;
  operator_set_id: string;
  avs_name: string;
  strategy_id: string;
  strategy_symbol: string;
  magnitude: string;
  magnitude_usd: string | null;
  allocation_percent: string | null;
}
