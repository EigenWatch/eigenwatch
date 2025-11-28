export interface OperatorStrategyListItem {
  strategy_id: string;
  strategy_address: string;
  strategy_name: string;
  strategy_symbol: string;
  max_magnitude: string;
  encumbered_magnitude: string;
  available_magnitude: string;
  utilization_rate: string;
  last_updated_at: string;
  delegator_count: number;
}

export interface StrategyAllocation {
  operator_set_id: string;
  avs_name: string;
  allocated_magnitude: string;
  allocation_percentage: string;
}

export interface TopDelegator {
  staker_address: string;
  shares: string;
  percentage: string;
}

export interface StrategyDelegators {
  total_count: number;
  total_shares: string;
  top_delegators: TopDelegator[];
}

export interface StrategyCurrentState {
  max_magnitude: string;
  encumbered_magnitude: string;
  available_magnitude: string;
  utilization_rate: string;
  last_updated_at: string;
}

export interface OperatorStrategyDetail {
  strategy_id: string;
  strategy_address: string;
  strategy_name: string;
  current_state: StrategyCurrentState;
  allocations: StrategyAllocation[];
  delegators: StrategyDelegators;
}

export interface OperatorMetadata {
  name: string;
  website: string;
  description: string;
  logo: string;
  twitter: string;
}
