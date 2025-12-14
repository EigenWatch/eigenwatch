import {
  IsOptional,
  IsEnum,
  IsBoolean,
  IsString,
  IsNumber,
  Min,
} from "class-validator";
import { Type, Transform } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";

export enum OperatorStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  ALL = "all",
}

export enum OperatorSortField {
  TVS = "tvs",
  DELEGATOR_COUNT = "delegator_count",
  AVS_COUNT = "avs_count",
  OPERATIONAL_DAYS = "operational_days",
  RISK_SCORE = "risk_score",
}

export class ListOperatorsDto {
  @ApiPropertyOptional({ enum: OperatorStatus, default: OperatorStatus.ACTIVE })
  @IsOptional()
  @IsEnum(OperatorStatus)
  status?: OperatorStatus = OperatorStatus.ACTIVE;

  @ApiPropertyOptional({ description: "Minimum total value secured" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  min_tvs?: number;

  @ApiPropertyOptional({ description: "Maximum total value secured" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  max_tvs?: number;

  @ApiPropertyOptional({ description: "Minimum delegator count" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  min_delegators?: number;

  @ApiPropertyOptional({ description: "Maximum delegator count" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  max_delegators?: number;

  @ApiPropertyOptional({ description: "Minimum AVS count" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  min_avs_count?: number;

  @ApiPropertyOptional({ description: "Maximum AVS count" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  max_avs_count?: number;

  @ApiPropertyOptional({ description: "Filter by slash status" })
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  has_been_slashed?: boolean;

  @ApiPropertyOptional({ description: "Filter by permissioned status" })
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  is_permissioned?: boolean;

  @ApiPropertyOptional({ description: "Search by operator address or name" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: OperatorSortField,
    default: OperatorSortField.TVS,
  })
  @IsOptional()
  @IsEnum(OperatorSortField)
  sort_by?: OperatorSortField = OperatorSortField.TVS;

  @ApiPropertyOptional({
    description: "Exclude operators with zero or no risk score",
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === "true" || value === true) return true;
    if (value === "false" || value === false) return false;
    return true;
  })
  @IsBoolean()
  exclude_zero_risk?: boolean = true;
}
