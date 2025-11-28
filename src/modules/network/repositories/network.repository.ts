/* eslint-disable @typescript-eslint/no-explicit-any */

import { BaseRepository } from "@/core/common/base.repository";
import { PrismaService } from "@/core/database/prisma.service";
import { Injectable } from "@nestjs/common";

@Injectable()
export class NetworkRepository extends BaseRepository<any> {
  constructor(protected prisma: PrismaService) {
    super(prisma);
  }

  async getNetworkStatistics(): Promise<any> {
    return this.execute(async () => {
      // Get latest snapshot
      const latest = await this.prisma.network_daily_aggregates.findFirst({
        orderBy: { snapshot_date: "desc" },
      });

      if (!latest) return null;

      // Get total operators count
      const [totalOperators, activeOperators, totalAVS, totalDelegators] =
        await Promise.all([
          this.prisma.operators.count(),
          this.prisma.operators.count({
            where: { operator_state: { is_active: true } },
          }),
          this.prisma.avs.count(),
          this.prisma.stakers.count(),
        ]);

      return {
        latest,
        totalOperators,
        activeOperators,
        totalAVS,
        totalDelegators,
      };
    });
  }

  async getNetworkDistribution(metric: string, date?: Date): Promise<any> {
    return this.execute(async () => {
      // Get target date
      let targetDate = date;
      if (!targetDate) {
        const latest = await this.prisma.network_daily_aggregates.findFirst({
          orderBy: { snapshot_date: "desc" },
        });
        targetDate = latest?.snapshot_date;
      }

      if (!targetDate) return null;

      // Get all operator snapshots for that date
      const snapshots = await this.prisma.operator_daily_snapshots.findMany({
        where: { snapshot_date: targetDate },
        include: {
          operators: {
            include: {
              operator_strategy_state: true,
            },
          },
        },
      });

      return { snapshots, targetDate };
    });
  }

  async getNetworkHistory(dateFrom: Date, dateTo: Date): Promise<any[]> {
    return this.execute(async () => {
      return this.prisma.network_daily_aggregates.findMany({
        where: {
          snapshot_date: {
            gte: dateFrom,
            lte: dateTo,
          },
        },
        orderBy: { snapshot_date: "asc" },
      });
    });
  }
}
