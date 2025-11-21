/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaService } from "../database/prisma.service";

export abstract class BaseRepository<T> {
  constructor(protected prisma: PrismaService) {}

  protected buildPagination(
    limit: number,
    offset: number
  ): {
    take: number;
    skip: number;
  } {
    return {
      take: limit,
      skip: offset,
    };
  }

  protected buildFilters(filters: Record<string, any>): any {
    const where: any = {};

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        where[key] = value;
      }
    }

    return where;
  }

  protected buildOrderBy(
    sortBy: string,
    sortOrder: "asc" | "desc"
  ): Record<string, string> {
    return {
      [sortBy]: sortOrder,
    };
  }

  protected async findOneOrFail(query: any): Promise<T> {
    const result = await query;
    if (!result) {
      throw new Error("Record not found");
    }
    return result;
  }

  protected async execute<R>(operation: () => Promise<R>): Promise<R> {
    return this.prisma.executeSafe(operation);
  }

  protected buildDateRangeFilter(
    dateFrom?: Date,
    dateTo?: Date
  ): Record<string, any> {
    const filter: Record<string, any> = {};

    if (dateFrom || dateTo) {
      filter.date = {};
      if (dateFrom) {
        filter.date.gte = dateFrom;
      }
      if (dateTo) {
        filter.date.lte = dateTo;
      }
    }

    return filter;
  }

  protected buildAggregation(metrics: string[]): any {
    const aggregation: any = {};

    for (const metric of metrics) {
      aggregation[metric] = true;
    }

    return aggregation;
  }
}
