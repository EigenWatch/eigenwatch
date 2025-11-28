// ============================================================================
// SRC/MODULES/OPERATORS/ENTITIES/COMMISSION.ENTITIES.TS
// ============================================================================

export interface PICommission {
  current_bips: number;
  activated_at: string;
  total_changes: number;
}

export interface AVSCommission {
  avs_id: string;
  avs_name: string;
  current_bips: number;
  activated_at: string;
  upcoming_bips: number | null;
  upcoming_activated_at: string | null;
}

export interface OperatorSetCommission {
  operator_set_id: string;
  avs_name: string;
  operator_set_number: number;
  current_bips: number;
  activated_at: string;
}

export interface OperatorCommissionOverview {
  pi_commission: PICommission;
  avs_commissions: AVSCommission[];
  operator_set_commissions: OperatorSetCommission[];
}

export interface CommissionHistoryItem {
  commission_type: string;
  avs_id: string | null;
  avs_name: string | null;
  operator_set_id: string | null;
  old_bips: number;
  new_bips: number;
  change_delta: number;
  changed_at: string;
  activated_at: string;
  activation_delay_seconds: number | null;
  block_number: number | null;
}

export interface CommissionHistory {
  changes: CommissionHistoryItem[];
}
