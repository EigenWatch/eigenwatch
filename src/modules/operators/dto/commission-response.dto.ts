import { ApiProperty } from "@nestjs/swagger";

export class PICommissionDto {
  @ApiProperty({
    example: 1000,
    description: "Current commission in basis points",
  })
  current_bips: number;

  @ApiProperty({ example: "2024-01-01T00:00:00Z" })
  activated_at: string;

  @ApiProperty({
    example: 5,
    description: "Total number of times commission has changed",
  })
  total_changes: number;
}

export class AVSCommissionDto {
  @ApiProperty({ example: "0x123..." })
  avs_id: string;

  @ApiProperty({ example: "EigenDA" })
  avs_name: string;

  @ApiProperty({ example: 500 })
  current_bips: number;

  @ApiProperty({ example: "2024-01-01T00:00:00Z" })
  activated_at: string;

  @ApiProperty({ example: 600, nullable: true })
  upcoming_bips: number | null;

  @ApiProperty({ example: "2024-02-01T00:00:00Z", nullable: true })
  upcoming_activated_at: string | null;

  @ApiProperty({
    example: 3,
    description: "Total number of times this AVS commission has changed",
  })
  total_changes: number;

  @ApiProperty({
    example: "2024-01-01T00:00:00Z",
    nullable: true,
    description: "When this commission was first set",
  })
  first_set_at: string | null;
}

export class OperatorSetCommissionDto {
  @ApiProperty({ example: "0xabc..." })
  operator_set_id: string;

  @ApiProperty({ example: "EigenDA" })
  avs_name: string;

  @ApiProperty({ example: 1 })
  operator_set_number: number;

  @ApiProperty({ example: 200 })
  current_bips: number;

  @ApiProperty({ example: "2024-01-01T00:00:00Z" })
  activated_at: string;
}

export class CommissionBehaviorProfileDto {
  @ApiProperty({
    example: 450,
    description: "Days since the last commission change. High = Stable.",
  })
  days_since_last_change: number;

  @ApiProperty({
    example: 2,
    description: "Number of rate changes in the last 1 year",
  })
  changes_last_12m: number;

  @ApiProperty({
    example: 1000,
    description: "The highest commission rate ever observed for this operator",
  })
  max_historical_bips: number;

  @ApiProperty({
    example: false,
    description: "True if there is a pending commission change",
  })
  is_change_pending: boolean;
}

export class NetworkBenchmarksDto {
  @ApiProperty({
    example: 1200,
    description: "Mean PI commission across all operators (bips)",
  })
  mean_pi_commission_bips: number;

  @ApiProperty({
    example: 1000,
    description: "Median PI commission across all operators (bips)",
  })
  median_pi_commission_bips: number;

  @ApiProperty({
    example: 500,
    description: "25th percentile PI commission (bips)",
  })
  p25_pi_commission_bips: number;

  @ApiProperty({
    example: 1500,
    description: "75th percentile PI commission (bips)",
  })
  p75_pi_commission_bips: number;

  @ApiProperty({
    example: 2000,
    description: "90th percentile PI commission (bips)",
  })
  p90_pi_commission_bips: number;
}

export class CommissionSourceBreakdownDto {
  @ApiProperty({ example: "1250000.00", description: "USD amount under this commission source" })
  usd_amount: string;

  @ApiProperty({ example: "45.5", description: "Percentage of total allocations" })
  pct_of_total: string;
}

export class AllocationByCommissionSourceDto {
  @ApiProperty({ description: "Allocations using PI commission" })
  pi: CommissionSourceBreakdownDto;

  @ApiProperty({ description: "Allocations using AVS-specific commission" })
  avs: CommissionSourceBreakdownDto;

  @ApiProperty({ description: "Allocations using Operator Set commission" })
  operator_set: CommissionSourceBreakdownDto;
}

export class CommissionImpactAnalysisDto {
  @ApiProperty({
    example: 850,
    description: "Weighted average commission across all allocations (bips)",
  })
  weighted_average_commission_bips: number;

  @ApiProperty({
    example: "8.50",
    description: "Weighted average commission as percentage",
  })
  weighted_average_commission_pct: string;

  @ApiProperty({ description: "Breakdown of allocations by commission source" })
  allocation_by_commission_source: AllocationByCommissionSourceDto;

  @ApiProperty({
    enum: ["lower", "similar", "higher"],
    description: "How this operator's commission compares to network average",
  })
  vs_network_average: "lower" | "similar" | "higher";

  @ApiProperty({
    example: 65,
    description: "Percentile rank (e.g., 65 means lower commission than 65% of operators)",
  })
  percentile_rank: number;
}

export class CommissionOverviewResponseDto {
  @ApiProperty({ description: "Programmatic Incentive commission details" })
  pi_commission: PICommissionDto | null;

  @ApiProperty({
    type: [AVSCommissionDto],
    description: "List of AVS-specific commissions",
  })
  avs_commissions: AVSCommissionDto[];

  @ApiProperty({
    type: [OperatorSetCommissionDto],
    description: "List of Operator Set commissions",
  })
  operator_set_commissions: OperatorSetCommissionDto[];

  @ApiProperty({ description: "High-level insights for risk dashboards" })
  behavior_profile: CommissionBehaviorProfileDto;

  @ApiProperty({
    description: "Network-wide benchmark statistics for PI commissions",
  })
  network_benchmarks: NetworkBenchmarksDto;

  @ApiProperty({
    description: "Analysis of commission impact on delegators (weighted by allocation value)",
  })
  impact_analysis: CommissionImpactAnalysisDto;
}

export class CommissionHistoryItemDto {
  @ApiProperty({ enum: ["pi", "avs", "operator_set"] })
  commission_type: "pi" | "avs" | "operator_set";

  @ApiProperty({ nullable: true })
  avs_id: string | null;

  @ApiProperty({ nullable: true })
  avs_name: string | null;

  @ApiProperty({ nullable: true })
  operator_set_id: string | null;

  @ApiProperty()
  old_bips: number;

  @ApiProperty()
  new_bips: number;

  @ApiProperty()
  change_delta: number;

  @ApiProperty()
  changed_at: string;

  @ApiProperty()
  activated_at: string;

  @ApiProperty({ nullable: true })
  activation_delay_seconds: number | null;

  @ApiProperty({ nullable: true })
  block_number: number | null;
}

export class CommissionHistoryResponseDto {
  @ApiProperty({ type: [CommissionHistoryItemDto] })
  changes: CommissionHistoryItemDto[];
}
