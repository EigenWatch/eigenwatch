// ============================================================================
// SRC/MODULES/OPERATORS/DTO/DELEGATOR.DTO.TS
// ============================================================================
import { IsOptional, IsString, IsEnum, IsNumber, Min } from "class-validator";
import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { PaginationDto } from "@/shared/dto/pagination.dto";

export enum DelegatorStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  ALL = "all",
}

export enum DelegatorSortField {
  SHARES = "shares",
  DELEGATION_DATE = "delegation_date",
}

export class ListDelegatorsDto extends PaginationDto {
  @ApiPropertyOptional({
    description: "Filter by delegator status",
    enum: DelegatorStatus,
  })
  @IsOptional()
  @IsEnum(DelegatorStatus)
  status?: DelegatorStatus;

  @ApiPropertyOptional({
    description: "Minimum shares",
    example: 1000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  min_shares?: number;

  @ApiPropertyOptional({
    description: "Maximum shares",
    example: 100000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  max_shares?: number;

  @ApiPropertyOptional({
    description: "Sort by field",
    enum: DelegatorSortField,
  })
  @IsOptional()
  @IsEnum(DelegatorSortField)
  sort_by?: DelegatorSortField;

  @ApiPropertyOptional({
    description: "Sort order",
    enum: ["asc", "desc"],
  })
  @IsOptional()
  @IsEnum(["asc", "desc"])
  sort_order?: "asc" | "desc";
}

export enum DelegationEventType {
  DELEGATED = "delegated",
  UNDELEGATED = "undelegated",
  FORCE_UNDELEGATED = "force_undelegated",
  ALL = "all",
}

export class GetDelegationHistoryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: "Filter by event type",
    enum: DelegationEventType,
    default: DelegationEventType.ALL,
  })
  @IsOptional()
  @IsEnum(DelegationEventType)
  event_type?: DelegationEventType = DelegationEventType.ALL;

  @ApiPropertyOptional({
    description: "Start date (ISO 8601 format)",
    example: "2024-01-01T00:00:00Z",
  })
  @IsOptional()
  @IsString()
  date_from?: string;

  @ApiPropertyOptional({
    description: "End date (ISO 8601 format)",
    example: "2024-12-31T23:59:59Z",
  })
  @IsOptional()
  @IsString()
  date_to?: string;
}
