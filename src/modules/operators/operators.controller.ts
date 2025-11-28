/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Controller,
  Get,
  Param,
  Query,
  HttpStatus,
  Logger,
  Body,
  Post,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiSecurity,
} from "@nestjs/swagger";
import { ListOperatorStrategiesDto } from "./dto/list-operator-strategies.dto";
import { BaseController } from "@/core/common/base.controller";
import { PaginationHelper } from "@/core/common/pagination.helper";
import { ResponseHelper } from "@/core/responses/response.helper";
import { OperatorService } from "./operators.service";
import { Public } from "@/core/decorators/public.decorator";
import { FindOperatorsQueryDto } from "./dto/index.dto";
import { GetActivityDto } from "./dto/activity.dto";
import { ListOperatorAVSDto } from "./dto/avs.dto";
import { ListDetailedAllocationsDto } from "./dto/allocation.dto";
import { GetCommissionHistoryDto } from "./dto/commission.dto";
import {
  ListDelegatorsDto,
  GetDelegationHistoryDto,
} from "./dto/delegator.dto";
import {
  GetRiskAssessmentDto,
  GetConcentrationMetricsDto,
  GetVolatilityMetricsDto,
} from "./dto/risk.dto";
import {
  CompareOperatorsDto,
  GetRankingsDto,
  CompareToNetworkDto,
} from "./dto/comparison.dto";
import {
  GetDailySnapshotsDto,
  GetStrategyTVSHistoryDto,
  GetDelegatorSharesHistoryDto,
  GetAVSTimelineDto,
  GetAllocationHistoryDto,
} from "./dto/time-series.dto";

@ApiTags("Operators")
@Controller("operators")
export class OperatorsController extends BaseController<any> {
  private readonly logger = new Logger(OperatorsController.name);

  constructor(private operatorService: OperatorService) {
    super(operatorService);
  }

  // ============================================================================
  // ENDPOINT 1: List Operators
  // ============================================================================
  @Get()
  @Public()
  @ApiSecurity("api-key")
  @ApiOperation({
    summary: "Get all operators with filters and pagination",
    description:
      "Primary endpoint for the operators listing/discovery page with flexible filtering and sorting",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Successfully retrieved operators list",
  })
  async findAll(@Query() query: FindOperatorsQueryDto) {
    const paginationParams = this.handlePagination(query);

    this.logger.debug(`Paginated Params: ${JSON.stringify(paginationParams)}`);

    const { operators, total } = await this.operatorService.findOperators(
      query,
      paginationParams
    );

    const paginationMeta = PaginationHelper.buildMeta(
      total,
      paginationParams.limit,
      paginationParams.offset
    );

    return ResponseHelper.paginated(
      operators,
      paginationMeta,
      "Operators retrieved successfully"
    );
  }

  // ============================================================================
  // ENDPOINT 2: Get Operator Overview
  // ============================================================================
  @Get(":id")
  @Public()
  @ApiSecurity("api-key")
  @ApiOperation({
    summary: "Get operator overview",
    description:
      "Complete overview for a single operator's profile page including metadata, status, and performance summary",
  })
  @ApiParam({ name: "id", description: "Operator ID" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Successfully retrieved operator overview",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Operator not found",
  })
  async findOne(@Param("id") id: string) {
    const overview = await this.operatorService.findOperatorById(id);
    return ResponseHelper.ok(
      overview,
      "Operator overview retrieved successfully"
    );
  }

  // ============================================================================
  // ENDPOINT 3: Get Operator Statistics
  // ============================================================================
  @Get(":id/stats")
  @Public()
  @ApiSecurity("api-key")
  @ApiOperation({
    summary: "Get operator statistics",
    description:
      "Current numerical statistics for the operator including TVS, delegation, AVS participation, and commission",
  })
  @ApiParam({ name: "id", description: "Operator ID" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Successfully retrieved operator statistics",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Operator not found",
  })
  async getStats(@Param("id") id: string) {
    const stats = await this.operatorService.getOperatorStats(id);
    return ResponseHelper.ok(
      stats,
      "Operator statistics retrieved successfully"
    );
  }

