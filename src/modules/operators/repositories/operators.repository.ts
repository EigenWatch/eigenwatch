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

  // ============================================================================
  // COMMISSION QUERIES (Endpoints 10-11)
  // ============================================================================

  async findCommissionOverview(operatorId: string): Promise<any> {
    return this.execute(async () => {
      const commissions = await this.prisma.operator_commission_rates.findMany({
        where: { operator_id: operatorId },
        include: {
          avs: true,
          operator_sets: {
            include: { avs: true },
          },
        },
      });

      return commissions;
    });
  }

  async findCommissionHistory(
    operatorId: string,
    filters: {
      commission_type?: string;
      avs_id?: string;
      date_from?: Date;
      date_to?: Date;
    }
  ): Promise<any[]> {
    return this.execute(async () => {
      const where: any = { operator_id: operatorId };

      if (filters.commission_type) {
        where.commission_type = filters.commission_type;
      }

      if (filters.avs_id) {
        where.avs_id = filters.avs_id;
      }

      if (filters.date_from || filters.date_to) {
        where.changed_at = {};
        if (filters.date_from) {
          where.changed_at.gte = filters.date_from;
        }
        if (filters.date_to) {
          where.changed_at.lte = filters.date_to;
        }
      }

      return this.prisma.operator_commission_history.findMany({
        where,
        include: {
          avs: true,
          operator_sets: {
            include: { avs: true },
          },
        },
        orderBy: { changed_at: "desc" },
      });
    });
  }

  // ============================================================================
  // DELEGATOR QUERIES (Endpoints 12-14)
  // ============================================================================

  async findDelegators(
    operatorId: string,
    filters: {
      status?: string;
      min_shares?: number;
      max_shares?: number;
    },
    pagination: { limit: number; offset: number },
    sortBy: string = "shares",
    sortOrder: "asc" | "desc" = "desc"
  ): Promise<any[]> {
    return this.execute(async () => {
      const where: any = { operator_id: operatorId };

      if (filters.status !== "all") {
        where.is_delegated = filters.status === "active";
      }

      // Get delegators
      const delegators = await this.prisma.operator_delegators.findMany({
        where,
        include: {
          stakers: true,
        },
      });

      // TODO: Optimize the db schema so one does not have to do all these calculations here (try to expose operator_delegator_shares, calculate min and max in pipeline )
      // Fetch shares separately because generated Prisma include type doesn't expose
      // operator_delegator_shares on operator_delegators include type.
      const stakerIds = delegators.map((d) => d.staker_id);
      const shares =
        stakerIds.length > 0
          ? await this.prisma.operator_delegator_shares.findMany({
              where: {
                operator_id: operatorId,
                staker_id: { in: stakerIds },
              },
            })
          : [];

      const sharesByStaker = shares.reduce((acc, s) => {
        const arr = acc.get(s.staker_id) || [];
        arr.push(s);
        acc.set(s.staker_id, arr);
        return acc;
      }, new Map<string, any[]>());

      // Calculate total shares for each delegator
      const delegatorsWithShares = delegators.map((d) => {
        const stakerShares = sharesByStaker.get(d.staker_id) || [];
        const totalShares = stakerShares.reduce(
          (sum, s) => sum + parseFloat(s.shares.toString()),
          0
        );
        return { ...d, operator_delegator_shares: stakerShares, totalShares };
      });

      // Apply share filters
      let filtered = delegatorsWithShares;
      if (filters.min_shares !== undefined) {
        filtered = filtered.filter((d) => d.totalShares >= filters.min_shares!);
      }
      if (filters.max_shares !== undefined) {
        filtered = filtered.filter((d) => d.totalShares <= filters.max_shares!);
      }

      // Apply sorting
      if (sortBy === "shares") {
        filtered.sort((a, b) =>
          sortOrder === "desc"
            ? b.totalShares - a.totalShares
            : a.totalShares - b.totalShares
        );
      } else if (sortBy === "delegation_date") {
        filtered.sort((a, b) => {
          const dateA = a.delegated_at ? new Date(a.delegated_at).getTime() : 0;
          const dateB = b.delegated_at ? new Date(b.delegated_at).getTime() : 0;
          return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
        });
      }

      // Apply pagination
      return filtered.slice(
        pagination.offset,
        pagination.offset + pagination.limit
      );
    });
  }

  async countDelegators(
    operatorId: string,
    filters: {
      status?: string;
      min_shares?: number;
      max_shares?: number;
    }
  ): Promise<number> {
    return this.execute(async () => {
      const where: any = { operator_id: operatorId };

      if (filters.status !== "all") {
        where.is_delegated = filters.status === "active";
      }

      if (
        filters.min_shares === undefined &&
        filters.max_shares === undefined
      ) {
        return this.prisma.operator_delegators.count({ where });
      }

      // Need to filter by shares - fetch all and filter
      const delegators = await this.prisma.operator_delegators.findMany({
        where,
        include: {
          stakers: true,
        },
      });

      const stakerIds = delegators.map((d) => d.staker_id);
      const shares =
        stakerIds.length > 0
          ? await this.prisma.operator_delegator_shares.findMany({
              where: {
                operator_id: operatorId,
                staker_id: { in: stakerIds },
              },
            })
          : [];

      const sharesByStaker = shares.reduce((acc, s) => {
        const arr = acc.get(s.staker_id) || [];
        arr.push(s);
        acc.set(s.staker_id, arr);
        return acc;
      }, new Map<string, any[]>());

      const delegatorsWithShares = delegators.map((d) => {
        const stakerShares = sharesByStaker.get(d.staker_id) || [];
        const totalShares = stakerShares.reduce(
          (sum, s) => sum + parseFloat(s.shares.toString()),
          0
        );
        return { ...d, totalShares };
      });

      let filtered = delegatorsWithShares;
      if (filters.min_shares !== undefined) {
        filtered = filtered.filter((d) => d.totalShares >= filters.min_shares!);
      }
      if (filters.max_shares !== undefined) {
        filtered = filtered.filter((d) => d.totalShares <= filters.max_shares!);
      }

      return filtered.length;
    });
  }

  async getDelegatorsSummary(operatorId: string): Promise<any> {
    return this.execute(async () => {
      const [totalDelegators, activeDelegators, sharesData] = await Promise.all(
        [
          this.prisma.operator_delegators.count({
            where: { operator_id: operatorId },
          }),
          this.prisma.operator_delegators.count({
            where: { operator_id: operatorId, is_delegated: true },
          }),
          this.prisma.operator_delegator_shares.aggregate({
            where: { operator_id: operatorId },
            _sum: { shares: true },
          }),
        ]
      );

      return {
        total_delegators: totalDelegators,
        active_delegators: activeDelegators,
        total_shares: sharesData._sum.shares?.toString() || "0",
      };
    });
  }

  async findDelegatorDetail(
    operatorId: string,
    stakerId: string
  ): Promise<any | null> {
    return this.execute(async () => {
      const delegator = await this.prisma.operator_delegators.findFirst({
        where: {
          operator_id: operatorId,
          staker_id: stakerId,
        },
        include: {
          stakers: true,
        },
      });

      if (!delegator) return null;

      // Fetch shares separately because operator_delegator_shares is not available
      // on the generated include type for operator_delegators.
      const shares = await this.prisma.operator_delegator_shares.findMany({
        where: {
          operator_id: operatorId,
          staker_id: stakerId,
        },
        include: {
          strategies: true,
        },
      });

      return { ...delegator, operator_delegator_shares: shares };
    });
  }

  async findDelegationHistory(
    operatorId: string,
    filters: {
      event_type?: string;
      date_from?: Date;
      date_to?: Date;
    },
    pagination: { limit: number; offset: number }
  ): Promise<any[]> {
    return this.execute(async () => {
      const where: any = { operator_id: operatorId };

      if (filters.event_type && filters.event_type !== "all") {
        where.delegation_type = filters.event_type;
      }

      if (filters.date_from || filters.date_to) {
        where.event_timestamp = {};
        if (filters.date_from) {
          where.event_timestamp.gte = filters.date_from;
        }
        if (filters.date_to) {
          where.event_timestamp.lte = filters.date_to;
        }
      }

      return this.prisma.operator_delegator_history.findMany({
        where,
        include: {
          stakers: true,
        },
        orderBy: { event_timestamp: "desc" },
        ...this.buildPagination(pagination.limit, pagination.offset),
      });
    });
  }

  async countDelegationHistory(
    operatorId: string,
    filters: {
      event_type?: string;
      date_from?: Date;
      date_to?: Date;
    }
  ): Promise<number> {
    return this.execute(async () => {
      const where: any = { operator_id: operatorId };

      if (filters.event_type && filters.event_type !== "all") {
        where.delegation_type = filters.event_type;
      }

      if (filters.date_from || filters.date_to) {
        where.event_timestamp = {};
        if (filters.date_from) {
          where.event_timestamp.gte = filters.date_from;
        }
        if (filters.date_to) {
          where.event_timestamp.lte = filters.date_to;
        }
      }

      return this.prisma.operator_delegator_history.count({ where });
    });
  }

  // ============================================================================
  // ALLOCATION QUERIES (Endpoints 15-16)
  // ============================================================================

  async findAllocationsOverview(operatorId: string): Promise<any> {
    return this.execute(async () => {
      // Get all allocations
      const allocations = await this.prisma.operator_allocations.findMany({
        where: { operator_id: operatorId },
        include: {
          operator_sets: {
            include: { avs: true },
          },
          strategies: true,
        },
      });

      // Get strategy states for available magnitude
      const strategyStates = await this.prisma.operator_strategy_state.findMany(
        {
          where: { operator_id: operatorId },
          include: { strategies: true },
        }
      );

      return { allocations, strategyStates };
    });
  }

  async findDetailedAllocations(
    operatorId: string,
    filters: {
      avs_id?: string;
      strategy_id?: string;
      min_magnitude?: number;
      max_magnitude?: number;
    },
    pagination: { limit: number; offset: number },
    sortBy: string = "magnitude",
    sortOrder: "asc" | "desc" = "desc"
  ): Promise<any[]> {
    return this.execute(async () => {
      const where: any = { operator_id: operatorId };

      if (filters.strategy_id) {
        where.strategy_id = filters.strategy_id;
      }

      // Get all allocations first
      const allocations = await this.prisma.operator_allocations.findMany({
        where,
        include: {
          operator_sets: {
            include: { avs: true },
          },
          strategies: true,
        },
      });

      // Apply filters
      let filtered = allocations;

      if (filters.avs_id) {
        filtered = filtered.filter(
          (a) => a.operator_sets.avs_id === filters.avs_id
        );
      }

      if (filters.min_magnitude !== undefined) {
        filtered = filtered.filter(
          (a) => parseFloat(a.magnitude.toString()) >= filters.min_magnitude!
        );
      }

      if (filters.max_magnitude !== undefined) {
        filtered = filtered.filter(
          (a) => parseFloat(a.magnitude.toString()) <= filters.max_magnitude!
        );
      }

      // Apply sorting
      const sorted = this.sortAllocations(filtered, sortBy, sortOrder);

      // Apply pagination
      return sorted.slice(
        pagination.offset,
        pagination.offset + pagination.limit
      );
    });
  }

  async countDetailedAllocations(
    operatorId: string,
    filters: {
      avs_id?: string;
      strategy_id?: string;
      min_magnitude?: number;
      max_magnitude?: number;
    }
  ): Promise<number> {
    return this.execute(async () => {
      const where: any = { operator_id: operatorId };

      if (filters.strategy_id) {
        where.strategy_id = filters.strategy_id;
      }

      if (
        !filters.avs_id &&
        filters.min_magnitude === undefined &&
        filters.max_magnitude === undefined
      ) {
        return this.prisma.operator_allocations.count({ where });
      }

      // Need to filter - fetch all
      const allocations = await this.prisma.operator_allocations.findMany({
        where,
        include: {
          operator_sets: true,
        },
      });

      let filtered = allocations;

      if (filters.avs_id) {
        filtered = filtered.filter(
          (a) => a.operator_sets.avs_id === filters.avs_id
        );
      }

      if (filters.min_magnitude !== undefined) {
        filtered = filtered.filter(
          (a) => parseFloat(a.magnitude.toString()) >= filters.min_magnitude!
        );
      }

      if (filters.max_magnitude !== undefined) {
        filtered = filtered.filter(
          (a) => parseFloat(a.magnitude.toString()) <= filters.max_magnitude!
        );
      }

      return filtered.length;
    });
  }

  private sortAllocations(
    allocations: any[],
    sortBy: string,
    sortOrder: "asc" | "desc"
  ): any[] {
    return allocations.sort((a, b) => {
      let compareResult = 0;

      switch (sortBy) {
        case "magnitude":
          compareResult =
            parseFloat(a.magnitude.toString()) -
            parseFloat(b.magnitude.toString());
          break;
        case "effect_block":
          compareResult = a.effect_block - b.effect_block;
          break;
        case "allocated_at":
          compareResult =
            new Date(a.allocated_at).getTime() -
            new Date(b.allocated_at).getTime();
          break;
        default:
          compareResult = 0;
      }

      return sortOrder === "desc" ? -compareResult : compareResult;
    });
  }

  // ============================================================================
  // RISK & ANALYTICS QUERIES (Endpoints 17-19)
  // ============================================================================

  async findRiskAssessment(
    operatorId: string,
    date?: Date
  ): Promise<any | null> {
    return this.execute(async () => {
      const where: any = { operator_id: operatorId };

      if (date) {
        where.date = date;
      } else {
        // Get latest assessment
        const latest = await this.prisma.operator_analytics.findFirst({
          where: { operator_id: operatorId },
          orderBy: { date: "desc" },
        });

        if (!latest) return null;
        where.date = latest.date;
      }

      return this.prisma.operator_analytics.findFirst({ where });
    });
  }

  async findConcentrationMetrics(
    operatorId: string,
    concentrationType: string,
    date?: Date
  ): Promise<any[]> {
    return this.execute(async () => {
      const where: any = {
        entity_type: "operator",
        entity_id: operatorId,
        concentration_type: concentrationType,
      };

      if (date) {
        where.date = date;
      } else {
        // Get latest metrics
        const latest = await this.prisma.concentration_metrics.findFirst({
          where: {
            entity_type: "operator",
            entity_id: operatorId,
            concentration_type: concentrationType,
          },
          orderBy: { date: "desc" },
        });

        if (!latest) return [];
        where.date = latest.date;
      }

      return this.prisma.concentration_metrics.findMany({
        where,
        orderBy: { date: "desc" },
      });
    });
  }

  async findVolatilityMetrics(
    operatorId: string,
    metricType: string,
    date?: Date
  ): Promise<any[]> {
    return this.execute(async () => {
      const where: any = {
        entity_type: "operator",
        entity_id: operatorId,
        metric_type: metricType,
      };

      if (date) {
        where.date = date;
      } else {
        // Get latest metrics
        const latest = await this.prisma.volatility_metrics.findFirst({
          where: {
            entity_type: "operator",
            entity_id: operatorId,
            metric_type: metricType,
          },
          orderBy: { date: "desc" },
        });

        if (!latest) return [];
        where.date = latest.date;
      }

      return this.prisma.volatility_metrics.findMany({
        where,
        orderBy: { date: "desc" },
      });
    });
  }

  // ============================================================================
  // TIME SERIES QUERIES (Endpoints 20-25)
  // ============================================================================

  // In PrismaOperatorRepository class:

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
        include: {
          strategies: true,
        },
        orderBy: { snapshot_date: "asc" },
      });
    });
  }

  async findDelegatorSharesHistory(
    operatorId: string,
    stakerId: string,
    filters: {
      strategy_id?: string;
      date_from?: Date;
      date_to?: Date;
    }
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
        if (filters.date_from) {
          where.snapshot_date.gte = filters.date_from;
        }
        if (filters.date_to) {
          where.snapshot_date.lte = filters.date_to;
        }
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

  async findAVSRelationshipTimeline(
    operatorId: string,
    avsId: string,
    dateFrom: Date,
    dateTo: Date
  ): Promise<any[]> {
    return this.execute(async () => {
      return this.prisma.operator_avs_relationship_snapshots.findMany({
        where: {
          operator_id: operatorId,
          avs_id: avsId,
          snapshot_date: {
            gte: dateFrom,
            lte: dateTo,
          },
        },
        orderBy: { snapshot_date: "asc" },
      });
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

  async findSlashingIncidents(operatorId: string): Promise<any[]> {
    return this.execute(async () => {
      return this.prisma.operator_slashing_incidents.findMany({
        where: { operator_id: operatorId },
        include: {
          operator_slashing_amounts: {
            include: {
              strategies: true,
            },
          },
          operator_sets: {
            include: { avs: true },
          },
        },
        orderBy: { slashed_at: "desc" },
      });
    });
  }

  // ============================================================================
  // COMPARISON QUERIES (Endpoints 26-28)
  // ============================================================================

  async findOperatorsForComparison(operatorIds: string[]): Promise<any[]> {
    return this.execute(async () => {
      return this.prisma.operators.findMany({
        where: { id: { in: operatorIds } },
        include: {
          operator_state: true,
          operator_metadata: true,
          operator_analytics: {
            orderBy: { date: "desc" },
            take: 1,
          },
          operator_strategy_state: true,
        },
      });
    });
  }

  async calculateOperatorPercentiles(
    operatorId: string,
    date?: Date
  ): Promise<any> {
    return this.execute(async () => {
      // Get operator's values
      const operator = await this.prisma.operators.findUnique({
        where: { id: operatorId },
        include: {
          operator_state: true,
          operator_analytics: date
            ? { where: { date }, take: 1 }
            : { orderBy: { date: "desc" }, take: 1 },
          operator_strategy_state: true,
        },
      });

      if (!operator) return null;

      // Get network-wide data for comparison
      const dateFilter = date || operator.operator_analytics[0]?.date;
      const allOperators = await this.prisma.operators.findMany({
        where: { operator_state: { is_active: true } },
        include: {
          operator_state: true,
          operator_analytics: dateFilter
            ? { where: { date: dateFilter }, take: 1 }
            : { orderBy: { date: "desc" }, take: 1 },
          operator_strategy_state: true,
        },
      });

      return { operator, allOperators };
    });
  }

  async getNetworkAverages(date?: Date): Promise<any> {
    return this.execute(async () => {
      // const where: any = date ? { snapshot_date: date } : {};

      // Get latest snapshot if no date specified
      let targetDate = date;
      if (!targetDate) {
        const latest = await this.prisma.network_daily_aggregates.findFirst({
          orderBy: { snapshot_date: "desc" },
        });
        targetDate = latest?.snapshot_date;
      }

      if (!targetDate) return null;

      return this.prisma.network_daily_aggregates.findUnique({
        where: { snapshot_date: targetDate },
      });
    });
  }
}
