import { Injectable } from "@nestjs/common";
import { PrismaAnalyticsService } from "@/core/database/prisma-analytics.service";
import {
  ListOperatorsDto,
  OperatorSortField,
  OperatorStatus,
} from "../dto/list-operators.dto";
import { BaseRepository } from "@/core/common/base.repository";

@Injectable()
export class PrismaOperatorRepository extends BaseRepository<any> {
  constructor(protected readonly prisma: PrismaAnalyticsService) {
    super(prisma);
  }

  async findMany(
    filters: ListOperatorsDto,
    pagination: { limit: number; offset: number },
    sortBy?: OperatorSortField,
    sortOrder: "asc" | "desc" = "desc",
  ): Promise<any[]> {
    return this.execute(async () => {
      const where = this.buildOperatorFilters(filters);
      const orderBy = this.buildOperatorOrderBy(sortBy);

      // If we need to filter by TVS, use precomputed total_tvs from operator_state
      if (filters.min_tvs === undefined && filters.max_tvs === undefined) {
        // Standard query without TVS filtering
        return this.prisma.operators.findMany({
          where,
          include: {
            operator_state: true,
            operator_metadata: true,
            operator_analytics: {
              orderBy: { date: "desc" },
              take: 1,
            },
            operator_strategy_state: {
              include: {
                strategies: true,
              },
            },
          },
          orderBy,
          skip: pagination.offset,
          take: pagination.limit,
        });
      } else {
        // TVS filtering now uses precomputed total_tvs from operator_state
        // Build TVS filter conditions
        const tvsFilter: any = {};
        if (filters.min_tvs !== undefined) {
          tvsFilter.gte = filters.min_tvs;
        }
        if (filters.max_tvs !== undefined) {
          tvsFilter.lte = filters.max_tvs;
        }

        // Add TVS filter to operator_state relation
        const whereWithTvs = {
          ...where,
          operator_state: {
            ...(where.operator_state || {}),
            total_tvs: tvsFilter,
          },
        };

        // Fetch operators matching TVS filter
        let operators = await this.prisma.operators.findMany({
          where: whereWithTvs,
          include: {
            operator_state: true,
            operator_metadata: true,
            operator_analytics: {
              orderBy: { date: "desc" },
              take: 1,
            },
            operator_strategy_state: {
              include: {
                strategies: true,
              },
            },
          },
        });

        // Apply risk score filtering if needed (exclude_zero_risk defaults to true)
        if (filters.exclude_zero_risk !== false) {
          operators = operators.filter((op) => {
            const riskScore = op.operator_analytics?.[0]?.risk_score;
            return riskScore && Number(riskScore) > 0;
          });
        }

        // Sort by TVS (or other field) then paginate
        if (sortBy === OperatorSortField.TVS || !sortBy) {
          operators.sort((a, b) => {
            const tvsA = Number(a.operator_state?.total_tvs || 0);
            const tvsB = Number(b.operator_state?.total_tvs || 0);
            return sortOrder === "desc" ? tvsB - tvsA : tvsA - tvsB;
          });
        } else if (sortBy === OperatorSortField.RISK_SCORE) {
          operators.sort((a, b) => {
            const riskA = Number(a.operator_analytics?.[0]?.risk_score || 0);
            const riskB = Number(b.operator_analytics?.[0]?.risk_score || 0);
            return sortOrder === "desc" ? riskB - riskA : riskA - riskB;
          });
        } else if (sortBy === OperatorSortField.DELEGATOR_COUNT) {
          operators.sort((a, b) => {
            const delA = a.operator_state?.active_delegators || 0;
            const delB = b.operator_state?.active_delegators || 0;
            return sortOrder === "desc" ? delB - delA : delA - delB;
          });
        }

        // Paginate
        return operators.slice(
          pagination.offset,
          pagination.offset + pagination.limit,
        );
      }
    });
  }

  async count(filters: ListOperatorsDto): Promise<number> {
    return this.execute(async () => {
      const where = this.buildOperatorFilters(filters);

      if (filters.min_tvs === undefined && filters.max_tvs === undefined) {
        // If only risk filtering is needed (no TVS filtering)
        if (filters.exclude_zero_risk !== false) {
          const matching = await this.prisma.operators.findMany({
            where,
            select: { id: true },
          });
          const ids = matching.map((m) => m.id);
          if (ids.length === 0) return 0;

          const analytics = await this.prisma.operator_analytics.findMany({
            where: {
              operator_id: { in: ids },
            },
            distinct: ["operator_id"],
            orderBy: { date: "desc" },
            select: { operator_id: true, risk_score: true },
          });

          const riskMap = new Map(
            analytics.map((a) => [a.operator_id, Number(a.risk_score ?? 0)]),
          );

          const count = ids.reduce((acc, id) => {
            const risk = riskMap.get(id) ?? 0;
            return acc + (risk > 0 ? 1 : 0);
          }, 0);

          return count;
        }

        return this.prisma.operators.count({ where });
      } else {
        const matching = await this.prisma.operators.findMany({
          where,
          select: { id: true },
        });
        const filteredIds = matching.map((m) => m.id);
        if (filteredIds.length === 0) return 0;

        const aggregates = await this.prisma.operator_strategy_state.groupBy({
          by: ["operator_id"],
          where: { operator_id: { in: filteredIds } },
          _sum: { max_magnitude: true },
        });
        const tvsMap = new Map<string, number>(
          aggregates.map((agg): [string, number] => [
            agg.operator_id,
            Number(agg._sum.max_magnitude || 0),
          ]),
        );

        const filtered = filteredIds.filter((id) => {
          const total = tvsMap.get(id) || 0;
          let ok = true;
          if (filters.min_tvs !== undefined)
            ok = ok && Number(total) >= filters.min_tvs;
          if (filters.max_tvs !== undefined)
            ok = ok && Number(total) <= filters.max_tvs;
          return ok;
        });

        // Apply risk score filtering if needed
        if (filters.exclude_zero_risk !== false) {
          const analytics = await this.prisma.operator_analytics.findMany({
            where: {
              operator_id: { in: filtered },
            },
            distinct: ["operator_id"],
            orderBy: { date: "desc" },
            select: { operator_id: true, risk_score: true },
          });

          const riskMap = new Map(
            analytics.map((a) => [a.operator_id, Number(a.risk_score ?? 0)]),
          );

          const riskFiltered = filtered.filter((id) => {
            const risk = riskMap.get(id) ?? 0;
            return risk > 0;
          });

          return riskFiltered.length;
        }

        return filtered.length;
      }
    });
  }

