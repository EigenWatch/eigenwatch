import { BaseService } from "@/core/common/base.service";
import { OperatorNotFoundException } from "@/shared/errors/app.exceptions";
import { PaginationParams } from "@/shared/types/query.types";
import { Injectable, Inject } from "@nestjs/common";
import { ListOperatorStrategiesDto } from "./dto/list-operator-strategies.dto";
import { ListOperatorsDto } from "./dto/list-operators.dto";
import {
  OperatorActivity,
  OperatorListItem,
  OperatorOverview,
  OperatorStatistics,
} from "./entities/operator.entities";
import {
  OperatorStrategyListItem,
  OperatorStrategyDetail,
} from "./entities/strategy.entities";
import { OperatorMapper } from "./mappers/operator.mapper";
import { PrismaOperatorRepository } from "./repositories/operators.repository";
import { OperatorStrategyRepository } from "./repositories/operator-strategy.repository";
import { OperatorDelegatorRepository } from "./repositories/operator-delegator.repository";
import { OperatorAVSRepository } from "./repositories/operator-avs.repository";
import { OperatorAllocationRepository } from "./repositories/operator-allocation.repository";
import { OperatorAnalyticsRepository } from "./repositories/operator-analytics.repository";
import {
  AVSRelationshipListItem,
  AVSRelationshipDetail,
  AVSRegistrationHistoryItem,
} from "./entities/avs.entities";

import { CacheService } from "@/core/cache/cache.service";

@Injectable()
export class OperatorService extends BaseService<any> {
  constructor(
    private readonly operatorRepository: PrismaOperatorRepository,
    private readonly operatorStrategyRepository: OperatorStrategyRepository,
    private readonly operatorDelegatorRepository: OperatorDelegatorRepository,
    private readonly operatorAVSRepository: OperatorAVSRepository,
    private readonly operatorAllocationRepository: OperatorAllocationRepository,
    private readonly operatorAnalyticsRepository: OperatorAnalyticsRepository,
    private readonly operatorMapper: OperatorMapper,
    private readonly cacheService: CacheService,
  ) {
    super(operatorRepository);
  }

  async findOperators(
    filters: ListOperatorsDto,
    pagination: PaginationParams,
  ): Promise<{ operators: OperatorListItem[]; total: number }> {
    const cacheKey = `operators:list:${JSON.stringify(filters)}:${pagination.limit}:${pagination.offset}`;
    const cached = await this.cacheService.get<{
      operators: OperatorListItem[];
      total: number;
    }>(cacheKey);

    if (cached) {
      return cached;
    }

    const [operators, total] = await Promise.all([
      this.operatorRepository.findMany(filters, pagination),
      this.operatorRepository.count(filters),
    ]);

    const mapped = await Promise.all(
      operators.map((op) => this.operatorMapper.mapToListItem(op)),
    );

    const result = { operators: mapped, total };
    await this.cacheService.set(cacheKey, result, 300); // 5 minutes TTL

    return result;
  }

  async findOperatorById(id: string): Promise<OperatorOverview> {
    const operator = await this.operatorRepository.findById(id);

    if (!operator) {
      throw new OperatorNotFoundException(id);
    }

    return this.operatorMapper.mapToOverview(operator);
  }

  async getOperatorStats(operatorId: string): Promise<OperatorStatistics> {
    const operator =
      await this.operatorRepository.findByIdWithStats(operatorId);

    if (!operator) {
      throw new OperatorNotFoundException(operatorId);
    }

    return await this.operatorMapper.mapToStatistics(operator);
  }