  // ============================================================================
  // ENDPOINT 4: Get Operator Activity Timeline
  // ============================================================================
  @Get(":id/activity")
  @Public()
  @ApiSecurity("api-key")
  @ApiOperation({
    summary: "Get operator activity timeline",
    description:
      "Recent activity events for the operator (registration, delegation, allocation, commission, metadata, slashing)",
  })
  @ApiParam({ name: "id", description: "Operator ID" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Successfully retrieved operator activity",
  })
  async getActivity(@Param("id") id: string, @Query() query: GetActivityDto) {
    const { activities, total } =
      await this.operatorService.getOperatorActivity(
        id,
        query.activity_types,
        query.limit,
        query.offset
      );

    const paginationMeta = PaginationHelper.buildMeta(
      total,
      query.limit || 50,
      query.offset || 0
    );

    return ResponseHelper.paginated(
      activities,
      paginationMeta,
      "Activity timeline retrieved successfully"
    );
  }

  // ============================================================================
  // ENDPOINT 5: List Operator Strategies
  // ============================================================================
  @Get(":id/strategies")
  @Public()
  @ApiSecurity("api-key")
  @ApiOperation({
    summary: "List operator strategies",
    description:
      "All strategies the operator has TVS for, with utilization rates and delegator counts",
  })
  @ApiParam({ name: "id", description: "Operator ID" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Successfully retrieved operator strategies",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Operator not found",
  })
  async getStrategies(
    @Param("id") id: string,
    @Query() filters: ListOperatorStrategiesDto
  ) {
    const strategies = await this.operatorService.findOperatorStrategies(
      id,
      filters
    );
    return ResponseHelper.ok(
      { strategies },
      "Operator strategies retrieved successfully"
    );
  }

  // ============================================================================
  // ENDPOINT 6: Get Strategy Detail for Operator
  // ============================================================================
  @Get(":id/strategies/:strategyId")
  @Public()
  @ApiSecurity("api-key")
  @ApiOperation({
    summary: "Get strategy detail for operator",
    description:
      "Detailed view of a specific strategy for an operator including allocations and top delegators",
  })
  @ApiParam({ name: "id", description: "Operator ID" })
  @ApiParam({ name: "strategyId", description: "Strategy ID" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Successfully retrieved strategy detail",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Operator or strategy not found",
  })
  async getStrategyDetail(
    @Param("id") id: string,
    @Param("strategyId") strategyId: string
  ) {
    const detail = await this.operatorService.getStrategyDetail(id, strategyId);
    return ResponseHelper.ok(detail, "Strategy detail retrieved successfully");
  }

  // ============================================================================
  // ENDPOINT 7: List Operator AVS Registrations
  // ============================================================================
  @Get(":id/avs")
  @Public()
  @ApiSecurity("api-key")
  @ApiOperation({
    summary: "List operator AVS registrations",
    description:
      "All AVSs the operator is or was registered with, including registration cycles and status",
  })
  @ApiParam({ name: "id", description: "Operator ID" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Successfully retrieved AVS registrations",
  })
  async getAVSRegistrations(
    @Param("id") id: string,
    @Query() query: ListOperatorAVSDto
  ) {
    const relationships =
      await this.operatorService.findOperatorAVSRelationships(
        id,
        query.status,
        query.sort_by
      );

    return ResponseHelper.ok(
      { avs_relationships: relationships },
      "AVS registrations retrieved successfully"
    );
  }

  // ============================================================================
  // ENDPOINT 8: Get Operator-AVS Detail
  // ============================================================================
  @Get(":id/avs/:avsId")
  @Public()
  @ApiSecurity("api-key")
  @ApiOperation({
    summary: "Get operator-AVS detail",
    description:
      "Detailed view of operator's relationship with a specific AVS including operator sets and commission",
  })
  @ApiParam({ name: "id", description: "Operator ID" })
  @ApiParam({ name: "avsId", description: "AVS ID" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Successfully retrieved operator-AVS detail",
  })
  async getAVSDetail(@Param("id") id: string, @Param("avsId") avsId: string) {
    const detail = await this.operatorService.getOperatorAVSDetail(id, avsId);
    return ResponseHelper.ok(
      detail,
      "Operator-AVS detail retrieved successfully"
    );
  }

