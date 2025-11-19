export const CACHE_TTL = {
  // Real-time data (30 seconds)
  OPERATOR_STATS: 30,
  NETWORK_STATS_LIVE: 30,

  // Frequently updated (5 minutes)
  OPERATOR_DETAIL: 5 * 60,
  OPERATOR_LIST: 5 * 60,
  LEADERBOARD: 5 * 60,
  TRENDING: 5 * 60,

  // Moderate frequency (15 minutes)
  NETWORK_STATS: 15 * 60,
  STRATEGY_STATS: 15 * 60,
  AVS_STATS: 15 * 60,

  // Low frequency (1 hour)
  HISTORICAL_DATA: 60 * 60,
  TIME_SERIES: 60 * 60,
  ANALYTICS: 60 * 60,

  // Static data (24 hours)
  METADATA: 24 * 60 * 60,
  DOCUMENTATION: 24 * 60 * 60,
} as const;