  async findOperatorStrategies(
    operatorId: string,
    filters: ListOperatorStrategiesDto,
  ): Promise<OperatorStrategyListItem[]> {
    const cacheKey = `operators:strategies:${operatorId}:${JSON.stringify(filters)}`;
    const cached =
      await this.cacheService.get<OperatorStrategyListItem[]>(cacheKey);

    if (cached) {
      return cached;
    }

    // Verify operator exists
    const operator = await this.operatorRepository.findById(operatorId);
    if (!operator) {
      throw new OperatorNotFoundException(operatorId);
    }

    const strategies =
      await this.operatorStrategyRepository.findStrategiesByOperator(
        operatorId,
      );

    // Get delegator counts for each strategy
    const strategiesWithCounts = await Promise.all(
      strategies.map(async (strategy) => {
        const delegatorCount =
          await this.operatorStrategyRepository.countDelegatorsByStrategy(
            operatorId,
            strategy.strategy_id,
          );
        return this.operatorMapper.mapToStrategyListItem(
          strategy,
          delegatorCount,
        );
      }),
    );

    // Apply filters
    let filtered = strategiesWithCounts;

    if (filters.min_tvs !== undefined) {
      filtered = filtered.filter(
        (s) => parseFloat(s.max_magnitude) >= filters.min_tvs!,
      );
    }

    if (filters.max_tvs !== undefined) {
      filtered = filtered.filter(
        (s) => parseFloat(s.max_magnitude) <= filters.max_tvs!,
      );
    }

    if (filters.min_utilization !== undefined) {
      filtered = filtered.filter(
        (s) => parseFloat(s.utilization_rate) >= filters.min_utilization!,
      );
    }

    if (filters.max_utilization !== undefined) {
      filtered = filtered.filter(
        (s) => parseFloat(s.utilization_rate) <= filters.max_utilization!,
      );
    }

    // Apply sorting
    switch (filters.sort_by) {
      case "utilization":
        filtered.sort(
          (a, b) =>
            parseFloat(b.utilization_rate) - parseFloat(a.utilization_rate),
        );
        break;
      case "encumbered":
        filtered.sort(
          (a, b) =>
            parseFloat(b.encumbered_magnitude) -
            parseFloat(a.encumbered_magnitude),
        );
        break;
      case "tvs":
      default:
        filtered.sort(
          (a, b) => parseFloat(b.max_magnitude) - parseFloat(a.max_magnitude),
        );
    }

    await this.cacheService.set(cacheKey, filtered, 300); // 5 minutes TTL

    return filtered;
  }

  async getStrategyDetail(
    operatorId: string,
    strategyId: string,
  ): Promise<OperatorStrategyDetail> {
    // Verify operator exists
    const operator = await this.operatorRepository.findById(operatorId);
    if (!operator) {
      throw new OperatorNotFoundException(operatorId);
    }

    // Get strategy state
    const strategy =
      await this.operatorStrategyRepository.findStrategyByOperator(
        operatorId,
        strategyId,
      );

    if (!strategy) {
      throw new Error(
        `Strategy ${strategyId} not found for operator ${operatorId}`,
      );
    }

    // Get allocations
    const allocations =
      await this.operatorAllocationRepository.findAllocationsByOperatorStrategy(
        operatorId,
        strategyId,
      );

    // Get delegators
    const delegators =
      await this.operatorDelegatorRepository.findDelegatorsByOperatorStrategy(
        operatorId,
        strategyId,
      );

    // Calculate total shares
    const totalShares = delegators
      .reduce((sum, d) => sum + parseFloat(d.shares.toString()), 0)
      .toString();

    return this.operatorMapper.mapToStrategyDetail(
      strategy,
      allocations,
      delegators,
      totalShares,
    );
  }

  async getOperatorActivity(
    operatorId: string,
    activityTypes?: string[],
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ activities: OperatorActivity[]; total: number }> {
    // Verify operator exists
    const operator = await this.operatorRepository.findById(operatorId);
    if (!operator) {
      throw new OperatorNotFoundException(operatorId);
    }

    const activities =
      await this.operatorAnalyticsRepository.findOperatorActivities(
        operatorId,
        activityTypes,
        limit,
        offset,
      );

    const mapped = activities.map((activity) =>
      this.operatorMapper.mapToActivity(activity),
    );

    return {
      activities: mapped,
      total: mapped.length,
    };
  }