  // ============================================================================
  // ENDPOINT 9: Get Operator AVS Registration History
  // ============================================================================
  @Get(":id/avs/:avsId/history")
  @Public()
  @ApiSecurity("api-key")
  @ApiOperation({
    summary: "Get operator AVS registration history",
    description:
      "Timeline of registration/unregistration events for an operator with a specific AVS",
  })
  @ApiParam({ name: "id", description: "Operator ID" })
  @ApiParam({ name: "avsId", description: "AVS ID" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Successfully retrieved registration history",
  })
  async getAVSRegistrationHistory(
    @Param("id") id: string,
    @Param("avsId") avsId: string
  ) {
    const history = await this.operatorService.getAVSRegistrationHistory(
      id,
      avsId
    );
    return ResponseHelper.ok(
      { history },
      "AVS registration history retrieved successfully"
    );
  }

  // ============================================================================
  // COMMISSION & ECONOMICS ENDPOINTS (10-11)
  // ============================================================================

  /**
   * Endpoint 10: Get Operator Commission Overview
   */
  @Get(":id/commission")
  @Public()
  @ApiSecurity("api-key")
  @ApiOperation({
    summary: "Get operator commission overview",
    description:
      "All commission rates for the operator including PI, AVS, and operator set commissions",
  })
  @ApiParam({ name: "id", description: "Operator ID" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Successfully retrieved commission overview",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Operator not found",
  })
  async getCommissionOverview(@Param("id") id: string) {
    const overview = await this.operatorService.getCommissionOverview(id);
    return ResponseHelper.ok(
      overview,
      "Commission overview retrieved successfully"
    );
  }

  /**
   * Endpoint 11: Get Commission History
   */
  @Get(":id/commission/history")
  @Public()
  @ApiSecurity("api-key")
  @ApiOperation({
    summary: "Get commission history",
    description: "Historical commission changes for the operator",
  })
  @ApiParam({ name: "id", description: "Operator ID" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Successfully retrieved commission history",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Operator not found",
  })
  async getCommissionHistory(
    @Param("id") id: string,
    @Query() query: GetCommissionHistoryDto
  ) {
    const history = await this.operatorService.getCommissionHistory(id, query);
    return ResponseHelper.ok(
      history,
      "Commission history retrieved successfully"
    );
  }

  // ============================================================================
  // DELEGATION & STAKER ENDPOINTS (12-14)
  // ============================================================================

  /**
   * Endpoint 12: List Operator Delegators
   */
  @Get(":id/delegators")
  @Public()
  @ApiSecurity("api-key")
  @ApiOperation({
    summary: "List operator delegators",
    description:
      "All delegators for an operator with filtering, sorting, and pagination",
  })
  @ApiParam({ name: "id", description: "Operator ID" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Successfully retrieved delegators",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Operator not found",
  })
  async listDelegators(
    @Param("id") id: string,
    @Query() query: ListDelegatorsDto
  ) {
    const paginationParams = this.handlePagination(query);

    const result = await this.operatorService.listDelegators(
      id,
      {
        status: query.status,
        min_shares: query.min_shares,
        max_shares: query.max_shares,
      },
      paginationParams,
      query.sort_by,
      query.sort_order
    );

    // TODO: Investigate this
    // We don't have accurate total count due to filtering, so we'll use delegators length
    const paginationMeta = PaginationHelper.buildMeta(
      result.summary.total_delegators,
      paginationParams.limit,
      paginationParams.offset
    );

    return ResponseHelper.ok(
      {
        delegators: result.delegators,
        summary: result.summary,
        pagination: paginationMeta,
      },
      "Delegators retrieved successfully"
    );
  }

  /**
   * Endpoint 13: Get Delegator Detail
   */
  @Get(":id/delegators/:stakerId")
  @Public()
  @ApiSecurity("api-key")
  @ApiOperation({
    summary: "Get delegator detail",
    description:
      "Detailed view of a specific delegator's relationship with the operator",
  })
  @ApiParam({ name: "id", description: "Operator ID" })
  @ApiParam({ name: "stakerId", description: "Staker ID" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Successfully retrieved delegator detail",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Operator or delegator not found",
  })
  async getDelegatorDetail(
    @Param("id") id: string,
    @Param("stakerId") stakerId: string
  ) {
    // TODO: Investigate this endpoint
    const detail = await this.operatorService.getDelegatorDetail(id, stakerId);
    return ResponseHelper.ok(detail, "Delegator detail retrieved successfully");
  }

