import { Injectable } from "@nestjs/common";
import { BaseRepository } from "@/core/common/base.repository";
import { PrismaAnalyticsService } from "@/core/database/prisma-analytics.service";

@Injectable()
export class OperatorAllocationRepository extends BaseRepository<any> {
  constructor(protected readonly prisma: PrismaAnalyticsService) {
    super(prisma);
  }

  /**
   * Get comprehensive allocation data for overview
   * Includes allocations, strategy state, and AVS summary
   */
  async findAllocationsOverviewData(operatorId: string): Promise<{
    allocations: any[];
    strategyState: any[];
    avsSummary: any[];
    commissionRates: any[];
  }> {
    return this.execute(async () => {
      const [allocations, strategyState, avsSummary, commissionRates] =
        await Promise.all([
          // Get all allocations with AVS and strategy info
          this.prisma.operator_allocations.findMany({
            where: { operator_id: operatorId },
            include: {
              strategies: true,
              operator_sets: {
                include: {
                  avs: true,
                },
              },
            },
          }),

          // Get strategy state for TVS and utilization
          this.prisma.operator_strategy_state.findMany({
            where: { operator_id: operatorId },
            include: {
              strategies: true,
            },
          }),

          // Get AVS allocation summaries
          this.prisma.operator_avs_allocation_summary.findMany({
            where: { operator_id: operatorId },
            include: {
              avs: true,
              strategies: true,
            },
          }),

          // Get commission rates for context
          this.prisma.operator_commission_rates.findMany({
            where: { operator_id: operatorId },
            include: {
              avs: true,
              operator_sets: true,
            },
          }),
        ]);

      return { allocations, strategyState, avsSummary, commissionRates };
    });
  }

  /**
   * Find allocations by operator and strategy
   */
  async findAllocationsByOperatorStrategy(
    operatorId: string,
    strategyId: string,
  ): Promise<any[]> {
    return this.execute(async () => {
      return this.prisma.operator_allocations.findMany({
        where: {
          operator_id: operatorId,
          strategy_id: strategyId,
        },
        include: {
          operator_sets: {
            include: {
              avs: true,
            },
          },
        },
        orderBy: { magnitude: "desc" },
      });
    });
  }

  /**
   * Find detailed allocations with filtering and pagination
   */
  async findDetailedAllocations(
    operatorId: string,
    filters: {
      avs_id?: string;
      strategy_id?: string;
    },
    pagination: { limit: number; offset: number },
    sortBy: string = "magnitude",
    sortOrder: "asc" | "desc" = "desc",
  ): Promise<any[]> {
    return this.execute(async () => {
      const where: any = { operator_id: operatorId };

      if (filters.avs_id) {
        where.operator_sets = { avs_id: filters.avs_id };
      }

      if (filters.strategy_id) {
        where.strategy_id = filters.strategy_id;
      }

      const orderBy: any = {};
      if (sortBy === "magnitude" || sortBy === "magnitude_usd") {
        orderBy.magnitude = sortOrder;
      } else if (sortBy === "allocated_at") {
        orderBy.allocated_at = sortOrder;
      } else if (sortBy === "effect_block") {
        orderBy.effect_block = sortOrder;
      } else {
        orderBy.magnitude = "desc";
      }

      return this.prisma.operator_allocations.findMany({
        where,
        include: {
          operator_sets: {
            include: { avs: true },
          },
          strategies: true,
        },
        orderBy,
        skip: pagination.offset,
        take: pagination.limit,
      });
    });
  }

  /**
   * Count detailed allocations
   */
  async countDetailedAllocations(
    operatorId: string,
    filters: {
      avs_id?: string;
      strategy_id?: string;
    },
  ): Promise<number> {
    return this.execute(async () => {
      const where: any = { operator_id: operatorId };

      if (filters.avs_id) {
        where.operator_sets = { avs_id: filters.avs_id };
      }

      if (filters.strategy_id) {
        where.strategy_id = filters.strategy_id;
      }

      return this.prisma.operator_allocations.count({ where });
    });
  }

  /**
   * Find allocation history snapshots
   */
  async findAllocationHistory(
    operatorId: string,
    filters: {
      operator_set_id?: string;
      strategy_id?: string;
      date_from: Date;
      date_to: Date;
    },
  ): Promise<any[]> {
    return this.execute(async () => {
      const where: any = {
        operator_id: operatorId,
        snapshot_date: {
          gte: filters.date_from,
          lte: filters.date_to,
        },
      };

      if (filters.operator_set_id) {
        where.operator_set_id = filters.operator_set_id;
      }

      if (filters.strategy_id) {
        where.strategy_id = filters.strategy_id;
      }

      return this.prisma.operator_allocation_snapshots.findMany({
        where,
        include: {
          operator_sets: {
            include: { avs: true },
          },
          strategies: true,
        },
        orderBy: { snapshot_date: "asc" },
      });
    });
  }

  /**
   * Get strategy state for an operator (TVS, utilization)
   */
  async findStrategyState(operatorId: string): Promise<any[]> {
    return this.execute(async () => {
      return this.prisma.operator_strategy_state.findMany({
        where: { operator_id: operatorId },
        include: {
          strategies: true,
        },
      });
    });
  }

  /**
   * Get exchange rates for strategies
   */
  async findExchangeRates(strategyAddresses: string[]): Promise<any[]> {
    return this.execute(async () => {
      const normalizedAddresses = strategyAddresses.map((a) => a.toLowerCase());
      return this.prisma.strategy_exchange_rates.findMany({
        where: {
          strategy_address: { in: normalizedAddresses },
        },
      });
    });
  }
}
