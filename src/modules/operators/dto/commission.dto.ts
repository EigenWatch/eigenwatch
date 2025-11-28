// ============================================================================
// SRC/MODULES/OPERATORS/DTO/COMMISSION.DTO.TS
// ============================================================================
import { IsOptional, IsString, IsEnum, IsISO8601 } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export enum CommissionType {
  PI = "pi",
  AVS = "avs",
  OPERATOR_SET = "operator_set",
}

export class GetCommissionHistoryDto {
  @ApiPropertyOptional({
    description: "Filter by commission type",
    enum: CommissionType,
    example: CommissionType.PI,
  })
  @IsOptional()
  @IsEnum(CommissionType)
  commission_type?: CommissionType;

  @ApiPropertyOptional({
    description: "Filter by AVS ID (for AVS commission history)",
    example: "0x123...",
  })
  @IsOptional()
  @IsString()
  avs_id?: string;

  @ApiPropertyOptional({
    description: "Start date (ISO 8601 format)",
    example: "2024-01-01T00:00:00Z",
  })
  @IsOptional()
  @IsISO8601()
  date_from?: string;

  @ApiPropertyOptional({
    description: "End date (ISO 8601 format)",
    example: "2024-12-31T23:59:59Z",
  })
  @IsOptional()
  @IsISO8601()
  date_to?: string;
}