  /**
   * Endpoint 14: Get Delegation History
   */
  @Get(":id/delegators/history")
  @Public()
  @ApiSecurity("api-key")
  @ApiOperation({
    summary: "Get delegation history",
    description: "Historical delegation/undelegation events for the operator",
  })
  @ApiParam({ name: "id", description: "Operator ID" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Successfully retrieved delegation history",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Operator not found",
  })
  async getDelegationHistory(
    @Param("id") id: string,
    @Query() query: GetDelegationHistoryDto
  ) {
    const paginationParams = this.handlePagination(query);

    const { events, total } = await this.operatorService.getDelegationHistory(
      id,
      {
        event_type: query.event_type,
        date_from: query.date_from,
        date_to: query.date_to,
      },
      paginationParams
    );

    const paginationMeta = PaginationHelper.buildMeta(
      total,
      paginationParams.limit,
      paginationParams.offset
    );

    return ResponseHelper.paginated(
      events,
      paginationMeta,
      "Delegation history retrieved successfully"
    );
  }

  // ============================================================================
  // ALLOCATION ENDPOINTS (15-16)
  // ============================================================================

  /**
   * Endpoint 15: Get Operator Allocations Overview
   */
  @Get(":id/allocations")
  @Public()
  @ApiSecurity("api-key")
  @ApiOperation({
    summary: "Get operator allocations overview",
    description:
      "Summary of all allocations grouped by AVS and strategy with utilization metrics",
  })
  @ApiParam({ name: "id", description: "Operator ID" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Successfully retrieved allocations overview",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Operator not found",
  })
  async getAllocationsOverview(@Param("id") id: string) {
    const overview = await this.operatorService.getAllocationsOverview(id);
    return ResponseHelper.ok(
      overview,
      "Allocations overview retrieved successfully"
    );
  }

  /**
   * Endpoint 16: List Detailed Allocations
   */
  @Get(":id/allocations/detailed")
  @Public()
  @ApiSecurity("api-key")
  @ApiOperation({
    summary: "List detailed allocations",
    description:
      "Granular allocation records with filtering, sorting, and pagination",
  })
  @ApiParam({ name: "id", description: "Operator ID" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Successfully retrieved detailed allocations",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Operator not found",
  })
  async listDetailedAllocations(
    @Param("id") id: string,
    @Query() query: ListDetailedAllocationsDto
  ) {
    const paginationParams = this.handlePagination(query);

    const { allocations, total } =
      await this.operatorService.listDetailedAllocations(
        id,
        {
          avs_id: query.avs_id,
          strategy_id: query.strategy_id,
          min_magnitude: query.min_magnitude,
          max_magnitude: query.max_magnitude,
        },
        paginationParams,
        query.sort_by,
        query.sort_order
      );

    const paginationMeta = PaginationHelper.buildMeta(
      total,
      paginationParams.limit,
      paginationParams.offset
    );

    return ResponseHelper.paginated(
      allocations,
      paginationMeta,
      "Detailed allocations retrieved successfully"
    );
  }

  // ============================================================================
  // RISK & ANALYTICS ENDPOINTS (17-19)
  // ============================================================================

  /**
   * Endpoint 17: Get Operator Risk Assessment
   */
  @Get(":id/risk")
  @Public()
  @ApiSecurity("api-key")
  @ApiOperation({
    summary: "Get operator risk assessment",
    description:
      "Current risk metrics and scores including component breakdowns and key metrics",
  })
  @ApiParam({ name: "id", description: "Operator ID" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Successfully retrieved risk assessment",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Operator not found or no risk assessment available",
  })
  async getRiskAssessment(
    @Param("id") id: string,
    @Query() query: GetRiskAssessmentDto
  ) {
    const assessment = await this.operatorService.getRiskAssessment(
      id,
      query.date
    );
    return ResponseHelper.ok(
      assessment,
      "Risk assessment retrieved successfully"
    );
  }

