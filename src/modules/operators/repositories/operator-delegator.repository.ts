import { Injectable } from "@nestjs/common";
import { BaseRepository } from "@/core/common/base.repository";
import { PrismaService } from "@/core/database/prisma.service";

@Injectable()
export class OperatorDelegatorRepository extends BaseRepository<any> {
  constructor(protected readonly prisma: PrismaService) {
    super(prisma);
  }

  async findDelegators(
    operatorId: string,
    filters: {
      status?: string;
      min_shares?: number;
      max_shares?: number;
    },
    pagination: { limit: number; offset: number },
    sortBy: string,
    sortOrder: "asc" | "desc",
  ): Promise<any[]> {
    return this.execute(async () => {
      const where: any = {
        operator_id: operatorId,
      };

      // Status filter
      if (filters.status && filters.status !== "all") {
        if (filters.status === "active") {
          where.is_delegated = true;
        } else if (filters.status === "inactive") {
          where.is_delegated = false;
        }
      }

      const delegators = await this.prisma.operator_delegators.findMany({
        where,
        include: {
          stakers: {
            include: {
              operator_delegator_shares: {
                where: {
                  operator_id: operatorId,
                  shares: { gt: 0 },
                },
                include: {
                  strategies: true,
                },
              },
            },
          },
        },
      });

      // Map and Filter
      let filtered = delegators
        .map((d: any) => {
          const shares = d.stakers.operator_delegator_shares || [];
          const totalShares = shares.reduce(
            (sum: number, s: any) => sum + Number(s.shares),
            0,
          );
          const totalTVS = shares.reduce(
            (sum: number, s: any) => sum + Number(s.tvs_usd || 0),
            0,
          );

          return {
            ...d,
            shares: totalShares,
            tvs: totalTVS,
            strategies: shares.map((s: any) => ({
              strategy: s.strategies,
              shares: s.shares,
              tvs: s.tvs_usd || 0,
            })),
          };
        })
        .filter((d: any) => {
          if (filters.min_shares !== undefined && d.shares < filters.min_shares)
            return false;
          if (filters.max_shares !== undefined && d.shares > filters.max_shares)
            return false;
          return true;
        });

      // Sort
      if (sortBy === "shares") {
        filtered.sort((a: any, b: any) => {
          return sortOrder === "asc"
            ? a.shares - b.shares
            : b.shares - a.shares;
        });
      } else if (sortBy === "tvs") {
        filtered.sort((a: any, b: any) => {
          return sortOrder === "asc" ? a.tvs - b.tvs : b.tvs - a.tvs;
        });
      } else if (sortBy === "delegated_at") {
        filtered.sort((a: any, b: any) => {
          const dateA = a.delegated_at ? new Date(a.delegated_at).getTime() : 0;
          const dateB = b.delegated_at ? new Date(b.delegated_at).getTime() : 0;
          return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
        });
      }

      // Pagination
      return filtered.slice(
        pagination.offset,
        pagination.offset + pagination.limit,
      );
    });
  }

  async getDelegatorsSummary(operatorId: string): Promise<any> {
    return this.execute(async () => {
      const total = await this.prisma.operator_delegators.count({
        where: { operator_id: operatorId },
      });

      const active = await this.prisma.operator_delegators.count({
        where: { operator_id: operatorId, is_delegated: true },
      });

      return {
        total_delegators: total,
        active_delegators: active,
        inactive_delegators: total - active,
      };
    });
  }

  async findDelegatorDetail(
    operatorId: string,
    stakerId: string,
  ): Promise<any> {
    return this.execute(async () => {
      const delegator = await this.prisma.operator_delegators.findFirst({
        where: {
          operator_id: operatorId,
          staker_id: stakerId,
        },
        include: {
          stakers: {
            include: {
              operator_delegator_shares: {
                where: {
                  operator_id: operatorId,
                },
                include: {
                  strategies: true,
                },
              },
            },
          },
        },
      });

      if (!delegator) return null;

      const shares = delegator.stakers.operator_delegator_shares || [];
      const totalShares = shares.reduce(
        (sum: number, s: any) => sum + Number(s.shares),
        0,
      );

      return {
        ...delegator,
        shares: totalShares,
        strategies: shares.map((s: any) => ({
          strategy: s.strategies,
          shares: s.shares,
        })),
      };
    });
  }

  async findDelegationHistory(
    operatorId: string,
    filters: {
      event_type?: string;
      date_from?: Date;
      date_to?: Date;
    },
    pagination: { limit: number; offset: number },
  ): Promise<any[]> {
    return this.execute(async () => {
      const where: any = {
        operator_id: operatorId,
      };

      if (filters.event_type) {
        where.delegation_type = filters.event_type;
      }

      if (filters.date_from || filters.date_to) {
        where.event_timestamp = {};
        if (filters.date_from) where.event_timestamp.gte = filters.date_from;
        if (filters.date_to) where.event_timestamp.lte = filters.date_to;
      }

      return this.prisma.operator_delegator_history.findMany({
        where,
        include: {
          stakers: true,
        },
        orderBy: { event_timestamp: "desc" },
        skip: pagination.offset,
        take: pagination.limit,
      });
    });
  }

  async countDelegationHistory(
    operatorId: string,
    filters: {
      event_type?: string;
      date_from?: Date;
      date_to?: Date;
    },
  ): Promise<number> {
    return this.execute(async () => {
      const where: any = {
        operator_id: operatorId,
      };

      if (filters.event_type) {
        where.delegation_type = filters.event_type;
      }

      if (filters.date_from || filters.date_to) {
        where.event_timestamp = {};
        if (filters.date_from) where.event_timestamp.gte = filters.date_from;
        if (filters.date_to) where.event_timestamp.lte = filters.date_to;
      }

      return this.prisma.operator_delegator_history.count({ where });
    });
  }

  async findDelegatorSharesHistory(
    operatorId: string,
    stakerId: string,
    filters: {
      strategy_id?: string;
      date_from?: Date;
      date_to?: Date;
    },
  ): Promise<any[]> {
    return this.execute(async () => {
      const where: any = {
        operator_id: operatorId,
        staker_id: stakerId,
      };

      if (filters.strategy_id) {
        where.strategy_id = filters.strategy_id;
      }

      if (filters.date_from || filters.date_to) {
        where.snapshot_date = {};
        if (filters.date_from) where.snapshot_date.gte = filters.date_from;
        if (filters.date_to) where.snapshot_date.lte = filters.date_to;
      }

      return this.prisma.operator_delegator_shares_snapshots.findMany({
        where,
        include: {
          strategies: true,
        },
        orderBy: { snapshot_date: "asc" },
      });
    });
  }

  async findDelegatorsByOperatorStrategy(
    operatorId: string,
    strategyId: string,
  ): Promise<any[]> {
    return this.execute(async () => {
      return this.prisma.operator_delegator_shares.findMany({
        where: {
          operator_id: operatorId,
          strategy_id: strategyId,
          shares: { gt: 0 },
        },
        include: {
          stakers: true,
        },
        orderBy: { shares: "desc" },
        take: 10,
      });
    });
  }
}
