import { ApiProperty } from "@nestjs/swagger";

export class PICommissionDto {
  @ApiProperty({ example: 1000, description: "Current commission in basis points" })
  current_bips: number;

  @ApiProperty({ example: "2024-01-01T00:00:00Z" })
  activated_at: string;

  @ApiProperty({ example: 5, description: "Total number of times commission has changed" })
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
  @ApiProperty({ example: 450, description: "Days since the last commission change. High = Stable." })
  days_since_last_change: number;

  @ApiProperty({ example: 2, description: "Number of rate changes in the last 1 year" })
  changes_last_12m: number;

  @ApiProperty({ example: 1000, description: "The highest commission rate ever observed for this operator" })
  max_historical_bips: number;

  @ApiProperty({ example: false, description: "True if there is a pending commission change" })
  is_change_pending: boolean;
}

export class CommissionOverviewResponseDto {
  @ApiProperty({ description: "Programmatic Incentive commission details" })
  pi_commission: PICommissionDto | null;

  @ApiProperty({ type: [AVSCommissionDto], description: "List of AVS-specific commissions" })
  avs_commissions: AVSCommissionDto[];

  @ApiProperty({ type: [OperatorSetCommissionDto], description: "List of Operator Set commissions" })
  operator_set_commissions: OperatorSetCommissionDto[];

  @ApiProperty({ description: "High-level insights for risk dashboards" })
  behavior_profile: CommissionBehaviorProfileDto;
}

export class CommissionHistoryItemDto {
  @ApiProperty({ enum: ['pi', 'avs', 'operator_set'] })
  commission_type: 'pi' | 'avs' | 'operator_set';

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
