export const RISK_CONSTANTS = {
  LEVELS: {
    LOW: { min: 0, max: 33, label: 'low' as const },
    MEDIUM: { min: 34, max: 66, label: 'medium' as const },
    HIGH: { min: 67, max: 100, label: 'high' as const },
  },
  WEIGHTS: {
    PERFORMANCE: 0.4,
    ECONOMIC: 0.3,
    NETWORK_POSITION: 0.3,
  },
  VOLATILITY_THRESHOLDS: {
    LOW: 0.1,
    MEDIUM: 0.25,
    HIGH: 0.5,
  },
  HHI_THRESHOLDS: {
    COMPETITIVE: 1500,
    MODERATELY_CONCENTRATED: 2500,
    HIGHLY_CONCENTRATED: 10000,
  },
} as const;
