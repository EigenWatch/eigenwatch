// ============================================================================
// SRC/MODULES/OPERATORS/ENTITIES/TIME-SERIES.ENTITIES.TS
// ============================================================================

export interface DailySnapshot {
  date: string;
  block_number: number;
  delegator_count: number | null;
  active_avs_count: number | null;
  active_operator_set_count: number | null;
  pi_split_bips: number | null;
  slash_event_count_to_date: number | null;
  operational_days: number | null;
  is_active: boolean | null;
}

export interface DailySnapshots {
  snapshots: DailySnapshot[];
}

export interface StrategyTVSHistory {
  history: {
    date: string;
    max_magnitude: string;
    encumbered_magnitude: string;
    utilization_rate: string;
  }[];
  strategy: {
    strategy_id: string;
    strategy_name: string;
  };
}

export interface DelegatorSharesHistory {
  history: {
    date: string;
    strategy_id: string;
    strategy_name: string;
    shares: string;
    is_delegated: boolean;
  }[];
}

export interface AVSRelationshipTimeline {
  timeline: {
    date: string;
    current_status: string;
    days_registered_to_date: number | null;
    current_period_days: number | null;
    active_operator_set_count: number | null;
    avs_commission_bips: number | null;
  }[];
}

export interface AllocationHistory {
  history: {
    date: string;
    operator_set_id: string;
    avs_name: string;
    strategy_id: string;
    strategy_name: string;
    magnitude: string;
  }[];
}

export interface SlashingIncident {
  incident_id: number;
  operator_set_id: string;
  avs_name: string;
  slashed_at: string;
  block_number: number;
  description: string;
  transaction_hash: string | null;
  amounts: {
    strategy_id: string;
    strategy_name: string;
    wad_slashed: string;
  }[];
}

export interface SlashingIncidents {
  incidents: SlashingIncident[];
  summary: {
    total_incidents: number;
    total_amount_slashed: string;
    first_slashed_at: string | null;
    last_slashed_at: string | null;
  };
}
