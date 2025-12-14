// ============================================================================
// SRC/MODULES/OPERATORS/ENTITIES/RISK.ENTITIES.TS
// ============================================================================

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

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

export interface OperatorRiskProfile {
  operator_id: string;
  assessment_date: string;
  scores: {
    risk: number;
    confidence: number;
    performance: number;
    economic: number;
    network_position: number;
  };
  risk_level: string;
  flags: {
    is_active: boolean;
    has_been_slashed: boolean;
    has_sufficient_data: boolean;
  };
  metrics: {
    delegation: {
      hhi: number;
      volatility_30d: number;
      growth_rate_30d: number;
      distribution_cv: number;
      size_percentile: number;
    };
    slashing: {
      count: number;
      lifetime_amount: string;
    };
    activity: {
      operational_days: number;
    };
  };
  concentration: {
    delegation: ConcentrationMetric | null;
    allocation_by_avs: ConcentrationMetric | null;
    allocation_by_strategy: ConcentrationMetric | null;
  };
  volatility: {
    tvs: VolatilityMetric | null;
    delegators: VolatilityMetric | null;
  };
}
