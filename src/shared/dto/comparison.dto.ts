import {
  IsArray,
  IsString,
  ArrayMinSize,
  ArrayMaxSize,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ComparisonDto {
  @ApiProperty({
    description: 'Array of operator IDs to compare (2-5 operators)',
    example: ['0x123...', '0x456...'],
    minItems: 2,
    maxItems: 5,
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(2)
  @ArrayMaxSize(5)
  operator_ids: string[];

  @ApiPropertyOptional({
    description: 'Specific metrics to compare',
    example: ['totalTVS', 'delegatorCount', 'riskScore'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  metrics?: string[];
}