  /**
   * Endpoint 18: Get Concentration Metrics
   */
  @Get(":id/concentration")
  @Public()
  @ApiSecurity("api-key")
  @ApiOperation({
    summary: "Get concentration metrics",
    description:
      "Delegation and allocation concentration metrics including HHI, Gini coefficient, and distribution percentiles",
  })
  @ApiParam({ name: "id", description: "Operator ID" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Successfully retrieved concentration metrics",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Operator not found",
  })
  async getConcentrationMetrics(
    @Param("id") id: string,
    @Query() query: GetConcentrationMetricsDto
  ) {
    const metrics = await this.operatorService.getConcentrationMetrics(
      id,
      query.concentration_type || "delegation",
      query.date
    );
    return ResponseHelper.ok(
      metrics,
      "Concentration metrics retrieved successfully"
    );
  }

  /**
   * Endpoint 19: Get Volatility Metrics
   */
  @Get(":id/volatility")
  @Public()
  @ApiSecurity("api-key")
  @ApiOperation({
    summary: "Get volatility metrics",
    description:
      "Volatility measures for operator metrics including 7d, 30d, 90d volatility and trend analysis",
  })
  @ApiParam({ name: "id", description: "Operator ID" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Successfully retrieved volatility metrics",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Operator not found",
  })
  async getVolatilityMetrics(
    @Param("id") id: string,
    @Query() query: GetVolatilityMetricsDto
  ) {
    const metrics = await this.operatorService.getVolatilityMetrics(
      id,
      query.metric_type || "tvs",
      query.date
    );
    return ResponseHelper.ok(
      metrics,
      "Volatility metrics retrieved successfully"
    );
  }

  // ============================================================================
  // TIME SERIES & HISTORICAL ENDPOINTS (20-25)
  // ============================================================================

  /**
   * Endpoint 20: Get Operator Daily Snapshots
   */
  @Get(":id/snapshots/daily")
  @Public()
  @ApiSecurity("api-key")
  @ApiOperation({
    summary: "Get operator daily snapshots",
    description:
      "Daily snapshot time series for the operator showing key metrics over time",
  })
  @ApiParam({ name: "id", description: "Operator ID" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Successfully retrieved daily snapshots",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Operator not found",
  })
  async getDailySnapshots(
    @Param("id") id: string,
    @Query() query: GetDailySnapshotsDto
  ) {
    const snapshots = await this.operatorService.getDailySnapshots(
      id,
      query.date_from,
      query.date_to
    );
    return ResponseHelper.ok(
      snapshots,
      "Daily snapshots retrieved successfully"
    );
  }

  /**
   * Endpoint 21: Get Strategy TVS History
   */
  @Get(":id/strategies/:strategyId/history")
  @Public()
  @ApiSecurity("api-key")
  @ApiOperation({
    summary: "Get strategy TVS history",
    description:
      "TVS changes over time for a specific strategy including utilization rates",
  })
  @ApiParam({ name: "id", description: "Operator ID" })
  @ApiParam({ name: "strategyId", description: "Strategy ID" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Successfully retrieved strategy TVS history",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Operator or strategy not found",
  })
  async getStrategyTVSHistory(
    @Param("id") id: string,
    @Param("strategyId") strategyId: string,
    @Query() query: GetStrategyTVSHistoryDto
  ) {
    const history = await this.operatorService.getStrategyTVSHistory(
      id,
      strategyId,
      query.date_from,
      query.date_to
    );
    return ResponseHelper.ok(
      history,
      "Strategy TVS history retrieved successfully"
    );
  }

  /**
   * Endpoint 22: Get Delegator Shares History
   */
  @Get(":id/delegators/:stakerId/shares/history")
  @Public()
  @ApiSecurity("api-key")
  @ApiOperation({
    summary: "Get delegator shares history",
    description:
      "Historical shares for a delegator across strategies over time",
  })
  @ApiParam({ name: "id", description: "Operator ID" })
  @ApiParam({ name: "stakerId", description: "Staker ID" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Successfully retrieved delegator shares history",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Operator or delegator not found",
  })
  async getDelegatorSharesHistory(
    @Param("id") id: string,
    @Param("stakerId") stakerId: string,
    @Query() query: GetDelegatorSharesHistoryDto
  ) {
    const history = await this.operatorService.getDelegatorSharesHistory(
      id,
      stakerId,
      query
    );
    return ResponseHelper.ok(
      history,
      "Delegator shares history retrieved successfully"
    );
  }

