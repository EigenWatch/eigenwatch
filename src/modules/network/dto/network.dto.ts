// ============================================================================
// SRC/MODULES/NETWORK/DTO/NETWORK.DTO.TS
// ============================================================================
import {
  IsOptional,
  IsEnum,
  IsISO8601,
  IsArray,
  IsString,
} from "class-validator";
import { ApiPropertyOptional, ApiProperty } from "@nestjs/swagger";

export enum NetworkMetric {
  TVS = "tvs",
  DELEGATORS = "delegators",
  AVS_COUNT = "avs_count",
}

export class GetNetworkDistributionDto {
  @ApiProperty({
    description: "Metric to analyze distribution for",
    enum: NetworkMetric,
    example: NetworkMetric.TVS,
  })
  @IsEnum(NetworkMetric)
  metric: NetworkMetric;

  @ApiPropertyOptional({
    description: "Date for distribution (ISO 8601 format). Defaults to latest.",
    example: "2024-01-01",
  })
  @IsOptional()
  @IsISO8601()
  date?: string;
}

export class GetNetworkHistoryDto {
  @ApiProperty({
    description: "Start date (ISO 8601 format)",
    example: "2024-01-01",
    required: true,
  })
  @IsISO8601()
  date_from: string;

  @ApiProperty({
    description: "End date (ISO 8601 format)",
    example: "2024-12-31",
    required: true,
  })
  @IsISO8601()
  date_to: string;

  @ApiPropertyOptional({
    description: "Specific metrics to include",
    example: ["operators", "tvs", "delegators", "avs"],
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  metrics?: string[];
}