  async findOperatorAVSRelationships(
    operatorId: string,
    status?: string,
    sortBy?: string,
  ): Promise<AVSRelationshipListItem[]> {
    // Verify operator exists
    const operator = await this.operatorRepository.findById(operatorId);
    if (!operator) {
      throw new OperatorNotFoundException(operatorId);
    }

    const relationships =
      await this.operatorAVSRepository.findOperatorAVSRelationships(
        operatorId,
        status,
      );

    const mapped = relationships.map((rel) =>
      this.operatorMapper.mapToAVSRelationshipListItem(rel),
    );

    // Apply sorting
    switch (sortBy) {
      case "operator_set_count":
        mapped.sort(
          (a, b) => b.active_operator_set_count - a.active_operator_set_count,
        );
        break;
      case "registration_cycles":
        mapped.sort(
          (a, b) => b.total_registration_cycles - a.total_registration_cycles,
        );
        break;
      case "days_registered":
      default:
        mapped.sort(
          (a, b) => b.total_days_registered - a.total_days_registered,
        );
    }

    return mapped;
  }

  async getOperatorAVSDetail(
    operatorId: string,
    avsId: string,
  ): Promise<AVSRelationshipDetail> {
    // Verify operator exists
    const operator = await this.operatorRepository.findById(operatorId);
    if (!operator) {
      throw new OperatorNotFoundException(operatorId);
    }

    const relationship =
      await this.operatorAVSRepository.findOperatorAVSRelationship(
        operatorId,
        avsId,
      );

    if (!relationship) {
      throw new Error(
        `AVS relationship not found for operator ${operatorId} and AVS ${avsId}`,
      );
    }

    const [operatorSets, commissions] = await Promise.all([
      this.operatorAVSRepository.findOperatorSetsForAVS(operatorId, avsId),
      this.operatorAVSRepository.findCommissionsForAVS(operatorId, avsId),
    ]);

    return this.operatorMapper.mapToAVSRelationshipDetail(
      relationship,
      operatorSets,
      commissions,
    );
  }

  async getAVSRegistrationHistory(
    operatorId: string,
    avsId: string,
  ): Promise<AVSRegistrationHistoryItem[]> {
    // Verify operator exists
    const operator = await this.operatorRepository.findById(operatorId);
    if (!operator) {
      throw new OperatorNotFoundException(operatorId);
    }

    const history = await this.operatorAVSRepository.findAVSRegistrationHistory(
      operatorId,
      avsId,
    );

    return this.operatorMapper.mapToAVSRegistrationHistory(history);
  }

  // ============================================================================
  // COMMISSION METHODS (Endpoints 10-11)
  // ============================================================================

  async getCommissionOverview(operatorId: string): Promise<any> {
    // Verify operator exists
    const operator = await this.operatorRepository.findById(operatorId);
    if (!operator) {
      throw new OperatorNotFoundException(operatorId);
    }

    // Fetch commission data and allocations in parallel for impact analysis
    const [commissions, allocationsData] = await Promise.all([
      this.operatorAVSRepository.findCommissionOverview(operatorId),
      this.operatorAllocationRepository.findAllocationsOverviewData(operatorId),
    ]);

    // Add allocations to commission data for impact analysis calculation
    return this.operatorMapper.mapToCommissionOverview({
      ...commissions,
      allocations: allocationsData.allocations,
    });
  }

  async getCommissionHistory(
    operatorId: string,
    filters: {
      commission_type?: string;
      avs_id?: string;
      date_from?: string;
      date_to?: string;
    },
  ): Promise<any> {
    // Verify operator exists
    const operator = await this.operatorRepository.findById(operatorId);
    if (!operator) {
      throw new OperatorNotFoundException(operatorId);
    }

    const parsedFilters = {
      commission_type: filters.commission_type,
      avs_id: filters.avs_id,
      date_from: filters.date_from ? new Date(filters.date_from) : undefined,
      date_to: filters.date_to ? new Date(filters.date_to) : undefined,
    };

    // Validate date range if provided
    if (parsedFilters.date_from && parsedFilters.date_to) {
      this.validateDateRange(parsedFilters.date_from, parsedFilters.date_to);
    }

    const history = await this.operatorAVSRepository.findCommissionHistory(
      operatorId,
      parsedFilters,
    );

    return this.operatorMapper.mapToCommissionHistory(history);
  }

  // ============================================================================
  // DELEGATOR METHODS (Endpoints 12-14)
  // ============================================================================

