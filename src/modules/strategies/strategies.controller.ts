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
import { StrategiesService } from "./strategies.service";
import { FindStrategiesQueryDto } from "./dto/list-strategies.dto";
import { DateRangeDto } from "./dto/date-range.dto";
import { Public } from "@/core/decorators/public.decorator";
import { ResponseHelper } from "@/core/responses/response.helper";
import { PaginationDto } from "@/shared/dto/pagination.dto";

@ApiTags("Strategies")
@Controller("strategies")
export class StrategiesController {
  private readonly logger = new Logger(StrategiesController.name);

  constructor(private readonly strategiesService: StrategiesService) {}

  /**
   * Get network-wide strategy statistics
   */
  @Get("stats")
  @Public()
  @ApiSecurity("api-key")
  @ApiOperation({
    summary: "Get network strategy statistics",
    description:
      "Network-wide strategy statistics including total TVS and top strategies",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Successfully retrieved strategy statistics",
  })
  async getStats() {
    const stats = await this.strategiesService.getNetworkStats();
    return ResponseHelper.ok(
      stats,
      "Strategy statistics retrieved successfully",
    );
  }

  /**
   * List all strategies with filters and pagination
   */
  @Get()
  @Public()
  @ApiSecurity("api-key")
  @ApiOperation({
    summary: "Get all strategies with filters and pagination",
    description:
      "List all EigenLayer strategies with TVS, operator counts, and token metadata",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Successfully retrieved strategies list",
  })
  async findAll(@Query() query: FindStrategiesQueryDto) {
    const limit = query.limit || 20;
    const offset = query.offset || 0;
    const { strategies, total } = await this.strategiesService.findAll(query, {
      limit,
      offset,
    });
    return ResponseHelper.paginated(
      strategies,
      { total, limit, offset, has_more: offset + limit < total },
      "Strategies retrieved successfully",
    );
  }

  /**
   * Get strategy by ID
   */
  @Get(":id")
  @Public()
  @ApiSecurity("api-key")
  @ApiOperation({
    summary: "Get strategy detail",
    description:
      "Detailed information about a specific strategy including token metadata and links",
  })
  @ApiParam({ name: "id", description: "Strategy ID" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Successfully retrieved strategy detail",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Strategy not found",
  })
  async findOne(@Param("id") id: string) {
    const strategy = await this.strategiesService.findById(id);
    return ResponseHelper.ok(strategy, "Strategy retrieved successfully");
  }

  /**
   * Get operators using a strategy
   */
  @Get(":id/operators")
  @Public()
  @ApiSecurity("api-key")
  @ApiOperation({
    summary: "Get operators using strategy",
    description:
      "List operators that have delegated to this strategy, sorted by TVS",
  })
  @ApiParam({ name: "id", description: "Strategy ID" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Successfully retrieved operators",
  })
  async getOperators(@Param("id") id: string, @Query() query: PaginationDto) {
    const limit = query.limit || 20;
    const offset = query.offset || 0;
    const { operators, total } = await this.strategiesService.getOperators(id, {
      limit,
      offset,
    });
    return ResponseHelper.paginated(
      operators,
      { total, limit, offset, has_more: offset + limit < total },
      "Operators retrieved successfully",
    );
  }

  /**
   * Get delegators for a strategy
   */
  @Get(":id/delegators")
  @Public()
  @ApiSecurity("api-key")
  @ApiOperation({
    summary: "Get top delegators for strategy",
    description:
      "List delegators (stakers) who have staked in this strategy, sorted by shares",
  })
  @ApiParam({ name: "id", description: "Strategy ID" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Successfully retrieved delegators",
  })
  async getDelegators(@Param("id") id: string, @Query() query: PaginationDto) {
    const limit = query.limit || 20;
    const offset = query.offset || 0;
    const { delegators, total } = await this.strategiesService.getDelegators(
      id,
      { limit, offset },
    );
    return ResponseHelper.paginated(
      delegators,
      { total, limit, offset, has_more: offset + limit < total },
      "Delegators retrieved successfully",
    );
  }

  /**
   * Get price history for strategy's underlying token
   */
  @Get(":id/price-history")
  @Public()
  @ApiSecurity("api-key")
  @ApiOperation({
    summary: "Get token price history",
    description: "Historical price data for the strategy's underlying token",
  })
  @ApiParam({ name: "id", description: "Strategy ID" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Successfully retrieved price history",
  })
  async getPriceHistory(@Param("id") id: string, @Query() query: DateRangeDto) {
    const priceHistory = await this.strategiesService.getPriceHistory(
      id,
      query.date_from,
      query.date_to,
    );
    return ResponseHelper.ok(
      priceHistory,
      "Price history retrieved successfully",
    );
  }

  /**
   * Get TVS history for a strategy
   */
  @Get(":id/tvs-history")
  @Public()
  @ApiSecurity("api-key")
  @ApiOperation({
    summary: "Get strategy TVS history",
    description:
      "Historical TVS (Total Value Secured) for the strategy across all operators",
  })
  @ApiParam({ name: "id", description: "Strategy ID" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Successfully retrieved TVS history",
  })
  async getTVSHistory(@Param("id") id: string, @Query() query: DateRangeDto) {
    const tvsHistory = await this.strategiesService.getTVSHistory(
      id,
      query.date_from,
      query.date_to,
    );
    return ResponseHelper.ok(tvsHistory, "TVS history retrieved successfully");
  }
}
