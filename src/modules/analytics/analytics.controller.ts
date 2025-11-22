/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { ComparisonDto } from "@/shared/dto/comparison.dto";
import { Controller, Post, Body } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";

@ApiTags("Analytics")
@Controller("analytics")
export class AnalyticsController {
  @Post("compare")
  @ApiOperation({ summary: "Compare multiple operators" })
  async compare(@Body() comparison: ComparisonDto) {
    return null;
  }

  @Post("cohort-analysis")
  @ApiOperation({ summary: "Perform cohort analysis" })
  async cohortAnalysis(@Body() params: any) {
    return null;
  }
}
