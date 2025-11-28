// ============================================================================
// SRC/MODULES/OPERATORS/DTO/RISK.DTO.TS
// ============================================================================
import { IsOptional, IsISO8601, IsEnum } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class GetRiskAssessmentDto {
  @ApiPropertyOptional({
    description:
      "Date for risk assessment (ISO 8601 format). Defaults to latest.",
    example: "2024-01-01",
  })
  @IsOptional()
  @IsISO8601()
  date?: string;
}

export enum ConcentrationType {
  DELEGATION = "delegation",
  ALLOCATION_BY_AVS = "allocation_by_avs",
  ALLOCATION_BY_STRATEGY = "allocation_by_strategy",
}

export class GetConcentrationMetricsDto {
  @ApiPropertyOptional({
    description: "Type of concentration to analyze",
    enum: ConcentrationType,
    default: ConcentrationType.DELEGATION,
  })
  @IsOptional()
  @IsEnum(ConcentrationType)
  concentration_type?: ConcentrationType = ConcentrationType.DELEGATION;

  @ApiPropertyOptional({
    description:
      "Date for concentration metrics (ISO 8601 format). Defaults to latest.",
    example: "2024-01-01",
  })
  @IsOptional()
  @IsISO8601()
  date?: string;
}

export enum MetricType {
  TVS = "tvs",
  DELEGATORS = "delegators",
  AVS_COUNT = "avs_count",
}

export class GetVolatilityMetricsDto {
  @ApiPropertyOptional({
    description: "Type of metric to analyze volatility for",
    enum: MetricType,
    default: MetricType.TVS,
  })
  @IsOptional()
  @IsEnum(MetricType)
  metric_type?: MetricType = MetricType.TVS;

  @ApiPropertyOptional({
    description:
      "Date for volatility metrics (ISO 8601 format). Defaults to latest.",
    example: "2024-01-01",
  })
  @IsOptional()
  @IsISO8601()
  date?: string;
}
