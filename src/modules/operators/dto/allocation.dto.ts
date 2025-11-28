// ============================================================================
// SRC/MODULES/OPERATORS/DTO/ALLOCATION.DTO.TS
// ============================================================================
import { IsOptional, IsString, IsNumber, Min } from "class-validator";
import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { PaginationDto } from "@/shared/dto/pagination.dto";

export enum AllocationSortField {
  MAGNITUDE = "magnitude",
  EFFECT_BLOCK = "effect_block",
  ALLOCATED_AT = "allocated_at",
}

export class ListDetailedAllocationsDto extends PaginationDto {
  @ApiPropertyOptional({
    description: "Filter by AVS ID",
    example: "0x123...",
  })
  @IsOptional()
  @IsString()
  avs_id?: string;

  @ApiPropertyOptional({
    description: "Filter by strategy ID",
    example: "0x456...",
  })
  @IsOptional()
  @IsString()
  strategy_id?: string;

  @ApiPropertyOptional({
    description: "Minimum magnitude",
    example: 1000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  min_magnitude?: number;

  @ApiPropertyOptional({
    description: "Maximum magnitude",
    example: 1000000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  max_magnitude?: number;

  @ApiPropertyOptional({
    description: "Sort by field",
    enum: AllocationSortField,
    default: AllocationSortField.MAGNITUDE,
  })
  @IsOptional()
  @IsString()
  sort_by?: AllocationSortField = AllocationSortField.MAGNITUDE;

  @ApiPropertyOptional({
    description: "Sort order",
    enum: ["asc", "desc"],
    default: "desc",
  })
  @IsOptional()
  @IsString()
  sort_order?: "asc" | "desc" = "desc";
}