  async listDelegators(
    operatorId: string,
    filters: {
      status?: string;
      min_shares?: number;
      max_shares?: number;
    },
    pagination: { limit: number; offset: number },
    sortBy: string = "tvs",
    sortOrder: "asc" | "desc" = "desc",
  ): Promise<{ delegators: any[]; summary: any }> {
    const cacheKey = `operators:delegators:${operatorId}:${JSON.stringify(filters)}:${pagination.limit}:${pagination.offset}:${sortBy}:${sortOrder}`;
    const cached = await this.cacheService.get<{
      delegators: any[];
      summary: any;
    }>(cacheKey);

    if (cached) {
      return cached;
    }

    // Verify operator exists
    const operator = await this.operatorRepository.findById(operatorId);
    if (!operator) {
      throw new OperatorNotFoundException(operatorId);
    }

    const [delegators, summary] = await Promise.all([
      this.operatorDelegatorRepository.findDelegators(
        operatorId,
        filters,
        pagination,
        sortBy,
        sortOrder,
      ),
      this.operatorDelegatorRepository.getDelegatorsSummary(operatorId),
    ]);

    // Map delegators with calculated total shares and TVS
    const mapped = await Promise.all(
      delegators.map(async (d: any) => {
        const shares = d.stakers?.operator_delegator_shares || [];
        const totalShares = shares
          .reduce(
            (sum: number, share: any) =>
              sum + parseFloat(share.shares.toString()),
            0,
          )
          .toString();
        const totalTVS = shares.reduce(
          (sum: number, share: any) =>
            // Handle both mapped 'tvs' (if coming from repository 'tvs' calculation) and raw 'tvs_usd'
            sum + parseFloat((share.tvs || share.tvs_usd || 0).toString()),
          0,
        );

        return this.operatorMapper.mapToDelegatorListItem(
          d,
          totalShares,
          totalTVS,
        );
      }),
    );

    const result = {
      delegators: mapped,
      summary,
    };

    await this.cacheService.set(cacheKey, result, 300); // 5 minutes TTL

    return result;
  }

  async getDelegatorDetail(operatorId: string, stakerId: string): Promise<any> {
    // Verify operator exists
    const operator = await this.operatorRepository.findById(operatorId);
    if (!operator) {
      throw new OperatorNotFoundException(operatorId);
    }

    const delegator =
      await this.operatorDelegatorRepository.findDelegatorDetail(
        operatorId,
        stakerId,
      );

    if (!delegator) {
      throw new Error(
        `Delegator ${stakerId} not found for operator ${operatorId}`,
      );
    }

    return this.operatorMapper.mapToDelegatorDetail(delegator);
  }

  async getDelegatorExposure(
    operatorId: string,
    stakerId: string,
  ): Promise<any> {
    // Verify operator exists
    const operator = await this.operatorRepository.findById(operatorId);
    if (!operator) {
      throw new OperatorNotFoundException(operatorId);
    }

    // Fetch delegator data, allocations, and strategy state in parallel
    const [delegator, allocationsData, operatorMetadata] = await Promise.all([
      this.operatorDelegatorRepository.findDelegatorDetail(operatorId, stakerId),
      this.operatorAllocationRepository.findAllocationsOverviewData(operatorId),
      this.operatorRepository.findById(operatorId),
    ]);

    if (!delegator) {
      throw new Error(
        `Delegator ${stakerId} not found for operator ${operatorId}`,
      );
    }

    return this.operatorMapper.mapToDelegatorExposure(
      delegator,
      allocationsData,
      operatorMetadata,
    );
  }

  async getDelegationHistory(
    operatorId: string,
    filters: {
      event_type?: string;
      date_from?: string;
      date_to?: string;
    },
    pagination: { limit: number; offset: number },
  ): Promise<{ events: any[]; total: number }> {
    // Verify operator exists
    const operator = await this.operatorRepository.findById(operatorId);
    if (!operator) {
      throw new OperatorNotFoundException(operatorId);
    }

    const parsedFilters = {
      event_type: filters.event_type,
      date_from: filters.date_from ? new Date(filters.date_from) : undefined,
      date_to: filters.date_to ? new Date(filters.date_to) : undefined,
    };

    // Validate date range if provided
    if (parsedFilters.date_from && parsedFilters.date_to) {
      this.validateDateRange(parsedFilters.date_from, parsedFilters.date_to);
    }

    const [events, total] = await Promise.all([
      this.operatorDelegatorRepository.findDelegationHistory(
        operatorId,
        parsedFilters,
        pagination,
      ),
      this.operatorDelegatorRepository.countDelegationHistory(
        operatorId,
        parsedFilters,
      ),
    ]);

    const mapped = this.operatorMapper.mapToDelegationHistory(events);

    return {
      events: mapped.events,
      total,
    };
  }

