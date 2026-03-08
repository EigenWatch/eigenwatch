import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsOptional, IsBoolean } from "class-validator";

export class UpdateProfileDto {
  @ApiPropertyOptional({ description: "Display name" })
  @IsString()
  @IsOptional()
  display_name?: string;
}

export class UpdatePreferencesDto {
  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  risk_alerts_operator_changes?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  risk_alerts_slashing?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  risk_alerts_tvs_changes?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  watchlist_daily_summary?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  watchlist_status_changes?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  product_updates?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  newsletter?: boolean;
}
