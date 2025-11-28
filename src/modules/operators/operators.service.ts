/* eslint-disable @typescript-eslint/no-explicit-any */
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
import {
  AVSRelationshipListItem,
  AVSRelationshipDetail,
  AVSRegistrationHistoryItem,
} from "./entities/avs.entities";

@Injectable()
export class OperatorService extends BaseService<any> {
  constructor(
    @Inject("OperatorRepository")
    private operatorRepository: PrismaOperatorRepository,
    private operatorMapper: OperatorMapper
  ) {
    super(operatorRepository);
  }

  async findOperators(
    filters: ListOperatorsDto,
    pagination: PaginationParams
  ): Promise<{ operators: OperatorListItem[]; total: number }> {
    const [operators, total] = await Promise.all([
      this.operatorRepository.findMany(filters, pagination),
      this.operatorRepository.count(filters),
    ]);

    const mapped = await Promise.all(
      operators.map((op) => this.operatorMapper.mapToListItem(op))
    );

    return { operators: mapped, total };
  }

  async findOperatorById(id: string): Promise<OperatorOverview> {
    const operator = await this.operatorRepository.findById(id);

    if (!operator) {
      throw new OperatorNotFoundException(id);
    }

    return this.operatorMapper.mapToOverview(operator);
  }

  async getOperatorStats(operatorId: string): Promise<OperatorStatistics> {
    const operator = await this.operatorRepository.findById(operatorId);

    if (!operator) {
      throw new OperatorNotFoundException(operatorId);
    }

    return this.operatorMapper.mapToStatistics(operator);
  }

  async findOperatorStrategies(
    operatorId: string,
    filters: ListOperatorStrategiesDto
  ): Promise<OperatorStrategyListItem[]> {
    // Verify operator exists
    const operator = await this.operatorRepository.findById(operatorId);
    if (!operator) {
      throw new OperatorNotFoundException(operatorId);
    }

    const strategies =
      await this.operatorRepository.findStrategiesByOperator(operatorId);

    // Get delegator counts for each strategy
    const strategiesWithCounts = await Promise.all(
      strategies.map(async (strategy) => {
        const count = await this.operatorRepository.countDelegatorsByStrategy(
          operatorId,
          strategy.strategy_id
        );
        return this.operatorMapper.mapToStrategyListItem(strategy, count);
      })
    );

    // Apply filters
    let filtered = strategiesWithCounts;

    if (filters.min_tvs !== undefined) {
      filtered = filtered.filter(
        (s) => parseFloat(s.max_magnitude) >= filters.min_tvs!
      );
    }

    if (filters.max_tvs !== undefined) {
      filtered = filtered.filter(
        (s) => parseFloat(s.max_magnitude) <= filters.max_tvs!
      );
    }

    if (filters.min_utilization !== undefined) {
      filtered = filtered.filter(
        (s) => parseFloat(s.utilization_rate) >= filters.min_utilization!
      );
    }

    if (filters.max_utilization !== undefined) {
      filtered = filtered.filter(
        (s) => parseFloat(s.utilization_rate) <= filters.max_utilization!
      );
    }

    // Apply sorting
    switch (filters.sort_by) {
      case "utilization":
        filtered.sort(
          (a, b) =>
            parseFloat(b.utilization_rate) - parseFloat(a.utilization_rate)
        );
        break;
      case "encumbered":
        filtered.sort(
          (a, b) =>
            parseFloat(b.encumbered_magnitude) -
            parseFloat(a.encumbered_magnitude)
        );
        break;
      case "tvs":
      default:
        filtered.sort(
          (a, b) => parseFloat(b.max_magnitude) - parseFloat(a.max_magnitude)
        );
    }

    return filtered;
  }

