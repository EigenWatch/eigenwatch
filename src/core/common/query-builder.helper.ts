/* eslint-disable @typescript-eslint/no-explicit-any */
import { DateRangeDto } from "src/shared/dto/date-range.dto";

export class QueryBuilderHelper {
  static buildOperatorFilters(filters: any): any {
    const where: any = {};

    if (filters.search) {
      where.OR = [
        { operatorId: { contains: filters.search, mode: "insensitive" } },
        {
          metadata: { name: { contains: filters.search, mode: "insensitive" } },
        },
      ];
    }

    if (filters.minTVS !== undefined) {
      where.totalTVS = { gte: filters.minTVS };
    }

    if (filters.maxTVS !== undefined) {
      where.totalTVS = { ...where.totalTVS, lte: filters.maxTVS };
    }

    return where;
  }

  static buildTimeSeriesQuery(dateRange: DateRangeDto): any {
    const where: any = {};

    if (dateRange.date_from || dateRange.date_to) {
      where.date = {};

      if (dateRange.date_from) {
        where.date.gte = new Date(dateRange.date_from);
      }

      if (dateRange.date_to) {
        where.date.lte = new Date(dateRange.date_to);
      }
    }

    return where;
  }

  static buildNetworkAggregationQuery(): any {
    return {
      _sum: {
        totalTVS: true,
      },
      _count: {
        operatorId: true,
      },
    };
  }

  static buildComparisonQuery(operatorIds: string[]): any {
    return {
      where: {
        operatorId: {
          in: operatorIds,
        },
      },
    };
  }
}
