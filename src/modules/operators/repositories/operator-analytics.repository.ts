import { Injectable } from "@nestjs/common";
import { BaseRepository } from "@/core/common/base.repository";
import { PrismaService } from "@/core/database/prisma.service";

@Injectable()
export class OperatorAnalyticsRepository extends BaseRepository<any> {
  constructor(protected readonly prisma: PrismaService) {
    super(prisma);
  }

  async findRiskAssessment(operatorId: string, date?: Date): Promise<any> {
    return this.execute(async () => {
      const where: any = {
        operator_id: operatorId,
      };

      if (date) {
        where.date = date;
      }

      const analytics = await this.prisma.operator_analytics.findFirst({
        where,
        orderBy: { date: "desc" },
      });

      if (!analytics) return null;

      return analytics;
    });
  }

  async findOperatorActivities(
    operatorId: string,
    activityTypes?: string[],
    limit: number = 10,
    offset: number = 0
  ): Promise<any[]> {
    return this.execute(async () => {
      const [registrations, commissions, delegations, allocations, metadata] =
        await Promise.all([
          this.prisma.operator_avs_registration_history.findMany({
            where: { operator_id: operatorId },
            take: limit,
            orderBy: { status_changed_at: "desc" },
          }),
          this.prisma.operator_commission_history.findMany({
            where: { operator_id: operatorId },
            take: limit,
            orderBy: { changed_at: "desc" },
          }),
          this.prisma.operator_delegator_history.findMany({
            where: { operator_id: operatorId },
            take: limit,
            orderBy: { event_timestamp: "desc" },
            include: { stakers: true },
          }),
          this.prisma.operator_allocations.findMany({
            where: { operator_id: operatorId },
            take: limit,
            orderBy: { allocated_at: "desc" },
            include: {
              strategies: true,
              operator_sets: { include: { avs: true } },
            },
          }),
          this.prisma.operator_metadata_history.findMany({
            where: { operator_id: operatorId },
            take: limit,
            orderBy: { updated_at: "desc" },
          }),
        ]);

      const activities = [
        ...registrations.map((r) => ({
          type: "registration",
          timestamp: r.status_changed_at,
          block_number: r.status_changed_block,
          transaction_hash: r.transaction_hash,
          data: r,
        })),
        ...commissions.map((c) => ({
          type: "commission",
          timestamp: c.changed_at,
          block_number: c.block_number,
          transaction_hash: null,
          data: c,
        })),
        ...delegations.map((d) => ({
          type: "delegation",
          timestamp: d.event_timestamp,
          block_number: d.event_block,
          transaction_hash: d.transaction_hash,
          data: d,
        })),
        ...allocations.map((a) => ({
          type: "allocation",
          timestamp: a.allocated_at,
          block_number: a.allocated_at_block,
          transaction_hash: null,
          data: a,
        })),
        ...metadata.map((m) => ({
          type: "metadata",
          timestamp: m.updated_at,
          block_number: m.updated_at_block,
          transaction_hash: m.transaction_hash,
          data: m,
        })),
      ];

      return activities
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(offset, offset + limit);
    });
  }

  async findConcentrationMetrics(
    operatorId: string,
    concentrationType: string,
    date?: Date
  ): Promise<any> {
    return this.execute(async () => {
      const where: any = {
        operator_id: operatorId,
        concentration_type: concentrationType,
      };

      if (date) {
        where.date = date;
      }

      return this.prisma.concentration_metrics.findFirst({
        where,
        orderBy: { date: "desc" },
      });
    });
  }

  async findVolatilityMetrics(
    operatorId: string,
    metricType: string,
    date?: Date
  ): Promise<any> {
    return this.execute(async () => {
      const where: any = {
        operator_id: operatorId,
        metric_type: metricType,
      };

      if (date) {
        where.date = date;
      }

      return this.prisma.volatility_metrics.findFirst({
        where,
        orderBy: { date: "desc" },
      });
    });
  }

  async findDailySnapshots(
    operatorId: string,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<any[]> {
    return this.execute(async () => {
      const where: any = {
        operator_id: operatorId,
      };

      if (dateFrom || dateTo) {
        where.snapshot_date = {};
        if (dateFrom) {
          where.snapshot_date.gte = dateFrom;
        }
        if (dateTo) {
          where.snapshot_date.lte = dateTo;
        }
      }

      return this.prisma.operator_daily_snapshots.findMany({
        where,
        orderBy: { snapshot_date: "asc" },
      });
    });
  }

  async findSlashingIncidents(operatorId: string): Promise<any[]> {
    return this.execute(async () => {
      return this.prisma.operator_slashing_incidents.findMany({
        where: { operator_id: operatorId },
        include: {
          operator_sets: {
            include: {
              avs: true,
            },
          },
          operator_slashing_amounts: {
            include: {
              strategies: true,
            },
          },
        },
        orderBy: { slashed_at: "desc" },
      });
    });
  }

  async findOperatorsForComparison(operatorIds: string[]): Promise<any[]> {
    return this.execute(async () => {
      return this.prisma.operators.findMany({
        where: {
          id: { in: operatorIds },
        },
        include: {
          operator_state: true,
          operator_analytics: {
            orderBy: { date: "desc" },
            take: 1,
          },
        },
      });
    });
  }

  async calculateOperatorPercentiles(
    operatorId: string,
    date?: Date
  ): Promise<any> {
    return this.execute(async () => {
      const where: any = { operator_id: operatorId };
      if (date) {
        where.date = date;
      }

      const analytics = await this.prisma.operator_analytics.findFirst({
        where,
        orderBy: { date: "desc" },
      });

      return {
        tvl_percentile: analytics?.size_percentile || 0,
        risk_percentile: 0,
        performance_percentile: 0,
      };
    });
  }

  async getNetworkAverages(date?: Date): Promise<any> {
    return this.execute(async () => {
      const where: any = {};
      if (date) {
        where.snapshot_date = date;
      }

      const aggregate = await this.prisma.network_daily_aggregates.findFirst({
        where,
        orderBy: { snapshot_date: "desc" },
      });

      return aggregate || {};
    });
  }
}
