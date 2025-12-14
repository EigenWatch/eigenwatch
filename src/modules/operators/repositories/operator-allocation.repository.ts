import { Injectable } from "@nestjs/common";
import { BaseRepository } from "@/core/common/base.repository";
import { PrismaService } from "@/core/database/prisma.service";

@Injectable()
export class OperatorAllocationRepository extends BaseRepository<any> {
  constructor(protected readonly prisma: PrismaService) {
    super(prisma);
  }

  async findAllocationsByOperatorStrategy(
    operatorId: string,
    strategyId: string
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

  async findAllocationsOverview(operatorId: string): Promise<any> {
    return this.execute(async () => {
      const allocations = await this.prisma.operator_allocations.findMany({
        where: { operator_id: operatorId },
        include: {
          strategies: true,
          operator_sets: {
            include: {
              avs: true,
            },
          },
        },
      });

      // Group by AVS
      const avsMap = new Map<string, any>();
      allocations.forEach((alloc) => {
        const avsId = alloc.operator_sets.avs_id;
        if (!avsMap.has(avsId)) {
          avsMap.set(avsId, {
            avs: alloc.operator_sets.avs,
            total_magnitude: 0,
            strategies: [],
          });
        }
        const entry = avsMap.get(avsId);
        entry.total_magnitude += Number(alloc.magnitude);
        entry.strategies.push({
          strategy: alloc.strategies,
          magnitude: alloc.magnitude,
        });
      });

      return Array.from(avsMap.values());
    });
  }

  async findDetailedAllocations(
    operatorId: string,
    filters: {
      avs_id?: string;
      strategy_id?: string;
    },
    pagination: { limit: number; offset: number },
    sortBy: string = "magnitude",
    sortOrder: "asc" | "desc" = "desc"
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
      if (sortBy === "magnitude") {
        orderBy.magnitude = sortOrder;
      } else if (sortBy === "allocated_at") {
        orderBy.allocated_at = sortOrder;
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

  async countDetailedAllocations(
    operatorId: string,
    filters: {
      avs_id?: string;
      strategy_id?: string;
    }
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

  async findAllocationHistory(
    operatorId: string,
    filters: {
      operator_set_id?: string;
      strategy_id?: string;
      date_from: Date;
      date_to: Date;
    }
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
}
