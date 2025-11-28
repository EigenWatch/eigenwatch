/* eslint-disable @typescript-eslint/no-explicit-any */
import { RiskLevel } from "@/shared/types/risk.types";

export interface OperatorMetadata {
  name?: string;
  description?: string;
  logo?: string;
  website?: string;
  twitter?: string;
}

export interface OperatorListItem {
  operator_id: string;
  operator_address: string;
  is_active: boolean;
  total_tvs: string;
  delegator_count: number;
  active_avs_count: number;
  operational_days: number;
  current_pi_commission_bips: number;
  total_slash_events: number;
  risk_level: RiskLevel;
  risk_score: string;
  metadata: OperatorMetadata;
}

export interface OperatorStatus {
  is_active: boolean;
  is_permissioned: boolean;
  registered_at: string;
  first_activity_at: string;
  operational_days: number;
  last_activity_at: string;
}

export interface DelegationConfig {
  current_delegation_approver: string;
  delegation_approver_updated_at: string;
}

export interface PerformanceSummary {
  total_slash_events: number;
  last_slashed_at: string | null;
  force_undelegation_count: number;
}

export interface OperatorOverview {
  operator_id: string;
  operator_address: string;
  metadata: OperatorMetadata;
  status: OperatorStatus;
  delegation_config: DelegationConfig;
  performance_summary: PerformanceSummary;
}

export interface StrategyBreakdown {
  strategy_id: string;
  strategy_address: string;
  strategy_name: string;
  max_magnitude: string;
  encumbered_magnitude: string;
  utilization_rate: string;
}

export interface TVSStats {
  total: string;
  by_strategy: StrategyBreakdown[];
}

export interface DelegationStats {
  total_delegators: number;
  active_delegators: number;
  total_shares: string;
}

export interface AVSParticipationStats {
  active_avs_count: number;
  registered_avs_count: number;
  active_operator_set_count: number;
}

export interface CommissionStats {
  pi_split_bips: number;
  pi_split_activated_at: string;
}

export interface OperatorStatistics {
  tvs: TVSStats;
  delegation: DelegationStats;
  avs_participation: AVSParticipationStats;
  commission: CommissionStats;
}

export interface ActivityDetails {
  [key: string]: any;
}

export interface OperatorActivity {
  activity_type: string;
  timestamp: string;
  block_number: number;
  description: string;
  details: ActivityDetails;
  transaction_hash: string;
}
