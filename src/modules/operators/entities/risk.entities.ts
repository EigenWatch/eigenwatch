// ============================================================================
// SRC/MODULES/OPERATORS/ENTITIES/RISK.ENTITIES.TS
// ============================================================================

export type RiskLevel = "low" | "medium" | "high";

export interface RiskAssessment {
  assessment_date: string;
  risk_score: string;
  risk_level: RiskLevel;
  confidence_score: string;
  component_scores: {
    performance_score: string | null;
    economic_score: string | null;
    network_position_score: string | null;
  };
  key_metrics: {
    delegation_hhi: string | null;
    delegation_volatility_30d: string | null;
    growth_rate_30d: string | null;
    size_percentile: string | null;
    slashing_event_count: number;
    operational_days: number;
  };
  flags: {
    is_active: boolean;
    has_been_slashed: boolean;
    has_sufficient_data: boolean;
  };
}

export interface ConcentrationMetric {
  concentration_type: string;
  date: string;
  hhi_value: string;
  gini_coefficient: string | null;
  top_1_percentage: string | null;
  top_5_percentage: string | null;
  top_10_percentage: string | null;
  total_entities: number;
  effective_entities: string | null;
}

export interface ConcentrationMetrics {
  metrics: ConcentrationMetric[];
}

export interface VolatilityMetric {
  metric_type: string;
  date: string;
  volatility_7d: string | null;
  volatility_30d: string | null;
  volatility_90d: string | null;
  mean_value: string | null;
  coefficient_of_variation: string | null;
  trend_direction: string | null;
  trend_strength: string | null;
  confidence_score: string | null;
}

export interface VolatilityMetrics {
  metrics: VolatilityMetric[];
}
