import { IsOptional, IsEnum, IsArray } from "class-validator";
import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";

export enum ActivityType {
  REGISTRATION = "registration",
  DELEGATION = "delegation",
  ALLOCATION = "allocation",
  COMMISSION = "commission",
  METADATA = "metadata",
  SLASHING = "slashing",
}

export class GetActivityDto {
  @ApiPropertyOptional({
    enum: ActivityType,
    isArray: true,
    description: "Filter by activity types",
  })
  @IsOptional()
  @IsArray()
  @IsEnum(ActivityType, { each: true })
  activity_types?: ActivityType[];

  @ApiPropertyOptional({ description: "Limit results", default: 50 })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 50;

  @ApiPropertyOptional({ description: "Offset for pagination", default: 0 })
  @IsOptional()
  @Type(() => Number)
  offset?: number = 0;
}