  // ============================================================================
  // ALLOCATION METHODS (Endpoints 15-16)
  // ============================================================================

  async getAllocationsOverview(operatorId: string): Promise<any> {
    // Verify operator exists
    const operator = await this.operatorRepository.findById(operatorId);
    if (!operator) {
      throw new OperatorNotFoundException(operatorId);
    }

    // Get comprehensive allocation data
    const data =
      await this.operatorAllocationRepository.findAllocationsOverviewData(
        operatorId,
      );

    return this.operatorMapper.mapToAllocationsOverview(data);
  }

  async listDetailedAllocations(
    operatorId: string,
    filters: {
      avs_id?: string;
      strategy_id?: string;
      min_magnitude?: number;
      max_magnitude?: number;
    },
    pagination: { limit: number; offset: number },
    sortBy: string = "magnitude",
    sortOrder: "asc" | "desc" = "desc",
  ): Promise<{ allocations: any[]; total: number; summary: any }> {
    // Verify operator exists
    const operator = await this.operatorRepository.findById(operatorId);
    if (!operator) {
      throw new OperatorNotFoundException(operatorId);
    }

    // Get allocations and commission rates in parallel
    const [allocations, total, commissionRates] = await Promise.all([
      this.operatorAllocationRepository.findDetailedAllocations(
        operatorId,
        filters,
        pagination,
        sortBy,
        sortOrder,
      ),
      this.operatorAllocationRepository.countDetailedAllocations(
        operatorId,
        filters,
      ),
      this.operatorAVSRepository.findCommissionRates(operatorId),
    ]);

    // Map allocations with commission data
    const mapped = await Promise.all(
      allocations.map((alloc) =>
        this.operatorMapper.mapToDetailedAllocation(alloc, commissionRates),
      ),
    );

    // Calculate summary
    const totalAllocatedUsd = mapped.reduce(
      (sum, a) => sum + parseFloat(a.allocated_usd || "0"),
      0,
    );
    const commissionsWithValues = mapped.filter((a) => a.commission !== null);
    const avgCommissionBips =
      commissionsWithValues.length > 0
        ? commissionsWithValues.reduce(
            (sum, a) => sum + (a.commission?.effective_bips || 0),
            0,
          ) / commissionsWithValues.length
        : 0;

    return {
      allocations: mapped,
      total,
      summary: {
        total_allocated_usd: totalAllocatedUsd.toFixed(2),
        average_commission_bips: Math.round(avgCommissionBips),
      },
    };
  }

  // ============================================================================
  // RISK & ANALYTICS METHODS (Endpoints 17-19)
  // ============================================================================

  async getRiskAssessment(operatorId: string, date?: string): Promise<any> {
    // Verify operator exists
    const operator = await this.operatorRepository.findById(operatorId);
    if (!operator) {
      throw new OperatorNotFoundException(operatorId);
    }

    const parsedDate = date ? new Date(date) : undefined;
    const assessment =
      await this.operatorAnalyticsRepository.findRiskAssessment(
        operatorId,
        parsedDate,
      );

    if (!assessment) {
      throw new Error(
        `No risk assessment found for operator ${operatorId}${date ? ` on ${date}` : ""}`,
      );
    }

    return this.operatorMapper.mapToRiskAssessment(assessment);
  }

  async getConcentrationMetrics(
    operatorId: string,
    concentrationType: string,
    date?: string,
  ): Promise<any> {
    // Verify operator exists
    const operator = await this.operatorRepository.findById(operatorId);
    if (!operator) {
      throw new OperatorNotFoundException(operatorId);
    }

    const parsedDate = date ? new Date(date) : undefined;
    const metrics =
      await this.operatorAnalyticsRepository.findConcentrationMetrics(
        operatorId,
        concentrationType,
        parsedDate,
      );

    return this.operatorMapper.mapToConcentrationMetrics(metrics);
  }

