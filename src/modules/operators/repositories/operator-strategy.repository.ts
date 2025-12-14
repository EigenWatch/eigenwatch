import { Injectable } from "@nestjs/common";
import { BaseRepository } from "@/core/common/base.repository";
import { PrismaService } from "@/core/database/prisma.service";

@Injectable()
export class OperatorStrategyRepository extends BaseRepository<any> {
  constructor(protected readonly prisma: PrismaService) {
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
    strategyId: string
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
    strategyId: string
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

  async findStrategyTVSHistory(
    operatorId: string,
    strategyId: string,
    dateFrom: Date,
    dateTo: Date
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
