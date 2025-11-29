// ============================================================================
// NEW FILE: SRC/MODULES/SEARCH/DTO/SEARCH.DTO.TS
// ============================================================================
import {
  IsOptional,
  IsString,
  IsArray,
  IsEnum,
  IsInt,
  Min,
  Max,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export enum EntityType {
  OPERATORS = "operators",
  AVS = "avs",
  STAKERS = "stakers",
}

export class GlobalSearchDto {
  @ApiProperty({
    description: "Search query term",
    example: "operator",
    required: true,
  })
  @IsString()
  query: string;

  @ApiPropertyOptional({
    description: "Filter by entity types",
    enum: EntityType,
    isArray: true,
    example: ["operators", "avs"],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(EntityType, { each: true })
  entity_types?: EntityType[];

  @ApiPropertyOptional({
    description: "Maximum number of results",
    example: 20,
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export enum LeaderboardMetric {
  TVS = "tvs",
  DELEGATORS = "delegators",
  AVS_COUNT = "avs_count",
  OPERATIONAL_DAYS = "operational_days",
  RISK_SCORE = "risk_score",
}

export class GetLeaderboardDto {
  @ApiProperty({
    description: "Metric to rank by",
    enum: LeaderboardMetric,
    example: LeaderboardMetric.TVS,
  })
  @IsEnum(LeaderboardMetric)
  metric: LeaderboardMetric;

  @ApiPropertyOptional({
    description: "Maximum number of operators",
    example: 50,
    minimum: 1,
    maximum: 100,
    default: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @ApiPropertyOptional({
    description: "Date for leaderboard (ISO 8601 format). Defaults to latest.",
    example: "2024-01-01",
  })
  @IsOptional()
  @IsString()
  date?: string;
}

export enum TrendingTimeframe {
  SEVEN_DAYS = "7d",
  THIRTY_DAYS = "30d",
  NINETY_DAYS = "90d",
}

export enum TrendingMetric {
  TVS_GROWTH = "tvs_growth",
  DELEGATOR_GROWTH = "delegator_growth",
  AVS_GROWTH = "avs_growth",
}

export class GetTrendingDto {
  @ApiPropertyOptional({
    description: "Timeframe for trend analysis",
    enum: TrendingTimeframe,
    default: TrendingTimeframe.THIRTY_DAYS,
  })
  @IsOptional()
  @IsEnum(TrendingTimeframe)
  timeframe?: TrendingTimeframe = TrendingTimeframe.THIRTY_DAYS;

  @ApiPropertyOptional({
    description: "Metric to analyze for trending",
    enum: TrendingMetric,
    default: TrendingMetric.TVS_GROWTH,
  })
  @IsOptional()
  @IsEnum(TrendingMetric)
  metric?: TrendingMetric = TrendingMetric.TVS_GROWTH;

  @ApiPropertyOptional({
    description: "Maximum number of operators",
    example: 20,
    minimum: 1,
    maximum: 50,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

export enum ActivityType {
  REGISTRATION = "registration",
  ALLOCATION = "allocation",
  COMMISSION = "commission",
  METADATA = "metadata",
}

export class GetRecentActivityDto {
  @ApiPropertyOptional({
    description: "Filter by activity types",
    enum: ActivityType,
    isArray: true,
    example: ["registration", "allocation"],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(ActivityType, { each: true })
  activity_types?: ActivityType[];

  @ApiPropertyOptional({
    description: "Number of hours to look back",
    example: 24,
    minimum: 1,
    maximum: 168,
    default: 24,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(168)
  hours?: number = 24;

  @ApiPropertyOptional({
    description: "Maximum number of operators",
    example: 50,
    minimum: 1,
    maximum: 100,
    default: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}