  async getVolatilityMetrics(
    operatorId: string,
    metricType: string,
    date?: string,
  ): Promise<any> {
    // Verify operator exists
    const operator = await this.operatorRepository.findById(operatorId);
    if (!operator) {
      throw new OperatorNotFoundException(operatorId);
    }

    const parsedDate = date ? new Date(date) : undefined;
    const metrics =
      await this.operatorAnalyticsRepository.findVolatilityMetrics(
        operatorId,
        metricType,
        parsedDate,
      );

    return this.operatorMapper.mapToVolatilityMetrics(metrics);
  }

  async getOperatorRiskProfile(
    operatorId: string,
    date?: string,
  ): Promise<any> {
    // Verify operator exists
    const operator = await this.operatorRepository.findById(operatorId);
    if (!operator) {
      throw new OperatorNotFoundException(operatorId);
    }

    const parsedDate = date ? new Date(date) : undefined;
    const profile = await this.operatorAnalyticsRepository.findFullRiskProfile(
      operatorId,
      parsedDate,
    );

    return this.operatorMapper.mapToRiskProfile(profile);
  }

  // ============================================================================
  // TIME SERIES METHODS (Endpoints 20-25)
  // ============================================================================

  async getDailySnapshots(
    operatorId: string,
    dateFrom: string,
    dateTo: string,
  ): Promise<any> {
    const cacheKey = `operators:snapshots:${operatorId}:${dateFrom}:${dateTo}`;
    const cached = await this.cacheService.get<any>(cacheKey);

    if (cached) {
      return cached;
    }

    const operator = await this.operatorRepository.findById(operatorId);
    if (!operator) {
      throw new OperatorNotFoundException(operatorId);
    }

    const parsedDateFrom = new Date(dateFrom);
    const parsedDateTo = new Date(dateTo);

    this.validateDateRange(parsedDateFrom, parsedDateTo);

    const snapshots = await this.operatorAnalyticsRepository.findDailySnapshots(
      operatorId,
      parsedDateFrom,
      parsedDateTo,
    );

    const result = this.operatorMapper.mapToDailySnapshots(snapshots);
    await this.cacheService.set(cacheKey, result, 3600); // 1 hour TTL

    return result;
  }

  async getStrategyTVSHistory(
    operatorId: string,
    strategyId: string,
    dateFrom: string,
    dateTo: string,
  ): Promise<any> {
    const operator = await this.operatorRepository.findById(operatorId);
    if (!operator) {
      throw new OperatorNotFoundException(operatorId);
    }

    const parsedDateFrom = new Date(dateFrom);
    const parsedDateTo = new Date(dateTo);

    this.validateDateRange(parsedDateFrom, parsedDateTo);

    const history =
      await this.operatorStrategyRepository.findStrategyTVSHistory(
        operatorId,
        strategyId,
        parsedDateFrom,
        parsedDateTo,
      );

    if (history.length === 0) {
      throw new Error(
        `No history found for strategy ${strategyId} of operator ${operatorId}`,
      );
    }

    return this.operatorMapper.mapToStrategyTVSHistory(history, history[0]);
  }

  async getDelegatorSharesHistory(
    operatorId: string,
    stakerId: string,
    filters: {
      strategy_id?: string;
      date_from?: string;
      date_to?: string;
    },
  ): Promise<any> {
    const operator = await this.operatorRepository.findById(operatorId);
    if (!operator) {
      throw new OperatorNotFoundException(operatorId);
    }

    const parsedFilters = {
      strategy_id: filters.strategy_id,
      date_from: filters.date_from ? new Date(filters.date_from) : undefined,
      date_to: filters.date_to ? new Date(filters.date_to) : undefined,
    };

    if (parsedFilters.date_from && parsedFilters.date_to) {
      this.validateDateRange(parsedFilters.date_from, parsedFilters.date_to);
    }

    const history =
      await this.operatorDelegatorRepository.findDelegatorSharesHistory(
        operatorId,
        stakerId,
        parsedFilters,
      );

    return this.operatorMapper.mapToDelegatorSharesHistory(history);
  }

