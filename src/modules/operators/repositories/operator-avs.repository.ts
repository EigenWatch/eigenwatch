import { Injectable } from "@nestjs/common";
import { BaseRepository } from "@/core/common/base.repository";
import { PrismaService } from "@/core/database/prisma.service";

@Injectable()
export class OperatorAVSRepository extends BaseRepository<any> {
  constructor(protected readonly prisma: PrismaService) {
    super(prisma);
  }

  async findOperatorAVSRelationships(
    operatorId: string,
    status?: string,
  ): Promise<any[]> {
    return this.execute(async () => {
      const where: any = {
        operator_id: operatorId,
      };

      if (status && status !== "all") {
        where.current_status = status.toUpperCase();
      }

      return this.prisma.operator_avs_relationships.findMany({
        where,
        include: {
          avs: true,
        },
      });
    });
  }

  async findOperatorAVSRelationship(
    operatorId: string,
    avsId: string,
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
    avsId: string,
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
              operator_set_id: set.id, // Use UUID
            },
            include: {
              strategies: true,
            },
            orderBy: { allocated_at: "desc" },
            take: 1, // Get latest allocation
          });

          return {
            ...set,
            latest_allocation: allocations[0] || null,
            allocations: allocations, // Mapper might expect 'allocations' array
          };
        }),
      );

      return setsWithAllocations;
    });
  }

  async findCommissionsForAVS(
    operatorId: string,
    avsId: string,
  ): Promise<any[]> {
    return this.execute(async () => {
      const commissions =
        await this.prisma.operator_commission_history.findMany({
          where: {
            operator_id: operatorId,
            avs_id: avsId,
          },
          orderBy: {
            changed_at: "desc",
          },
        });

      return commissions;
    });
  }

  async findAVSRegistrationHistory(
    operatorId: string,
    avsId: string,
  ): Promise<any[]> {
    return this.execute(async () => {
      return this.prisma.operator_avs_registration_history.findMany({
        where: {
          operator_id: operatorId,
          avs_id: avsId,
        },
        orderBy: {
          status_changed_at: "desc",
        },
      });
    });
  }

  async findAVSRelationshipTimeline(
    operatorId: string,
    avsId: string,
    dateFrom?: Date,
    dateTo?: Date,
  ): Promise<any[]> {
    return this.execute(async () => {
      const whereReg: any = {
        operator_id: operatorId,
        avs_id: avsId,
      };

      const whereComm: any = {
        operator_id: operatorId,
        avs_id: avsId,
      };

      if (dateFrom || dateTo) {
        if (dateFrom) {
          whereReg.status_changed_at = { gte: dateFrom };
          whereComm.changed_at = { gte: dateFrom };
        }
        if (dateTo) {
          whereReg.status_changed_at = {
            ...whereReg.status_changed_at,
            lte: dateTo,
          };
          whereComm.changed_at = { ...whereComm.changed_at, lte: dateTo };
        }
      }

      const registrations =
        await this.prisma.operator_avs_registration_history.findMany({
          where: whereReg,
        });

      const commissions =
        await this.prisma.operator_commission_history.findMany({
          where: whereComm,
        });

      const timeline = [
        ...registrations.map((r) => ({
          type: "registration",
          timestamp: r.status_changed_at,
          status: r.status,
          data: r,
        })),
        ...commissions.map((c) => ({
          type: "commission",
          timestamp: c.changed_at,
          fee: c.new_bips,
          data: c,
        })),
      ];

      return timeline.sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
      );
    });
  }

  async findCommissionOverview(operatorId: string): Promise<any> {
    return this.execute(async () => {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const [rates, historyStats, lastChange, networkStats] = await Promise.all(
        [
          // 1. Get current rates
          this.prisma.operator_commission_rates.findMany({
            where: { operator_id: operatorId },
            include: {
              avs: true,
              operator_sets: {
                include: {
                  avs: true,
                },
              },
            },
          }),

          // 2. Get aggregate stats (max bips, count last 12m)
          this.prisma.operator_commission_history.aggregate({
            where: {
              operator_id: operatorId,
            },
            _max: {
              new_bips: true,
            },
            _count: {
              _all: true,
            },
          }),

          // 3. Get last change date separately (aggregate doesn't support conditional count easily in one go without raw query)
          this.prisma.operator_commission_history.findFirst({
            where: { operator_id: operatorId },
            orderBy: { changed_at: "desc" },
            select: { changed_at: true },
          }),

          // 4. Get network-wide PI commission benchmarks from latest aggregates
          this.prisma.network_daily_aggregates.findFirst({
            orderBy: { snapshot_date: "desc" },
            select: {
              mean_pi_commission_bips: true,
              median_pi_commission_bips: true,
              p25_pi_commission_bips: true,
              p75_pi_commission_bips: true,
              p90_pi_commission_bips: true,
            },
          }),
        ],
      );

      // Get count of changes in last 12 months
      const changesLast12m =
        await this.prisma.operator_commission_history.count({
          where: {
            operator_id: operatorId,
            changed_at: { gte: oneYearAgo },
          },
        });

      return {
        rates,
        stats: {
          max_historical_bips: historyStats._max.new_bips || 0,
          changes_last_12m: changesLast12m,
          last_change_date: lastChange?.changed_at || null,
        },
        network_benchmarks: networkStats
          ? {
              mean_pi_commission_bips: networkStats.mean_pi_commission_bips
                ? Number(networkStats.mean_pi_commission_bips)
                : 0,
              median_pi_commission_bips: networkStats.median_pi_commission_bips
                ? Number(networkStats.median_pi_commission_bips)
                : 0,
              p25_pi_commission_bips: networkStats.p25_pi_commission_bips
                ? Number(networkStats.p25_pi_commission_bips)
                : 0,
              p75_pi_commission_bips: networkStats.p75_pi_commission_bips
                ? Number(networkStats.p75_pi_commission_bips)
                : 0,
              p90_pi_commission_bips: networkStats.p90_pi_commission_bips
                ? Number(networkStats.p90_pi_commission_bips)
                : 0,
            }
          : null,
      };
    });
  }

  async findCommissionHistory(
    operatorId: string,
    filters?: {
      commission_type?: string;
      avs_id?: string;
      date_from?: Date;
      date_to?: Date;
    },
  ): Promise<any[]> {
    return this.execute(async () => {
      const where: any = { operator_id: operatorId };

      if (filters?.avs_id) {
        where.avs_id = filters.avs_id;
      }

      if (filters?.date_from || filters?.date_to) {
        where.changed_at = {};
        if (filters.date_from) where.changed_at.gte = filters.date_from;
        if (filters.date_to) where.changed_at.lte = filters.date_to;
      }

      return this.prisma.operator_commission_history.findMany({
        where,
        include: {
          avs: true,
        },
        orderBy: { changed_at: "desc" },
      });
    });
  }

  /**
   * Get all commission rates for an operator (PI, AVS, and Operator Set)
   */
  async findCommissionRates(operatorId: string): Promise<any[]> {
    return this.execute(async () => {
      return this.prisma.operator_commission_rates.findMany({
        where: { operator_id: operatorId },
        include: {
          avs: true,
          operator_sets: true,
        },
      });
    });
  }
}
