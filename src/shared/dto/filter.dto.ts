import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FilterDto {
  @ApiPropertyOptional({
    description: 'Search term',
    example: 'operator name',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
