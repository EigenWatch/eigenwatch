import { Injectable } from "@nestjs/common";
import { BaseRepository } from "@/core/common/base.repository";
import { PrismaAnalyticsService } from "@/core/database/prisma-analytics.service";

@Injectable()
export class OperatorStrategyRepository extends BaseRepository<any> {
  constructor(protected readonly prisma: PrismaAnalyticsService) {
    super(prisma);
  }

  async findStrategiesByOperator(operatorId: string): Promise<any[]> {
    return this.execute(async () => {
      return this.prisma.operator_strategy_state.findMany({
        where: { operator_id: operatorId },
        include: {
          strategies: true,
        },
        orderBy: { max_magnitude: "desc" },
      });
    });
  }

  async findStrategyByOperator(
    operatorId: string,
    strategyId: string,
  ): Promise<any> {
    return this.execute(async () => {
      return this.prisma.operator_strategy_state.findFirst({
        where: {
          operator_id: operatorId,
          strategy_id: strategyId,
        },
        include: {
          strategies: true,
        },
      });
    });
  }

  async countDelegatorsByStrategy(
    operatorId: string,
    strategyId: string,
  ): Promise<number> {
    return this.execute(async () => {
      return this.prisma.operator_delegator_shares.count({
        where: {
          operator_id: operatorId,
          strategy_id: strategyId,
          shares: { gt: 0 },
        },
      });
    });
  }

  /**
   * Batch count delegators for multiple strategies in a single query.
   * Returns a Map of strategy_id -> delegator count.
   */
  async countDelegatorsByStrategies(
    operatorId: string,
    strategyIds: string[],
  ): Promise<Map<string, number>> {
    return this.execute(async () => {
      if (strategyIds.length === 0) return new Map();

      const counts = await this.prisma.operator_delegator_shares.groupBy({
        by: ["strategy_id"],
        where: {
          operator_id: operatorId,
          strategy_id: { in: strategyIds },
          shares: { gt: 0 },
        },
        _count: { _all: true },
      });

      const map = new Map<string, number>();
      for (const c of counts) {
        map.set(c.strategy_id, c._count._all);
      }
      return map;
    });
  }

  async findStrategyTVSHistory(
    operatorId: string,
    strategyId: string,
    dateFrom: Date,
    dateTo: Date,
  ): Promise<any[]> {
    return this.execute(async () => {
      return this.prisma.operator_strategy_daily_snapshots.findMany({
        where: {
          operator_id: operatorId,
          strategy_id: strategyId,
          snapshot_date: {
            gte: dateFrom,
            lte: dateTo,
          },
        },
        orderBy: { snapshot_date: "asc" },
        include: {
          strategies: true,
        },
      });
    });
  }
}
