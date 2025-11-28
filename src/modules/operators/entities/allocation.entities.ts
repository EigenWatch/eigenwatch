// ============================================================================
// SRC/MODULES/OPERATORS/ENTITIES/ALLOCATION.ENTITIES.TS
// ============================================================================

export interface AllocationByAVS {
  avs_id: string;
  avs_name: string;
  total_allocated: string;
  operator_set_count: number;
  strategies: {
    strategy_id: string;
    strategy_name: string;
    allocated_magnitude: string;
  }[];
}

export interface AllocationByStrategy {
  strategy_id: string;
  strategy_name: string;
  total_allocated: string;
  available_magnitude: string;
  utilization_rate: string;
}

export interface OperatorAllocationsOverview {
  total_allocations: number;
  total_encumbered_magnitude: string;
  by_avs: AllocationByAVS[];
  by_strategy: AllocationByStrategy[];
}

export interface DetailedAllocationItem {
  allocation_id: string;
  operator_set_id: string;
  avs_name: string;
  operator_set_number: number;
  strategy_id: string;
  strategy_name: string;
  magnitude: string;
  allocated_at: string;
  effect_block: number;
}

export interface DetailedAllocations {
  allocations: DetailedAllocationItem[];
}
