// ============================================================================
// SRC/MODULES/OPERATORS/ENTITIES/DELEGATOR-EXPOSURE.ENTITIES.TS
// ============================================================================

export interface DelegatorInfo {
  staker_id: string;
  staker_address: string;
  total_delegated_usd: string;
}

export interface OperatorInfo {
  operator_id: string;
  operator_name: string | null;
}

export interface AVSExposure {
  avs_id: string;
  avs_name: string;
  avs_logo: string | null;
  exposed_usd: string;
  exposure_pct: string;
  max_slashing_pct: string;
  max_slashing_usd: string;
}

export interface StrategyExposure {
  strategy_id: string;
  strategy_symbol: string;
  strategy_logo: string | null;
  delegator_shares: string;
  delegator_tvs_usd: string;
  utilization_pct: string;
  at_risk_usd: string;
}

export interface ExposureRiskSummary {
  total_at_risk_usd: string;
  at_risk_pct: string;
  highest_avs_exposure_name: string;
  highest_avs_exposure_usd: string;
  diversification_score: number;
}

export interface DelegatorExposureResponse {
  delegator: DelegatorInfo;
  operator: OperatorInfo;
  exposure_by_avs: AVSExposure[];
  exposure_by_strategy: StrategyExposure[];
  risk_summary: ExposureRiskSummary;
}
