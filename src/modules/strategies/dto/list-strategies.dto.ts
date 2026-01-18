import {
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  IsBoolean,
  IsString,
} from "class-validator";
import { Type, Transform } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";

export enum StrategySortField {
  TVS = "tvs",
  OPERATOR_COUNT = "operator_count",
  DELEGATOR_COUNT = "delegator_count",
}

export class ListStrategiesDto {
  @ApiPropertyOptional({ description: "Minimum total TVS in USD" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  min_tvs?: number;

  @ApiPropertyOptional({ description: "Maximum total TVS in USD" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  max_tvs?: number;

  @ApiPropertyOptional({ description: "Minimum number of operators" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  min_operators?: number;

  @ApiPropertyOptional({ description: "Filter by token category" })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: "Search by address, symbol, or name" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: "Filter by price feed availability" })
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  has_price_feed?: boolean;

  @ApiPropertyOptional({
    enum: StrategySortField,
    default: StrategySortField.TVS,
  })
  @IsOptional()
  @IsEnum(StrategySortField)
  sort_by?: StrategySortField = StrategySortField.TVS;

  @ApiPropertyOptional({
    description: "Sort order",
    enum: ["asc", "desc"],
    default: "desc",
  })
  @IsOptional()
  @IsString()
  sort_order?: "asc" | "desc" = "desc";
}

export class FindStrategiesQueryDto extends ListStrategiesDto {
  @ApiPropertyOptional({
    description: "Number of items per page",
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: "Number of items to skip",
    minimum: 0,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number = 0;
}
