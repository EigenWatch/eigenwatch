// ============================================================================
// SRC/MODULES/OPERATORS/ENTITIES/DELEGATOR.ENTITIES.TS
// ============================================================================

export interface DelegatorStrategyShares {
  strategy_id: string;
  strategy_name: string;
  shares: string;
}

export interface DelegatorListItem {
  staker_id: string;
  staker_address: string;
  is_delegated: boolean;
  delegated_at: string | null;
  undelegated_at: string | null;
  total_shares: string;
  shares_percentage: string;
  strategies: DelegatorStrategyShares[];
}

export interface DelegatorListResponse {
  delegators: DelegatorListItem[];
  summary: {
    total_delegators: number;
    active_delegators: number;
    total_shares: string;
  };
}

export interface DelegatorDetail {
  staker: {
    staker_id: string;
    staker_address: string;
  };
  delegation: {
    is_delegated: boolean;
    delegated_at: string | null;
    undelegated_at: string | null;
    delegation_duration_days: number | null;
  };
  shares_by_strategy: {
    strategy_id: string;
    strategy_address: string;
    strategy_name: string;
    shares: string;
    shares_percentage: string;
    last_updated_at: string;
  }[];
  total_shares: string;
}

export interface DelegationHistoryEvent {
  staker_address: string;
  event_type: string;
  timestamp: string;
  block_number: number;
  transaction_hash: string | null;
}

export interface DelegationHistory {
  events: DelegationHistoryEvent[];
}
