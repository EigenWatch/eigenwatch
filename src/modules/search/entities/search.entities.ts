// ============================================================================
// NEW FILE: SRC/MODULES/SEARCH/ENTITIES/SEARCH.ENTITIES.TS
// ============================================================================

export interface OperatorSearchResult {
  operator_id: string;
  operator_address: string;
  operator_name: string | null;
  match_type: "address" | "name" | "metadata";
}

export interface AVSSearchResult {
  avs_id: string;
  avs_address: string;
  avs_name: string | null;
}

export interface StakerSearchResult {
  staker_id: string;
  staker_address: string;
}

export interface GlobalSearchResults {
  results: {
    operators: OperatorSearchResult[];
    avs: AVSSearchResult[];
    stakers: StakerSearchResult[];
  };
  total_results: number;
}

export interface LeaderboardEntry {
  rank: number;
  operator_id: string;
  operator_address: string;
  operator_name: string | null;
  metric_value: string;
  percentile: string;
}

export interface Leaderboard {
  leaderboard: LeaderboardEntry[];
  metric: string;
  date: string;
  total_operators: number;
}

export interface TrendingOperator {
  operator_id: string;
  operator_address: string;
  operator_name: string | null;
  current_value: string;
  previous_value: string;
  growth_rate: string;
  growth_percentage: string;
  trend_score: string;
}

export interface TrendingOperators {
  trending: TrendingOperator[];
  timeframe: string;
  metric: string;
}

export interface RecentActivityOperator {
  operator_id: string;
  operator_address: string;
  operator_name: string | null;
  last_activity: {
    activity_type: string;
    timestamp: string;
    description: string;
  };
}

export interface RecentActivityOperators {
  operators: RecentActivityOperator[];
  timeframe_hours: number;
}