  async findById(operatorId: string): Promise<any | null> {
    return this.execute(async () => {
      return this.prisma.operators.findUnique({
        where: { id: operatorId },
        include: {
          operator_state: true,
          operator_metadata: true,
          operator_analytics: {
            orderBy: { date: "desc" },
            take: 1,
          },
        },
      });
    });
  }

  async findByIdWithStats(operatorId: string): Promise<any | null> {
    return this.execute(async () => {
      const start = Date.now();

      const operator = await this.prisma.operators.findUnique({
        where: { id: operatorId },
        include: {
          operator_state: true,
          operator_metadata: true,
          operator_analytics: {
            orderBy: { date: "desc" },
            take: 1,
          },
          operator_strategy_state: {
            include: {
              strategies: true,
            },
          },
        },
      });
      console.log(
        `[findByIdWithStats] Operator fetch: ${Date.now() - start}ms`,
      );

      const sharesStart = Date.now();
      const sharesAgg = await this.prisma.operator_delegator_shares.aggregate({
        _sum: { shares: true },
        where: { operator_id: operatorId },
      });
      console.log(
        `[findByIdWithStats] Shares agg: ${Date.now() - sharesStart}ms`,
      );

      if (!operator) return null;

      return {
        ...operator,
        operator_delegator_shares_sum: sharesAgg._sum.shares || 0,
      };
    });
  }

  async findDailySnapshots(
    operatorId: string,
    dateFrom: Date,
    dateTo: Date,
  ): Promise<any[]> {
    return this.execute(async () => {
      return this.prisma.operator_daily_snapshots.findMany({
        where: {
          operator_id: operatorId,
          snapshot_date: {
            gte: dateFrom,
            lte: dateTo,
          },
        },
        orderBy: { snapshot_date: "asc" },
      });
    });
  }

  private buildOperatorFilters(filters: ListOperatorsDto): any {
    const where: any = {};

    // Status filter
    if (filters.status !== OperatorStatus.ALL) {
      where.operator_state = {
        is_active: filters.status === OperatorStatus.ACTIVE,
      };
    }

    // Search filter
    if (filters.search) {
      where.OR = [
        { address: { contains: filters.search, mode: "insensitive" } },
        {
          operator_metadata: {
            metadata_json: {
              path: ["name"],
              string_contains: filters.search,
            },
          },
        },
      ];
    }

    // Slash filter
    if (filters.has_been_slashed !== undefined) {
      if (!where.operator_state) where.operator_state = {};
      where.operator_state.total_slash_events = filters.has_been_slashed
        ? { gt: 0 }
        : 0;
    }

    // Permissioned filter
    if (filters.is_permissioned !== undefined) {
      if (!where.operator_state) where.operator_state = {};
      where.operator_state.is_permissioned = filters.is_permissioned;
    }

    // Delegator count filters
    if (
      filters.min_delegators !== undefined ||
      filters.max_delegators !== undefined
    ) {
      if (!where.operator_state) where.operator_state = {};
      if (filters.min_delegators !== undefined) {
        where.operator_state.active_delegators = {
          gte: filters.min_delegators,
        };
      }
      if (filters.max_delegators !== undefined) {
        where.operator_state.active_delegators = {
          ...where.operator_state.active_delegators,
          lte: filters.max_delegators,
        };
      }
    }

    // AVS count filters
    if (
      filters.min_avs_count !== undefined ||
      filters.max_avs_count !== undefined
    ) {
      if (!where.operator_state) where.operator_state = {};
      if (filters.min_avs_count !== undefined) {
        where.operator_state.active_avs_count = { gte: filters.min_avs_count };
      }
      if (filters.max_avs_count !== undefined) {
        where.operator_state.active_avs_count = {
          ...where.operator_state.active_avs_count,
          lte: filters.max_avs_count,
        };
      }
    }

    return where;
  }

  private buildOperatorOrderBy(sortBy?: OperatorSortField): any {
    switch (sortBy) {
      case OperatorSortField.DELEGATOR_COUNT:
        return { operator_state: { active_delegators: "desc" } };
      case OperatorSortField.AVS_COUNT:
        return { operator_state: { active_avs_count: "desc" } };
      case OperatorSortField.OPERATIONAL_DAYS:
        return { operator_state: { operational_days: "desc" } };
      default:
        return { operator_state: { active_avs_count: "desc" } };
    }
  }
}
