/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from "@nestjs/common";
import {
  ListOperatorsDto,
  OperatorStatus,
  OperatorSortField,
} from "../dto/list-operators.dto";
import { BaseRepository } from "@/core/common/base.repository";
import { PrismaService } from "@/core/database/prisma.service";
import { PaginationParams } from "@/shared/types/query.types";

@Injectable()
export class PrismaOperatorRepository extends BaseRepository<any> {
  constructor(protected prisma: PrismaService) {
    super(prisma);
  }

  async findById(id: string): Promise<any | null> {
    return this.execute(async () => {
      return this.prisma.operators.findUnique({
        where: { id },
        include: {
          operator_state: true,
          operator_metadata: true,
          operator_registration: true,
          operator_strategy_state: {
            include: {
              strategies: true,
            },
          },
          operator_delegator_shares: {
            include: {
              stakers: true,
              strategies: true,
            },
          },
        },
      });
    });
  }

  async findMany(
    filters: ListOperatorsDto,
    pagination: PaginationParams
  ): Promise<any[]> {
    return this.execute(async () => {
      const where = this.buildOperatorFilters(filters);
      const sortBy = filters.sort_by;

      const matchingOperators = await this.prisma.operators.findMany({
        where,
        select: { id: true },
      });
      let filteredIds = matchingOperators.map((o) => o.id);
      if (filteredIds.length === 0) return [];

      let tvsMap: Map<string, number> | undefined;
      if (filters.min_tvs !== undefined || filters.max_tvs !== undefined) {
        const aggregates = await this.prisma.operator_strategy_state.groupBy({
          by: ["operator_id"],
          where: { operator_id: { in: filteredIds } },
          _sum: { max_magnitude: true },
        });
        tvsMap = new Map<string, number>(
          aggregates.map((agg): [string, number] => [
            agg.operator_id,
            Number(agg._sum.max_magnitude || 0),
          ])
        );
        filteredIds = filteredIds.filter((id) => {
          const total = tvsMap.get(id) || 0;
          let ok = true;
          if (filters.min_tvs !== undefined)
            ok = ok && total >= filters.min_tvs;
          if (filters.max_tvs !== undefined)
            ok = ok && total <= filters.max_tvs;
          return ok;
        });
      }

      if (filteredIds.length === 0) return [];

      const orderBy =
        sortBy === OperatorSortField.TVS ||
        sortBy === OperatorSortField.RISK_SCORE
          ? undefined
          : this.buildOperatorOrderBy(filters.sort_by);

      if (orderBy) {
        return this.prisma.operators.findMany({
          where: { id: { in: filteredIds } },
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
          ...this.buildPagination(pagination.limit, pagination.offset),
        });
      } else {
        let sortedIds: string[];
        if (sortBy === OperatorSortField.TVS) {
          if (!tvsMap) {
            const aggregates =
              await this.prisma.operator_strategy_state.groupBy({
                by: ["operator_id"],
                where: { operator_id: { in: filteredIds } },
                _sum: { max_magnitude: true },
              });
            tvsMap = new Map(
              aggregates.map((agg) => [
                agg.operator_id,
                Number(agg._sum.max_magnitude || 0),
              ])
            );
          }
          const withTotal = filteredIds.map((id) => ({
            id,
            total: tvsMap!.get(id) || 0,
          }));
          withTotal.sort((a, b) => b.total - a.total);
          sortedIds = withTotal.map((w) => w.id);
        } else {
          // RISK_SCORE
          const maxDates = await this.prisma.operator_analytics.groupBy({
            by: ["operator_id"],
            _max: { date: true },
            where: { operator_id: { in: filteredIds } },
          });
          const conditions = maxDates
            .filter((md) => md._max.date !== null)
            .map((md) => ({
              operator_id: md.operator_id,
              date: md._max.date!,
            }));
          let riskMap = new Map<string, number>();
          if (conditions.length > 0) {
            const analytics = await this.prisma.operator_analytics.findMany({
              where: { OR: conditions },
              select: { operator_id: true, risk_score: true },
            });
            riskMap = new Map(
              analytics.map((a) => [a.operator_id, Number(a.risk_score ?? 0)])
            );
          }
          const withRisk = filteredIds.map((id) => ({
            id,
            risk: riskMap.get(id) ?? 0,
          }));
          withRisk.sort((a, b) => a.risk - b.risk);
          sortedIds = withRisk.map((w) => w.id);
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
        return filtered.length;
      }
    });
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
  ): Promise<any | null> {
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

  async findDelegatorsByOperatorStrategy(
    operatorId: string,
    strategyId: string
  ): Promise<any[]> {
    return this.execute(async () => {
      return this.prisma.operator_delegator_shares.findMany({
        where: {
          operator_id: operatorId,
          strategy_id: strategyId,
        },
        include: {
          stakers: true,
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
        },
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

  // ============================================================================
  // ACTIVITY TIMELINE QUERIES
  // ============================================================================
  async findOperatorActivities(
    operatorId: string,
    activityTypes?: string[],
    limit: number = 50,
    offset: number = 0
  ): Promise<any[]> {
    return this.execute(async () => {
      const activities: any[] = [];

      // Registration events
      if (!activityTypes || activityTypes.includes("registration")) {
        const registration = await this.prisma.operator_registration.findUnique(
          {
            where: { operator_id: operatorId },
          }
        );
        if (registration) {
          activities.push({
            type: "registration",
            timestamp: registration.registered_at,
            block_number: registration.registration_block,
            transaction_hash: registration.transaction_hash,
            data: registration,
          });
        }
      }

      // Delegation events
      if (!activityTypes || activityTypes.includes("delegation")) {
        const delegationEvents =
          await this.prisma.operator_delegator_history.findMany({
            where: { operator_id: operatorId },
            include: { stakers: true },
            orderBy: { event_timestamp: "desc" },
            take: 100,
          });
        activities.push(
          ...delegationEvents.map((e) => ({
            type: "delegation",
            timestamp: e.event_timestamp,
            block_number: e.event_block,
            transaction_hash: e.transaction_hash,
            data: e,
          }))
        );
      }

      // Allocation events
      if (!activityTypes || activityTypes.includes("allocation")) {
        const allocationEvents =
          await this.prisma.operator_allocations.findMany({
            where: { operator_id: operatorId },
            include: {
              operator_sets: { include: { avs: true } },
              strategies: true,
            },
            orderBy: { allocated_at: "desc" },
            take: 100,
          });
        activities.push(
          ...allocationEvents.map((e) => ({
            type: "allocation",
            timestamp: e.allocated_at,
            block_number: e.allocated_at_block,
            transaction_hash: null,
            data: e,
          }))
        );
      }

      // Commission events
      if (!activityTypes || activityTypes.includes("commission")) {
        const commissionEvents =
          await this.prisma.operator_commission_history.findMany({
            where: { operator_id: operatorId },
            include: { avs: true, operator_sets: true },
            orderBy: { changed_at: "desc" },
            take: 100,
          });
        activities.push(
          ...commissionEvents.map((e) => ({
            type: "commission",
            timestamp: e.changed_at,
            block_number: e.block_number,
            transaction_hash: null,
            data: e,
          }))
        );
      }

      // Metadata events
      if (!activityTypes || activityTypes.includes("metadata")) {
        const metadataEvents =
          await this.prisma.operator_metadata_history.findMany({
            where: { operator_id: operatorId },
            orderBy: { updated_at: "desc" },
            take: 100,
          });
        activities.push(
          ...metadataEvents.map((e) => ({
            type: "metadata",
            timestamp: e.updated_at,
            block_number: e.updated_at_block,
            transaction_hash: e.transaction_hash,
            data: e,
          }))
        );
      }

      // Slashing events
      if (!activityTypes || activityTypes.includes("slashing")) {
        const slashingEvents =
          await this.prisma.operator_slashing_incidents.findMany({
            where: { operator_id: operatorId },
            include: {
              operator_slashing_amounts: { include: { strategies: true } },
              operator_sets: { include: { avs: true } },
            },
            orderBy: { slashed_at: "desc" },
            take: 100,
          });
        activities.push(
          ...slashingEvents.map((e) => ({
            type: "slashing",
            timestamp: e.slashed_at,
            block_number: e.slashed_at_block,
            transaction_hash: e.transaction_hash,
            data: e,
          }))
        );
      }

      // Sort by timestamp descending
      activities.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      // Apply pagination
      return activities.slice(offset, offset + limit);
    });
  }

  // ============================================================================
  // AVS RELATIONSHIP QUERIES
  // ============================================================================
  async findOperatorAVSRelationships(
    operatorId: string,
    status?: string
  ): Promise<any[]> {
    return this.execute(async () => {
      const where: any = { operator_id: operatorId };

      if (status && status !== "all") {
        where.current_status = status;
      }

      return this.prisma.operator_avs_relationships.findMany({
        where,
        include: {
          avs: true,
        },
        orderBy: { total_days_registered: "desc" },
      });
    });
  }

  async findOperatorAVSRelationship(
    operatorId: string,
    avsId: string
  ): Promise<any | null> {
    return this.execute(async () => {
      return this.prisma.operator_avs_relationships.findFirst({
        where: {
          operator_id: operatorId,
          avs_id: avsId,
        },
        include: {
          avs: true,
        },
      });
    });
  }

  async findOperatorSetsForAVS(
    operatorId: string,
    avsId: string
  ): Promise<any[]> {
    return this.execute(async () => {
      // Get all operator sets for this AVS
      const operatorSets = await this.prisma.operator_sets.findMany({
        where: { avs_id: avsId },
      });

      // Get allocations for each operator set
      const setsWithAllocations = await Promise.all(
        operatorSets.map(async (set) => {
          const allocations = await this.prisma.operator_allocations.findMany({
            where: {
              operator_id: operatorId,
              operator_set_id: set.id,
            },
            include: {
              strategies: true,
            },
          });

          return {
            ...set,
            allocations,
            is_active: allocations.length > 0,
          };
        })
      );

      return setsWithAllocations;
    });
  }

  async findCommissionsForAVS(
    operatorId: string,
    avsId: string
  ): Promise<any[]> {
    return this.execute(async () => {
      return this.prisma.operator_commission_rates.findMany({
        where: {
          operator_id: operatorId,
          avs_id: avsId,
        },
        include: {
          operator_sets: true,
        },
      });
    });
  }

  async findAVSRegistrationHistory(
    operatorId: string,
    avsId: string
  ): Promise<any[]> {
    return this.execute(async () => {
      return this.prisma.operator_avs_registration_history.findMany({
        where: {
          operator_id: operatorId,
          avs_id: avsId,
        },
        orderBy: { status_changed_at: "asc" },
      });
    });
  }
}
