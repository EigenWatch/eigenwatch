/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Controller,
  Get,
  Param,
  Query,
  HttpStatus,
  Logger,
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
}
