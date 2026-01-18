import { Injectable } from "@nestjs/common";
import { StrategiesRepository } from "./repositories/strategies.repository";
import { StrategyMapper } from "./mappers/strategy.mapper";
import {
  ListStrategiesDto,
  StrategySortField,
} from "./dto/list-strategies.dto";
import {
  StrategyListItem,
  StrategyDetail,
  StrategyOperatorItem,
  StrategyDelegatorItem,
  PriceHistoryPoint,
  TVSHistoryPoint,
  StrategyNetworkStats,
} from "./entities/strategy.entities";
import { CacheService } from "@/core/cache/cache.service";

@Injectable()
export class StrategiesService {
  constructor(
    private readonly strategiesRepository: StrategiesRepository,
    private readonly strategyMapper: StrategyMapper,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Get all strategies with filtering and pagination
   */
  async findAll(
    filters: ListStrategiesDto,
    pagination: { limit: number; offset: number },
  ): Promise<{ strategies: StrategyListItem[]; total: number }> {
    const cacheKey = `strategies:list:${JSON.stringify(filters)}:${pagination.offset}:${pagination.limit}`;
    const cached = await this.cacheService.get<{
      strategies: StrategyListItem[];
      total: number;
    }>(cacheKey);

    if (cached) return cached;

    const [strategies, total] = await Promise.all([
      this.strategiesRepository.findAll(
        filters,
        pagination,
        filters.sort_by || StrategySortField.TVS,
        filters.sort_order || "desc",
      ),
      this.strategiesRepository.count(filters),
    ]);

    const result = {
      strategies: strategies.map((s) => this.strategyMapper.mapToListItem(s)),
      total,
    };

    await this.cacheService.set(cacheKey, result, 300); // 5 min cache

    return result;
  }

  /**
   * Get strategy by ID
   */
  async findById(strategyId: string): Promise<StrategyDetail> {
    const cacheKey = `strategies:detail:${strategyId}`;
    const cached = await this.cacheService.get<StrategyDetail>(cacheKey);

    if (cached) return cached;

    const strategy = await this.strategiesRepository.findById(strategyId);

    if (!strategy) {
      throw new Error(`Strategy ${strategyId} not found`);
    }

    const result = this.strategyMapper.mapToDetail(strategy);

    await this.cacheService.set(cacheKey, result, 300);

    return result;
  }

  /**
   * Get strategy by address
   */
  async findByAddress(address: string): Promise<StrategyDetail> {
    const strategy = await this.strategiesRepository.findByAddress(address);

    if (!strategy) {
      throw new Error(`Strategy with address ${address} not found`);
    }

    return this.strategyMapper.mapToDetail(strategy);
  }

  /**
   * Get operators using a strategy
   */
  async getOperators(
    strategyId: string,
    pagination: { limit: number; offset: number },
  ): Promise<{ operators: StrategyOperatorItem[]; total: number }> {
    const { operators, total } =
      await this.strategiesRepository.findOperatorsByStrategy(
        strategyId,
        pagination,
      );

    return {
      operators: operators.map((o) => this.strategyMapper.mapToOperatorItem(o)),
      total,
    };
  }

  /**
   * Get delegators for a strategy
   */
  async getDelegators(
    strategyId: string,
    pagination: { limit: number; offset: number },
  ): Promise<{ delegators: StrategyDelegatorItem[]; total: number }> {
    const { delegators, total } =
      await this.strategiesRepository.findDelegatorsByStrategy(
        strategyId,
        pagination,
      );

    // Calculate total shares for percentage
    const totalShares = delegators.reduce(
      (sum, d) => sum + parseFloat(d.shares?.toString() || "0"),
      0,
    );

    return {
      delegators: delegators.map((d) =>
        this.strategyMapper.mapToDelegatorItem(d, totalShares),
      ),
      total,
    };
  }

  /**
   * Get price history for a strategy's underlying token
   */
  async getPriceHistory(
    strategyId: string,
    dateFrom: string,
    dateTo: string,
  ): Promise<PriceHistoryPoint[]> {
    const priceHistory = await this.strategiesRepository.getPriceHistory(
      strategyId,
      new Date(dateFrom),
      new Date(dateTo),
    );

    return this.strategyMapper.mapToPriceHistory(priceHistory);
  }

  /**
   * Get TVS history for a strategy
   */
  async getTVSHistory(
    strategyId: string,
    dateFrom: string,
    dateTo: string,
  ): Promise<TVSHistoryPoint[]> {
    const tvsHistory = await this.strategiesRepository.getTVSHistory(
      strategyId,
      new Date(dateFrom),
      new Date(dateTo),
    );

    return this.strategyMapper.mapToTVSHistory(tvsHistory);
  }

  /**
   * Get network-wide strategy statistics
   */
  async getNetworkStats(): Promise<StrategyNetworkStats> {
    const cacheKey = "strategies:network-stats";
    const cached = await this.cacheService.get<StrategyNetworkStats>(cacheKey);

    if (cached) return cached;

    const stats = await this.strategiesRepository.getNetworkStats();

    // Get details for top strategies
    const strategyDetails = new Map<string, any>();
    for (const s of stats.top_strategies) {
      const detail = await this.strategiesRepository.findById(s.strategy_id);
      if (detail) {
        strategyDetails.set(s.strategy_id, detail);
      }
    }

    const result = this.strategyMapper.mapToNetworkStats(
      stats,
      strategyDetails,
    );

    await this.cacheService.set(cacheKey, result, 600); // 10 min cache

    return result;
  }
}
