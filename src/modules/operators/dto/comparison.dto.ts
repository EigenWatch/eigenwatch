// ============================================================================
// SRC/MODULES/OPERATORS/DTO/COMPARISON.DTO.TS
// ============================================================================
import {
  IsArray,
  IsString,
  ArrayMinSize,
  ArrayMaxSize,
  IsOptional,
  IsISO8601,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CompareOperatorsDto {
  @ApiProperty({
    description: "Array of operator IDs to compare (2-5 operators)",
    example: ["operator_1", "operator_2", "operator_3"],
    minItems: 2,
    maxItems: 5,
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(2)
  @ArrayMaxSize(5)
  operator_ids: string[];

  @ApiPropertyOptional({
    description: "Specific metrics to compare",
    example: ["tvs", "delegators", "avs_count", "commission", "risk_score"],
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  metrics?: string[];
}

export class GetRankingsDto {
  @ApiPropertyOptional({
    description: "Date for rankings (ISO 8601 format). Defaults to latest.",
    example: "2024-01-01",
  })
  @IsOptional()
  @IsISO8601()
  date?: string;
}

export class CompareToNetworkDto {
  @ApiPropertyOptional({
    description: "Date for comparison (ISO 8601 format). Defaults to latest.",
    example: "2024-01-01",
  })
  @IsOptional()
  @IsISO8601()
  date?: string;
}
