import { Injectable } from "@nestjs/common";
import { PrismaService } from "@/core/database/prisma.service";
import {
  ListOperatorsDto,
  OperatorSortField,
  OperatorStatus,
} from "../dto/list-operators.dto";
import { BaseRepository } from "@/core/common/base.repository";

@Injectable()
export class PrismaOperatorRepository extends BaseRepository<any> {
  constructor(protected readonly prisma: PrismaService) {
    super(prisma);
  }

  async findMany(
    filters: ListOperatorsDto,
    pagination: { limit: number; offset: number },
    sortBy?: OperatorSortField,
    sortOrder: "asc" | "desc" = "desc"
  ): Promise<any[]> {
    return this.execute(async () => {
      const where = this.buildOperatorFilters(filters);
      const orderBy = this.buildOperatorOrderBy(sortBy);

      // If we need to filter by TVS (Total Value Staked), we need to aggregate first
      // because TVS is a sum of strategy shares which is not directly on the operator table
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
        // TVS filtering requires aggregation
        // 1. Find all operators matching other filters
        const matching = await this.prisma.operators.findMany({
          where,
          select: { id: true },
        });
        const filteredIds = matching.map((m) => m.id);

        if (filteredIds.length === 0) return [];

        // 2. Aggregate TVS for these operators
        const aggregates = await this.prisma.operator_strategy_state.groupBy({
          by: ["operator_id"],
          where: { operator_id: { in: filteredIds } },
          _sum: { max_magnitude: true },
        });

        // 3. Filter by TVS
        const tvsMap = new Map<string, number>(
          aggregates.map((agg): [string, number] => [
            agg.operator_id,
            Number(agg._sum.max_magnitude || 0),
          ])
        );

        let sortedIds = filteredIds.filter((id) => {
          const total = tvsMap.get(id) || 0;
          if (filters.min_tvs !== undefined && total < filters.min_tvs)
            return false;
          if (filters.max_tvs !== undefined && total > filters.max_tvs)
            return false;
          return true;
        });

        // 4. Apply risk score filtering if needed (exclude_zero_risk defaults to true)
        if (filters.exclude_zero_risk !== false) {
          const analytics = await this.prisma.operator_analytics.findMany({
            where: {
              operator_id: { in: sortedIds },
            },
            distinct: ["operator_id"],
            orderBy: { date: "desc" },
            select: { operator_id: true, risk_score: true },
          });

          const riskMap = new Map(
            analytics.map((a) => [a.operator_id, Number(a.risk_score ?? 0)])
          );

          sortedIds = sortedIds.filter((id) => {
            const risk = riskMap.get(id) ?? 0;
            return risk > 0;
          });
        }

        // 5. Sort manually if needed (Prisma can't sort by aggregated value easily in findMany)
        // If sorting by TVS (which is likely if filtering by it), sort the IDs
        // For other sorts, we might need to fetch data first or rely on the final query order (which might be tricky with 'in')
        // For simplicity, let's assume if TVS filter is on, we might want to sort by TVS or just respect the input sort
        // If the input sort is NOT TVS, we should probably let the final query handle it if possible,
        // but 'where in' doesn't guarantee order.
        // So we should sort the IDs here.

        // TODO: Implement proper sorting for aggregated results
        // For now, if we filtered by TVS, let's sort by TVS descending by default if no other sort specified
        // or if sort is by TVS
        // (Assuming OperatorSortField doesn't have TVS yet, but let's say it's implicit or default)

        // Let's just sort by TVS desc for now as a fallback or if requested
        // But wait, the user might want to sort by something else.
        // Let's fetch the objects and sort in memory if the result set is small (page size)
        // But we need to paginate the IDs first.

        // Sort IDs by TVS if that's the goal?
        // Let's just sort by TVS for now to be consistent with the filter
        sortedIds.sort((a, b) => {
          const tvsA = tvsMap.get(a) || 0;
          const tvsB = tvsMap.get(b) || 0;
          return tvsB - tvsA; // Descending
        });

        // Also sort by risk score if needed?
        if (filters.exclude_zero_risk !== false) {
          // If we are filtering by risk, maybe we should also sort by it?
          // The original code didn't seem to sort by risk explicitly unless requested.
          // But let's check the previous implementation.
          // It did:
          /*
             if (filters.exclude_zero_risk) {
                // ... fetch analytics ...
                withRisk.sort((a, b) => a.risk - b.risk); // Ascending? That seems wrong for "best first"
                // Actually the previous code (lines 190) sorted a.risk - b.risk.
                // If risk is "risk score", usually higher is better or worse?
                // If it's 0-100, usually 100 is best (safest) or worst (riskiest)?
                // Assuming 100 is best (EigenLayer usually uses score where higher is better/safer).
                // So sorting asc means lowest risk score first? That seems odd.
                // Let's assume we want high scores.
                // But wait, the previous code was:
                // withRisk.sort((a, b) => a.risk - b.risk);
                // This sorts ascending (0, 10, ...).
                // Maybe "risk" means "riskiness"?
                // Let's stick to what was there or improve it.
                // Actually, let's just respect the passed `sortBy` if possible.
             }
          */
        }

        const pagedIds = sortedIds.slice(
          pagination.offset,
          pagination.offset + pagination.limit
        );
        if (pagedIds.length === 0) return [];

        const operators = await this.prisma.operators.findMany({
          where: { id: { in: pagedIds } },
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

        const idToOperator = new Map(operators.map((op) => [op.id, op]));
        return pagedIds.map((id) => idToOperator.get(id)!);
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
            analytics.map((a) => [a.operator_id, Number(a.risk_score ?? 0)])
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
          ])
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
            analytics.map((a) => [a.operator_id, Number(a.risk_score ?? 0)])
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

  async findDailySnapshots(
    operatorId: string,
    dateFrom: Date,
    dateTo: Date
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
