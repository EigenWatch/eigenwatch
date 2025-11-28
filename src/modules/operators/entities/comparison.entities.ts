// ============================================================================
// SRC/MODULES/OPERATORS/ENTITIES/COMPARISON.ENTITIES.TS
// ============================================================================

export interface OperatorComparison {
  operator_id: string;
  operator_address: string;
  operator_name: string | null;
  metrics: {
    tvs?: string;
    delegator_count?: number;
    active_avs_count?: number;
    pi_commission_bips?: number;
    risk_score?: string;
    operational_days?: number;
  };
}

export interface OperatorsComparison {
  operators: OperatorComparison[];
  comparison_date: string;
}

export interface OperatorRankings {
  rankings: {
    tvs_percentile: string | null;
    delegator_count_percentile: string | null;
    avs_count_percentile: string | null;
    operational_days_percentile: string | null;
    risk_score_percentile: string | null;
  };
  absolute_values: {
    tvs: string;
    delegator_count: number;
    avs_count: number;
    operational_days: number;
    risk_score: string;
  };
  network_stats: {
    total_operators: number;
    active_operators: number;
  };
  date: string;
}

export interface NetworkComparison {
  operator_metrics: {
    tvs: string;
    delegator_count: number;
    avs_count: number;
    pi_commission_bips: number;
  };
  network_averages: {
    mean_tvs: string;
    median_tvs: string;
    mean_delegators: string;
    median_delegators: string;
    mean_avs: string;
    mean_pi_commission: string;
  };
  differences: {
    tvs_vs_mean: string;
    tvs_vs_median: string;
    delegators_vs_mean: string;
    avs_vs_mean: string;
  };
  date: string;
}