  async getStrategyDetail(
    operatorId: string,
    strategyId: string
  ): Promise<OperatorStrategyDetail> {
    // Verify operator exists
    const operator = await this.operatorRepository.findById(operatorId);
    if (!operator) {
      throw new OperatorNotFoundException(operatorId);
    }

    // Get strategy state
    const strategyState = await this.operatorRepository.findStrategyByOperator(
      operatorId,
      strategyId
    );

    if (!strategyState) {
      throw new Error(
        `Strategy ${strategyId} not found for operator ${operatorId}`
      );
    }

    // Get allocations
    const allocations =
      await this.operatorRepository.findAllocationsByOperatorStrategy(
        operatorId,
        strategyId
      );

    // Get delegators
    const delegators =
      await this.operatorRepository.findDelegatorsByOperatorStrategy(
        operatorId,
        strategyId
      );

    // Calculate total shares
    const totalShares = delegators
      .reduce((sum, d) => sum + parseFloat(d.shares.toString()), 0)
      .toString();

    return this.operatorMapper.mapToStrategyDetail(
      strategyState,
      allocations,
      delegators,
      totalShares
    );
  }

  async getOperatorActivity(
    operatorId: string,
    activityTypes?: string[],
    limit: number = 50,
    offset: number = 0
  ): Promise<{ activities: OperatorActivity[]; total: number }> {
    // Verify operator exists
    const operator = await this.operatorRepository.findById(operatorId);
    if (!operator) {
      throw new OperatorNotFoundException(operatorId);
    }

    const activities = await this.operatorRepository.findOperatorActivities(
      operatorId,
      activityTypes,
      limit,
      offset
    );

    const mapped = activities.map((activity) =>
      this.operatorMapper.mapToActivity(activity)
    );

    return {
      activities: mapped,
      total: mapped.length,
    };
  }

  async findOperatorAVSRelationships(
    operatorId: string,
    status?: string,
    sortBy?: string
  ): Promise<AVSRelationshipListItem[]> {
    // Verify operator exists
    const operator = await this.operatorRepository.findById(operatorId);
    if (!operator) {
      throw new OperatorNotFoundException(operatorId);
    }

    const relationships =
      await this.operatorRepository.findOperatorAVSRelationships(
        operatorId,
        status
      );

    const mapped = relationships.map((rel) =>
      this.operatorMapper.mapToAVSRelationshipListItem(rel)
    );

    // Apply sorting
    switch (sortBy) {
      case "operator_set_count":
        mapped.sort(
          (a, b) => b.active_operator_set_count - a.active_operator_set_count
        );
        break;
      case "registration_cycles":
        mapped.sort(
          (a, b) => b.total_registration_cycles - a.total_registration_cycles
        );
        break;
      case "days_registered":
      default:
        mapped.sort(
          (a, b) => b.total_days_registered - a.total_days_registered
        );
    }

    return mapped;
  }

  async getOperatorAVSDetail(
    operatorId: string,
    avsId: string
  ): Promise<AVSRelationshipDetail> {
    // Verify operator exists
    const operator = await this.operatorRepository.findById(operatorId);
    if (!operator) {
      throw new OperatorNotFoundException(operatorId);
    }

    const relationship =
      await this.operatorRepository.findOperatorAVSRelationship(
        operatorId,
        avsId
      );

    if (!relationship) {
      throw new Error(
        `AVS relationship not found for operator ${operatorId} and AVS ${avsId}`
      );
    }

    const [operatorSets, commissions] = await Promise.all([
      this.operatorRepository.findOperatorSetsForAVS(operatorId, avsId),
      this.operatorRepository.findCommissionsForAVS(operatorId, avsId),
    ]);

    return this.operatorMapper.mapToAVSRelationshipDetail(
      relationship,
      operatorSets,
      commissions
    );
  }

  async getAVSRegistrationHistory(
    operatorId: string,
    avsId: string
  ): Promise<AVSRegistrationHistoryItem[]> {
    // Verify operator exists
    const operator = await this.operatorRepository.findById(operatorId);
    if (!operator) {
      throw new OperatorNotFoundException(operatorId);
    }

    const history = await this.operatorRepository.findAVSRegistrationHistory(
      operatorId,
      avsId
    );

    return this.operatorMapper.mapToAVSRegistrationHistory(history);
  }
}
