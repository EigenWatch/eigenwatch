import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsOptional,
  IsEnum,
  IsObject,
  MaxLength,
} from "class-validator";

export enum FeedbackTypeDto {
  GENERAL = "GENERAL",
  INLINE = "INLINE",
  PAYWALL = "PAYWALL",
  FEATURE_REQUEST = "FEATURE_REQUEST",
}

export enum FeedbackSentimentDto {
  POSITIVE = "POSITIVE",
  NEGATIVE = "NEGATIVE",
}

export class CreateFeedbackDto {
  @ApiProperty({ enum: FeedbackTypeDto })
  @IsEnum(FeedbackTypeDto)
  type: FeedbackTypeDto;

  @ApiPropertyOptional({ enum: FeedbackSentimentDto })
  @IsEnum(FeedbackSentimentDto)
  @IsOptional()
  sentiment?: FeedbackSentimentDto;

  @ApiPropertyOptional({ description: "Feedback category (e.g. data_quality, missing_feature)" })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional({ description: "Free-text feedback message" })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  message?: string;

  @ApiPropertyOptional({ description: "Page URL where feedback was given" })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  page_url?: string;

  @ApiPropertyOptional({ description: "Section identifier for inline feedback" })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  section_id?: string;

  @ApiPropertyOptional({ description: "Additional metadata (e.g. paywall selections)" })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
