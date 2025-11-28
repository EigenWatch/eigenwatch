// ============================================================================
// SRC/MODULES/NETWORK/ENTITIES/NETWORK.ENTITIES.TS
// ============================================================================

export interface NetworkStatistics {
  operators: {
    total_operators: number;
    active_operators: number;
    inactive_operators: number;
  };
  tvs: {
    total_tvs: string;
    mean_tvs: string;
    median_tvs: string;
  };
  delegation: {
    total_delegators: number;
    mean_delegators_per_operator: string;
    median_delegators_per_operator: string;
  };
  avs: {
    total_avs: number;
    mean_avs_per_operator: string;
  };
  commission: {
    mean_pi_commission: string;
    median_pi_commission: string;
  };
  last_updated: string;
}

export interface NetworkDistribution {
  metric: string;
  date: string;
  distribution: {
    min: string;
    p25: string;
    median: string;
    p75: string;
    p90: string;
    p95: string;
    p99: string;
    max: string;
    mean: string;
    std_dev: string;
  };
  histogram: {
    bucket_start: string;
    bucket_end: string;
    count: number;
    percentage: string;
  }[];
}

export interface NetworkHistoryPoint {
  date: string;
  total_operators: number | null;
  active_operators: number | null;
  total_tvs: string | null;
  mean_tvs: string | null;
  median_tvs: string | null;
  total_delegators: number | null;
  mean_delegators_per_operator: string | null;
  mean_avs_per_operator: string | null;
}

export interface NetworkHistory {
  history: NetworkHistoryPoint[];
}
