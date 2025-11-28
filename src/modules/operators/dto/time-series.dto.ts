// ============================================================================
// SRC/MODULES/OPERATORS/DTO/TIME-SERIES.DTO.TS
// ============================================================================
import { IsOptional, IsString, IsArray, IsISO8601 } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class GetDailySnapshotsDto {
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
    example: ["delegator_count", "avs_count", "pi_commission"],
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  metrics?: string[];
}

export class GetStrategyTVSHistoryDto {
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
}

export class GetDelegatorSharesHistoryDto {
  @ApiPropertyOptional({
    description: "Start date (ISO 8601 format)",
    example: "2024-01-01",
  })
  @IsOptional()
  @IsISO8601()
  date_from?: string;

  @ApiPropertyOptional({
    description: "End date (ISO 8601 format)",
    example: "2024-12-31",
  })
  @IsOptional()
  @IsISO8601()
  date_to?: string;

  @ApiPropertyOptional({
    description: "Filter by strategy ID",
    example: "0x123...",
  })
  @IsOptional()
  @IsString()
  strategy_id?: string;
}

export class GetAVSTimelineDto {
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
}

export class GetAllocationHistoryDto {
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
    description: "Filter by operator set ID",
    example: "0x123...",
  })
  @IsOptional()
  @IsString()
  operator_set_id?: string;

  @ApiPropertyOptional({
    description: "Filter by strategy ID",
    example: "0x456...",
  })
  @IsOptional()
  @IsString()
  strategy_id?: string;
}
