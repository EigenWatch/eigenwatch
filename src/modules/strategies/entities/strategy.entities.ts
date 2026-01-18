export interface UnderlyingToken {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logo_url: string | null;
}

export interface StrategyListItem {
  strategy_id: string;
  strategy_address: string;
  name: string;
  symbol: string;
  logo_url: string | null;
  underlying_token: UnderlyingToken | null;
  total_tvs_usd: string;
  total_operators: number;
  total_delegators: number;
  total_shares: string;
  exchange_rate: string | null;
  categories: string[];
}

export interface StrategyLinks {
  homepage?: string;
  twitter?: string;
  discord?: string;
  github?: string[];
}

export interface PriceAvailability {
  available_from: string | null;
  available_to: string | null;
}

export interface StrategyDetail extends StrategyListItem {
  description: string | null;
  links: StrategyLinks;
  price_availability: PriceAvailability;
  is_rebasing: boolean;
  coingecko_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface StrategyOperatorItem {
  operator_id: string;
  operator_address: string;
  operator_name: string | null;
  tvs_usd: string;
  shares: string;
  utilization_rate: string;
  is_active: boolean;
}

export interface StrategyDelegatorItem {
  staker_id: string;
  staker_address: string;
  operator_id: string;
  operator_name: string | null;
  shares: string;
  share_percentage: string;
  last_updated_at: string;
}

export interface PriceHistoryPoint {
  timestamp: string;
  price_usd: string;
  market_cap_usd: string | null;
  total_volume_usd: string | null;
}

export interface TVSHistoryPoint {
  date: string;
  total_tvs_usd: string;
  total_shares: string;
  operator_count: number;
}

export interface StrategyNetworkStats {
  total_strategies: number;
  total_tvs_usd: string;
  top_strategies: Array<{
    strategy_id: string;
    strategy_address: string;
    name: string;
    symbol: string;
    total_tvs_usd: string;
    operator_count: number;
    share_percentage: string;
  }>;
}
