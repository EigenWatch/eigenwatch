export interface AVSMetadata {
  name?: string;
  logo?: string;
  website?: string;
}

export interface AVSRelationshipListItem {
  avs_id: string;
  avs_address: string;
  avs_name: string;
  avs_logo: string;
  current_status: "registered" | "unregistered";
  current_status_since: string;
  first_registered_at: string;
  total_days_registered: number;
  current_period_days: number;
  total_registration_cycles: number;
  active_operator_set_count: number;
  avs_commission_bips: number;
}

export interface OperatorSetInfo {
  operator_set_id: string;
  operator_set_number: number;
  is_active: boolean;
  allocations: OperatorSetAllocation[];
}

export interface OperatorSetAllocation {
  strategy_id: string;
  strategy_name: string;
  allocated_magnitude: string;
}

export interface AVSCommissionInfo {
  avs_commission_bips: number;
  operator_set_commissions: OperatorSetCommission[];
}

export interface OperatorSetCommission {
  operator_set_id: string;
  commission_bips: number;
}

export interface AVSRelationshipDetail {
  avs: {
    avs_id: string;
    avs_address: string;
    avs_name: string;
    metadata: AVSMetadata;
  };
  relationship: {
    current_status: "registered" | "unregistered";
    current_status_since: string;
    first_registered_at: string;
    last_registered_at: string;
    last_unregistered_at: string;
    total_days_registered: number;
    total_registration_cycles: number;
  };
  operator_sets: OperatorSetInfo[];
  commission: AVSCommissionInfo;
}

export interface AVSRegistrationHistoryItem {
  status: "registered" | "unregistered";
  timestamp: string;
  block_number: number;
  transaction_hash: string;
  duration_since_previous: number;
}
