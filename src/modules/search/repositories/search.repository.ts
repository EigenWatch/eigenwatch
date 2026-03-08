/* eslint-disable @typescript-eslint/no-explicit-any */
// ============================================================================
// NEW FILE: SRC/MODULES/SEARCH/REPOSITORIES/SEARCH.REPOSITORY.TS
// ============================================================================
import { BaseRepository } from "@/core/common/base.repository";
import { PrismaAnalyticsService } from "@/core/database/prisma-analytics.service";
import { Injectable } from "@nestjs/common";

@Injectable()
export class SearchRepository extends BaseRepository<any> {
  constructor(protected prisma: PrismaAnalyticsService) {
    super(prisma);
  }

  // ============================================================================
  // ENDPOINT 32: Global Search
  // ============================================================================
  async globalSearch(
    query: string,
    entityTypes: string[],
    limit: number
  ): Promise<any> {
    return this.execute(async () => {
      const results: any = {
        operators: [],
        avs: [],
        stakers: [],
      };

      const searchTerm = query.toLowerCase();

      // Search operators
      if (!entityTypes || entityTypes.includes("operators")) {
        const operators = await this.prisma.operators.findMany({
          where: {
            OR: [
              { address: { contains: searchTerm, mode: "insensitive" } },
              {
                operator_metadata: {
                  metadata_json: {
                    path: ["name"],
                    string_contains: searchTerm,
                  },
                },
              },
            ],
          },
          include: {
            operator_metadata: true,
          },
          take: limit,
        });

        results.operators = operators;
      }

      // Search AVS
      if (!entityTypes || entityTypes.includes("avs")) {
        const avs = await this.prisma.avs.findMany({
          where: {
            address: { contains: searchTerm, mode: "insensitive" },
          },
          take: limit,
        });

        results.avs = avs;
      }

      // Search stakers
      if (!entityTypes || entityTypes.includes("stakers")) {
        const stakers = await this.prisma.stakers.findMany({
          where: {
            address: { contains: searchTerm, mode: "insensitive" },
          },
          take: limit,
        });

        results.stakers = stakers;
      }

      return results;
    });
  }

  // ============================================================================
  // ENDPOINT 33: Get Leaderboard
  // ============================================================================
  async getLeaderboard(
    metric: string,
    limit: number,
    date?: Date
  ): Promise<any> {
    return this.execute(async () => {
      // Get target date - either specified or latest
      let targetDate = date;
      if (!targetDate) {
        const latest = await this.prisma.operator_daily_snapshots.findFirst({
          orderBy: { snapshot_date: "desc" },
        });
        targetDate = latest?.snapshot_date;
      }

      // Get all active operators with their metrics
      const operators = await this.prisma.operators.findMany({
        where: {
          operator_state: { is_active: true },
        },
        include: {
          operator_state: true,
          operator_metadata: true,
          operator_analytics: targetDate
            ? { where: { date: targetDate }, take: 1 }
            : { orderBy: { date: "desc" }, take: 1 },
          operator_strategy_state: true,
        },
      });

      return { operators, targetDate };
    });
  }

  // ============================================================================
  // ENDPOINT 34: Get Trending Operators
  // ============================================================================
  async getTrendingOperators(
    metric: string,
    timeframeDays: number,
    limit: number
  ): Promise<any> {
    return this.execute(async () => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - timeframeDays);

      // Get operators with snapshots at both start and end dates
      const operators = await this.prisma.operators.findMany({
        where: {
          operator_state: { is_active: true },
        },
        include: {
          operator_metadata: true,
          operator_state: true,
          operator_strategy_state: true,
          operator_daily_snapshots: {
            where: {
              snapshot_date: {
                in: [startDate, endDate],
              },
            },
            orderBy: { snapshot_date: "asc" },
          },
        },
        take: limit,
      });

      return { operators, startDate, endDate };
    });
  }

  // ============================================================================
  // ENDPOINT 35: Get Recently Active Operators
  // ============================================================================
  async getRecentlyActiveOperators(
    activityTypes: string[],
    hours: number,
    limit: number
  ): Promise<any> {
    return this.execute(async () => {
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - hours);

      const activities: any[] = [];

      // Get recent registration
      if (!activityTypes || activityTypes.includes("registration")) {
        const registrations = await this.prisma.operator_registration.findMany({
          where: {
            registered_at: { gte: cutoffTime },
          },
          include: {
            operators: {
              include: {
                operator_metadata: true,
              },
            },
          },
          orderBy: { registered_at: "desc" },
          take: limit,
        });

        activities.push(
          ...registrations.map((r) => ({
            operator: r.operators,
            activity_type: "registration",
            timestamp: r.registered_at,
            description: "Operator registered",
          }))
        );
      }

      // Get recent allocations
      if (!activityTypes || activityTypes.includes("allocation")) {
        const allocations = await this.prisma.operator_allocations.findMany({
          where: {
            allocated_at: { gte: cutoffTime },
          },
          include: {
            operators: {
              include: {
                operator_metadata: true,
              },
            },
            operator_sets: {
              include: { avs: true },
            },
          },
          orderBy: { allocated_at: "desc" },
          take: limit,
        });

        activities.push(
          ...allocations.map((a) => ({
            operator: a.operators,
            activity_type: "allocation",
            timestamp: a.allocated_at,
            description: "Allocated to operator set",
          }))
        );
      }

      // Get recent commission changes
      if (!activityTypes || activityTypes.includes("commission")) {
        const commissions =
          await this.prisma.operator_commission_history.findMany({
            where: {
              changed_at: { gte: cutoffTime },
            },
            include: {
              operators: {
                include: {
                  operator_metadata: true,
                },
              },
            },
            orderBy: { changed_at: "desc" },
            take: limit,
          });

        activities.push(
          ...commissions.map((c) => ({
            operator: c.operators,
            activity_type: "commission",
            timestamp: c.changed_at,
            description: `Commission changed from ${c.old_bips} to ${c.new_bips} bips`,
          }))
        );
      }

      // Get recent metadata updates
      if (!activityTypes || activityTypes.includes("metadata")) {
        const metadata = await this.prisma.operator_metadata_history.findMany({
          where: {
            updated_at: { gte: cutoffTime },
          },
          include: {
            operators: {
              include: {
                operator_metadata: true,
              },
            },
          },
          orderBy: { updated_at: "desc" },
          take: limit,
        });

        activities.push(
          ...metadata.map((m) => ({
            operator: m.operators,
            activity_type: "metadata",
            timestamp: m.updated_at,
            description: "Metadata updated",
          }))
        );
      }

      // Sort by timestamp and deduplicate by operator
      activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      const uniqueOperators = new Map();
      for (const activity of activities) {
        if (!uniqueOperators.has(activity.operator.id)) {
          uniqueOperators.set(activity.operator.id, activity);
        }
      }

      return Array.from(uniqueOperators.values()).slice(0, limit);
    });
  }
}
