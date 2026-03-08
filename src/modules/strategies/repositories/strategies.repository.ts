import { Injectable } from "@nestjs/common";
import { BaseRepository } from "@/core/common/base.repository";
import { PrismaAnalyticsService } from "@/core/database/prisma-analytics.service";
import {
  ListStrategiesDto,
  StrategySortField,
} from "../dto/list-strategies.dto";

@Injectable()
export class StrategiesRepository extends BaseRepository<any> {
  constructor(protected readonly prisma: PrismaAnalyticsService) {
    super(prisma);
  }

  /**
   * Find all strategies with filtering and pagination
   */
  async findAll(
    filters: ListStrategiesDto,
    pagination: { limit: number; offset: number },
    sortBy: StrategySortField = StrategySortField.TVS,
    sortOrder: "asc" | "desc" = "desc",
  ): Promise<any[]> {
    return this.execute(async () => {
      // Aggregate TVS per strategy from operator_strategy_state
      const strategyAggregates =
        await this.prisma.operator_strategy_state.groupBy({
          by: ["strategy_id"],
          _sum: { tvs_usd: true },
          _count: { operator_id: true },
        });

      // Create a map of strategy_id -> {tvs, operator_count}
      const statsMap = new Map(
        strategyAggregates.map((s) => [
          s.strategy_id,
          {
            total_tvs_usd: s._sum.tvs_usd || 0,
            operator_count: s._count.operator_id || 0,
          },
        ]),
      );

      // Get strategies with exchange rates and token metadata
      const strategies = await this.prisma.strategies.findMany({
        include: {
          operator_strategy_state: {
            select: { operator_id: true },
            distinct: ["operator_id"],
          },
        },
      });

      // Get exchange rates
      const exchangeRates =
        await this.prisma.strategy_exchange_rates.findMany();
      const rateMap = new Map(
        exchangeRates.map((r) => [r.strategy_address.toLowerCase(), r]),
      );

      // Get token metadata for underlying tokens (normalize to lowercase)
      const underlyingTokens = exchangeRates
        .filter((r) => r.underlying_token)
        .map((r) => r.underlying_token!.toLowerCase());

      const tokenMetadata = await this.prisma.token_metadata.findMany({
        where: { contract_address: { in: underlyingTokens } },
      });
      const tokenMap = new Map(
        tokenMetadata.map((t) => [t.contract_address.toLowerCase(), t]),
      );

      // Enrich strategies with stats and metadata
      let enriched = strategies.map((strategy) => {
        const stats = statsMap.get(strategy.id) || {
          total_tvs_usd: 0,
          operator_count: 0,
        };
        const rate = rateMap.get(strategy.address.toLowerCase());
        const token = rate?.underlying_token
          ? tokenMap.get(rate.underlying_token.toLowerCase())
          : null;

        return {
          ...strategy,
          total_tvs_usd: stats.total_tvs_usd,
          operator_count: stats.operator_count,
          exchange_rate: rate?.shares_to_underlying_rate,
          underlying_token: rate?.underlying_token,
          token_metadata: token,
        };
      });

      // Apply filters
      if (filters.min_tvs !== undefined) {
        enriched = enriched.filter(
          (s) => Number(s.total_tvs_usd) >= filters.min_tvs!,
        );
      }
      if (filters.max_tvs !== undefined) {
        enriched = enriched.filter(
          (s) => Number(s.total_tvs_usd) <= filters.max_tvs!,
        );
      }
      if (filters.min_operators !== undefined) {
        enriched = enriched.filter(
          (s) => s.operator_count >= filters.min_operators!,
        );
      }
      if (filters.search) {
        const search = filters.search.toLowerCase();
        enriched = enriched.filter(
          (s) =>
            s.address.toLowerCase().includes(search) ||
            s.token_metadata?.symbol?.toLowerCase().includes(search) ||
            s.token_metadata?.name?.toLowerCase().includes(search),
        );
      }
      if (filters.category) {
        enriched = enriched.filter((s) =>
          s.token_metadata?.categories?.includes(filters.category!),
        );
      }
      if (filters.has_price_feed !== undefined) {
        enriched = enriched.filter((s) =>
          filters.has_price_feed
            ? s.token_metadata?.coingecko_id != null
            : s.token_metadata?.coingecko_id == null,
        );
      }

      // Sort
      enriched.sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
          case StrategySortField.TVS:
            comparison = Number(a.total_tvs_usd) - Number(b.total_tvs_usd);
            break;
          case StrategySortField.OPERATOR_COUNT:
            comparison = a.operator_count - b.operator_count;
            break;
          default:
            comparison = Number(a.total_tvs_usd) - Number(b.total_tvs_usd);
        }
        return sortOrder === "desc" ? -comparison : comparison;
      });