  async getAVSRelationshipTimeline(
    operatorId: string,
    avsId: string,
    dateFrom: string,
    dateTo: string,
  ): Promise<any> {
    const operator = await this.operatorRepository.findById(operatorId);
    if (!operator) {
      throw new OperatorNotFoundException(operatorId);
    }

    const parsedDateFrom = new Date(dateFrom);
    const parsedDateTo = new Date(dateTo);

    this.validateDateRange(parsedDateFrom, parsedDateTo);

    const timeline =
      await this.operatorAVSRepository.findAVSRelationshipTimeline(
        operatorId,
        avsId,
        parsedDateFrom,
        parsedDateTo,
      );

    return this.operatorMapper.mapToAVSRelationshipTimeline(timeline);
  }

  async getAllocationHistory(
    operatorId: string,
    filters: {
      operator_set_id?: string;
      strategy_id?: string;
      date_from: string;
      date_to: string;
    },
  ): Promise<any> {
    const operator = await this.operatorRepository.findById(operatorId);
    if (!operator) {
      throw new OperatorNotFoundException(operatorId);
    }

    const parsedDateFrom = new Date(filters.date_from);
    const parsedDateTo = new Date(filters.date_to);

    this.validateDateRange(parsedDateFrom, parsedDateTo);

    const history =
      await this.operatorAllocationRepository.findAllocationHistory(
        operatorId,
        {
          operator_set_id: filters.operator_set_id,
          strategy_id: filters.strategy_id,
          date_from: parsedDateFrom,
          date_to: parsedDateTo,
        },
      );

    return this.operatorMapper.mapToAllocationHistory(history);
  }

  async getSlashingIncidents(operatorId: string): Promise<any> {
    const operator = await this.operatorRepository.findById(operatorId);
    if (!operator) {
      throw new OperatorNotFoundException(operatorId);
    }

    const incidents =
      await this.operatorAnalyticsRepository.findSlashingIncidents(operatorId);

    return this.operatorMapper.mapToSlashingIncidents(incidents);
  }

  // ============================================================================
  // COMPARISON METHODS (Endpoints 26-28)
  // ============================================================================

  async compareOperators(dto: {
    operator_ids: string[];
    metrics?: string[];
  }): Promise<any> {
    // Validate we have 2-5 operators
    if (dto.operator_ids.length < 2 || dto.operator_ids.length > 5) {
      throw new Error("Must compare between 2 and 5 operators");
    }

    // Check for duplicates
    const uniqueIds = new Set(dto.operator_ids);
    if (uniqueIds.size !== dto.operator_ids.length) {
      throw new Error("Duplicate operator IDs are not allowed");
    }

    const operators =
      await this.operatorAnalyticsRepository.findOperatorsForComparison(
        dto.operator_ids,
      );

    // Verify all operators were found
    if (operators.length !== dto.operator_ids.length) {
      const foundIds = operators.map((op) => op.id);
      const missingIds = dto.operator_ids.filter(
        (id) => !foundIds.includes(id),
      );
      throw new Error(`Operators not found: ${missingIds.join(", ")}`);
    }

    return this.operatorMapper.mapToOperatorsComparison(operators, dto.metrics);
  }

  async getOperatorRankings(operatorId: string, date?: string): Promise<any> {
    const operator = await this.operatorRepository.findById(operatorId);
    if (!operator) {
      throw new OperatorNotFoundException(operatorId);
    }

    const parsedDate = date ? new Date(date) : undefined;

    const data =
      await this.operatorAnalyticsRepository.calculateOperatorPercentiles(
        operatorId,
        parsedDate,
      );

    if (!data) {
      throw new Error(`No ranking data available for operator ${operatorId}`);
    }

    return this.operatorMapper.mapToOperatorRankings(data);
  }

  async compareOperatorToNetwork(
    operatorId: string,
    date?: string,
  ): Promise<any> {
    const operator = await this.operatorRepository.findById(operatorId);
    if (!operator) {
      throw new OperatorNotFoundException(operatorId);
    }

    const parsedDate = date ? new Date(date) : undefined;

    const [operatorData, networkAvg] = await Promise.all([
      this.operatorRepository.findById(operatorId),
      this.operatorAnalyticsRepository.getNetworkAverages(parsedDate),
    ]);

    if (!networkAvg) {
      throw new Error("Network averages not available");
    }

    return this.operatorMapper.mapToNetworkComparison(operatorData, networkAvg);
  }
}
