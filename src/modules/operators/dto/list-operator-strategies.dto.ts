import { IsOptional, IsEnum, IsNumber, Min } from "class-validator";
import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";

export enum StrategySortField {
  TVS = "tvs",
  UTILIZATION = "utilization",
  ENCUMBERED = "encumbered",
}

export class ListOperatorStrategiesDto {
  @ApiPropertyOptional({ description: "Minimum TVS" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  min_tvs?: number;

  @ApiPropertyOptional({ description: "Maximum TVS" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  max_tvs?: number;

  @ApiPropertyOptional({ description: "Minimum utilization rate (0-1)" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  min_utilization?: number;

  @ApiPropertyOptional({ description: "Maximum utilization rate (0-1)" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  max_utilization?: number;

  @ApiPropertyOptional({
    enum: StrategySortField,
    default: StrategySortField.TVS,
  })
  @IsOptional()
  @IsEnum(StrategySortField)
  sort_by?: StrategySortField = StrategySortField.TVS;
}