      // Paginate
      return enriched.slice(
        pagination.offset,
        pagination.offset + pagination.limit,
      );
    });
  }

  /**
   * Count strategies matching filters
   */
  async count(filters: ListStrategiesDto): Promise<number> {
    return this.execute(async () => {
      // Get base count
      const allStrategies = await this.findAll(
        filters,
        { limit: 10000, offset: 0 },
        StrategySortField.TVS,
        "desc",
      );
      return allStrategies.length;
    });
  }

  /**
   * Find strategy by ID
   */
  async findById(strategyId: string): Promise<any | null> {
    return this.execute(async () => {
      const strategy = await this.prisma.strategies.findUnique({
        where: { id: strategyId },
      });

      if (!strategy) return null;

      // Get exchange rate
      const exchangeRate = await this.prisma.strategy_exchange_rates.findUnique(
        {
          where: { strategy_address: strategy.address },
        },
      );

      // Get token metadata (normalize to lowercase for case-insensitive match)
      let tokenMetadata = null;
      if (exchangeRate?.underlying_token) {
        tokenMetadata = await this.prisma.token_metadata.findUnique({
          where: { contract_address: exchangeRate.underlying_token.toLowerCase() },
        });
      }

      // Get aggregated stats
      const stats = await this.prisma.operator_strategy_state.aggregate({
        where: { strategy_id: strategyId },
        _sum: { tvs_usd: true, max_magnitude: true },
        _count: { operator_id: true },
      });

      // Get delegator count
      const delegatorCount = await this.prisma.operator_delegator_shares.count({
        where: { strategy_id: strategyId, shares: { gt: 0 } },
      });

      return {
        ...strategy,
        exchange_rate: exchangeRate,
        token_metadata: tokenMetadata,
        total_tvs_usd: stats._sum.tvs_usd || 0,
        total_shares: stats._sum.max_magnitude || 0,
        operator_count: stats._count.operator_id || 0,
        delegator_count: delegatorCount,
      };
    });
  }

  /**
   * Find strategy by address
   */
  async findByAddress(address: string): Promise<any | null> {
    return this.execute(async () => {
      const strategy = await this.prisma.strategies.findUnique({
        where: { address },
      });
      if (!strategy) return null;
      return this.findById(strategy.id);
    });
  }

  /**
   * Get operators using a strategy
   */
  async findOperatorsByStrategy(
    strategyId: string,
    pagination: { limit: number; offset: number },
  ): Promise<{ operators: any[]; total: number }> {
    return this.execute(async () => {
      const [operators, total] = await Promise.all([
        this.prisma.operator_strategy_state.findMany({
          where: { strategy_id: strategyId },
          include: {
            operators: {
              include: {
                operator_state: true,
                operator_metadata: true,
              },
            },
          },
          orderBy: { tvs_usd: "desc" },
          skip: pagination.offset,
          take: pagination.limit,
        }),
        this.prisma.operator_strategy_state.count({
          where: { strategy_id: strategyId },
        }),
      ]);

      return { operators, total };
    });
  }

  /**
   * Get top delegators for a strategy
   */
  async findDelegatorsByStrategy(
    strategyId: string,
    pagination: { limit: number; offset: number },
  ): Promise<{ delegators: any[]; total: number }> {
    return this.execute(async () => {
      const [delegators, total] = await Promise.all([
        this.prisma.operator_delegator_shares.findMany({
          where: { strategy_id: strategyId, shares: { gt: 0 } },
          include: {
            stakers: true,
            operators: {
              include: { operator_metadata: true },
            },
          },
          orderBy: { shares: "desc" },
          skip: pagination.offset,
          take: pagination.limit,
        }),
        this.prisma.operator_delegator_shares.count({
          where: { strategy_id: strategyId, shares: { gt: 0 } },
        }),
      ]);

      return { delegators, total };
    });
  }

  /**
   * Get price history for a strategy's underlying token
   */
  async getPriceHistory(
    strategyId: string,
    dateFrom: Date,
    dateTo: Date,
  ): Promise<any[]> {
    return this.execute(async () => {
      // Get strategy and exchange rate
      const strategy = await this.prisma.strategies.findUnique({
        where: { id: strategyId },
      });
      if (!strategy) return [];

      const exchangeRate = await this.prisma.strategy_exchange_rates.findUnique(
        {
          where: { strategy_address: strategy.address },
        },
      );
      if (!exchangeRate?.underlying_token) return [];

      // Get price history for underlying token
      return this.prisma.token_price_history.findMany({
        where: {
          token_address: exchangeRate.underlying_token,
          timestamp: {
            gte: dateFrom,
            lte: dateTo,
          },
        },
        orderBy: { timestamp: "asc" },
      });
    });
  }

  /**
   * Get TVS history for a strategy across all operators
   */
  async getTVSHistory(
    strategyId: string,
    dateFrom: Date,
    dateTo: Date,
  ): Promise<any[]> {
    return this.execute(async () => {
      // Aggregate historical TVS snapshots by date
      const snapshots = await this.prisma.historical_tvs_snapshots.groupBy({
        by: ["snapshot_date"],
        where: {
          strategy_id: strategyId,
          snapshot_date: {
            gte: dateFrom,
            lte: dateTo,
          },
        },
        _sum: { tvs_usd: true, shares: true },
        _count: { operator_id: true },
        orderBy: { snapshot_date: "asc" },
      });

      return snapshots.map((s) => ({
        date: s.snapshot_date,
        total_tvs_usd: s._sum.tvs_usd || 0,
        total_shares: s._sum.shares || 0,
        operator_count: s._count.operator_id || 0,
      }));
    });
  }

  /**
   * Get network-wide strategy statistics
   */
  async getNetworkStats(): Promise<any> {
    return this.execute(async () => {
      const [strategyCount, totalTVS, topStrategies] = await Promise.all([
        this.prisma.strategies.count(),
        this.prisma.operator_strategy_state.aggregate({
          _sum: { tvs_usd: true },
        }),
        this.prisma.operator_strategy_state.groupBy({
          by: ["strategy_id"],
          _sum: { tvs_usd: true },
          _count: { operator_id: true },
          orderBy: { _sum: { tvs_usd: "desc" } },
          take: 10,
        }),
      ]);

      // Get strategy details for top strategies
      const strategyIds = topStrategies.map((s) => s.strategy_id);
      const strategies = await this.prisma.strategies.findMany({
        where: { id: { in: strategyIds } },
      });
      const strategyMap = new Map(strategies.map((s) => [s.id, s]));

      return {
        total_strategies: strategyCount,
        total_tvs_usd: totalTVS._sum.tvs_usd || 0,
        top_strategies: topStrategies.map((s) => ({
          strategy_id: s.strategy_id,
          strategy_address: strategyMap.get(s.strategy_id)?.address,
          total_tvs_usd: s._sum.tvs_usd || 0,
          operator_count: s._count.operator_id || 0,
        })),
      };
    });
  }
}
