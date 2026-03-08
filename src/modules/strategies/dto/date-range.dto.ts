import { IsOptional, IsISO8601 } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class DateRangeDto {
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

export class OptionalDateRangeDto {
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
}
