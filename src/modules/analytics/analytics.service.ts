/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { ComparisonDto } from "@/shared/dto/comparison.dto";
import { Injectable } from "@nestjs/common";

@Injectable()
export class AnalyticsService {
  async compareOperators(comparison: ComparisonDto): Promise<any> {
    return null;
  }

  async performCohortAnalysis(params: any): Promise<any> {
    return null;
  }
}
