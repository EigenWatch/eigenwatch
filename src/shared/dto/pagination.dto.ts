import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PAGINATION_CONSTANTS } from '../constants/pagination.constants';

export class PaginationDto {
  @ApiPropertyOptional({
    description: 'Number of items per page',
    minimum: PAGINATION_CONSTANTS.MIN_LIMIT,
    maximum: PAGINATION_CONSTANTS.MAX_LIMIT,
    default: PAGINATION_CONSTANTS.DEFAULT_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(PAGINATION_CONSTANTS.MIN_LIMIT)
  @Max(PAGINATION_CONSTANTS.MAX_LIMIT)
  limit?: number = PAGINATION_CONSTANTS.DEFAULT_LIMIT;

  @ApiPropertyOptional({
    description: 'Number of items to skip',
    minimum: 0,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = PAGINATION_CONSTANTS.DEFAULT_OFFSET;
}