  /**
   * Endpoint 23: Get AVS Relationship Timeline
   */
  @Get(":id/avs/:avsId/timeline")
  @Public()
  @ApiSecurity("api-key")
  @ApiOperation({
    summary: "Get AVS relationship timeline",
    description:
      "Daily snapshots of operator-AVS relationship showing registration status over time",
  })
  @ApiParam({ name: "id", description: "Operator ID" })
  @ApiParam({ name: "avsId", description: "AVS ID" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Successfully retrieved AVS relationship timeline",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Operator or AVS not found",
  })
  async getAVSRelationshipTimeline(
    @Param("id") id: string,
    @Param("avsId") avsId: string,
    @Query() query: GetAVSTimelineDto
  ) {
    const timeline = await this.operatorService.getAVSRelationshipTimeline(
      id,
      avsId,
      query.date_from,
      query.date_to
    );
    return ResponseHelper.ok(
      timeline,
      "AVS relationship timeline retrieved successfully"
    );
  }

  /**
   * Endpoint 24: Get Allocation History
   */
  @Get(":id/allocations/history")
  @Public()
  @ApiSecurity("api-key")
  @ApiOperation({
    summary: "Get allocation history",
    description:
      "Time series of allocation snapshots showing magnitude changes over time",
  })
  @ApiParam({ name: "id", description: "Operator ID" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Successfully retrieved allocation history",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Operator not found",
  })
  async getAllocationHistory(
    @Param("id") id: string,
    @Query() query: GetAllocationHistoryDto
  ) {
    const history = await this.operatorService.getAllocationHistory(id, query);
    return ResponseHelper.ok(
      history,
      "Allocation history retrieved successfully"
    );
  }

  /**
   * Endpoint 25: Get Slashing Incidents
   */
  @Get(":id/slashing")
  @Public()
  @ApiSecurity("api-key")
  @ApiOperation({
    summary: "Get slashing incidents",
    description:
      "All slashing incidents for the operator with amounts by strategy",
  })
  @ApiParam({ name: "id", description: "Operator ID" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Successfully retrieved slashing incidents",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Operator not found",
  })
  async getSlashingIncidents(@Param("id") id: string) {
    const incidents = await this.operatorService.getSlashingIncidents(id);
    return ResponseHelper.ok(
      incidents,
      "Slashing incidents retrieved successfully"
    );
  }

  // ============================================================================
  // COMPARISON & BENCHMARK ENDPOINTS (26-28)
  // ============================================================================

  /**
   * Endpoint 26: Compare Operators
   */
  @Post("compare")
  @Public()
  @ApiSecurity("api-key")
  @ApiOperation({
    summary: "Compare operators",
    description:
      "Side-by-side comparison of multiple operators (2-5) across selected metrics",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Successfully compared operators",
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: "Invalid operator IDs or comparison parameters",
  })
  async compareOperators(@Body() dto: CompareOperatorsDto) {
    const comparison = await this.operatorService.compareOperators(dto);
    return ResponseHelper.ok(comparison, "Operators compared successfully");
  }

  /**
   * Endpoint 27: Get Operator Percentile Rankings
   */
  @Get(":id/rankings")
  @Public()
  @ApiSecurity("api-key")
  @ApiOperation({
    summary: "Get operator percentile rankings",
    description:
      "Percentile rankings for the operator across various metrics relative to network",
  })
  @ApiParam({ name: "id", description: "Operator ID" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Successfully retrieved rankings",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Operator not found",
  })
  async getOperatorRankings(
    @Param("id") id: string,
    @Query() query: GetRankingsDto
  ) {
    const rankings = await this.operatorService.getOperatorRankings(
      id,
      query.date
    );
    return ResponseHelper.ok(rankings, "Rankings retrieved successfully");
  }

  /**
   * Endpoint 28: Compare Operator to Network Averages
   */
  @Get(":id/vs-network")
  @Public()
  @ApiSecurity("api-key")
  @ApiOperation({
    summary: "Compare operator to network averages",
    description: "Compare operator metrics to network mean and median values",
  })
  @ApiParam({ name: "id", description: "Operator ID" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Successfully retrieved network comparison",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Operator not found",
  })
  async compareOperatorToNetwork(
    @Param("id") id: string,
    @Query() query: CompareToNetworkDto
  ) {
    const comparison = await this.operatorService.compareOperatorToNetwork(
      id,
      query.date
    );
    return ResponseHelper.ok(
      comparison,
      "Network comparison retrieved successfully"
    );
  }
}
