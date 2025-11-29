// ============================================================================
// NEW FILE: SRC/MODULES/SEARCH/SEARCH.CONTROLLER.TS
// ============================================================================
import { Controller, Get, Query, HttpStatus, Logger } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
} from "@nestjs/swagger";
import { SearchService } from "./search.service";
import {
  GlobalSearchDto,
  GetLeaderboardDto,
  GetTrendingDto,
  GetRecentActivityDto,
} from "./dto/search.dto";
import { Public } from "@/core/decorators/public.decorator";
import { ResponseHelper } from "@/core/responses/response.helper";

@ApiTags("Search")
@Controller("search")
export class SearchController {
  private readonly logger = new Logger(SearchController.name);

  constructor(private searchService: SearchService) {}

  /**
   * Endpoint 32: Global Search
   */
  @Get()
  @Public()
  @ApiSecurity("api-key")
  @ApiOperation({
    summary: "Global search",
    description: "Search across operators, AVS, and stakers by address or name",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Successfully retrieved search results",
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: "Invalid search query",
  })
  async globalSearch(@Query() query: GlobalSearchDto) {
    const results = await this.searchService.globalSearch(
      query.query,
      query.entity_types,
      query.limit
    );
    return ResponseHelper.ok(results, "Search results retrieved successfully");
  }

  /**
   * Endpoint 33: Get Top Operators (Leaderboard)
   */
  @Get("leaderboard")
  @Public()
  @ApiSecurity("api-key")
  @ApiOperation({
    summary: "Get top operators leaderboard",
    description: "Leaderboard of top operators ranked by various metrics",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Successfully retrieved leaderboard",
  })
  async getLeaderboard(@Query() query: GetLeaderboardDto) {
    const leaderboard = await this.searchService.getLeaderboard(
      query.metric,
      query.limit,
      query.date
    );
    return ResponseHelper.ok(leaderboard, "Leaderboard retrieved successfully");
  }

  /**
   * Endpoint 34: Get Trending Operators
   */
  @Get("trending")
  @Public()
  @ApiSecurity("api-key")
  @ApiOperation({
    summary: "Get trending operators",
    description:
      "Operators with significant recent growth or activity based on selected metric",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Successfully retrieved trending operators",
  })
  async getTrending(@Query() query: GetTrendingDto) {
    const trending = await this.searchService.getTrendingOperators(
      query.timeframe,
      query.metric,
      query.limit
    );
    return ResponseHelper.ok(
      trending,
      "Trending operators retrieved successfully"
    );
  }

  /**
   * Endpoint 35: Get Recently Active Operators
   */
  @Get("recent-activity")
  @Public()
  @ApiSecurity("api-key")
  @ApiOperation({
    summary: "Get recently active operators",
    description:
      "Operators with recent activity events within specified timeframe",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Successfully retrieved recently active operators",
  })
  async getRecentActivity(@Query() query: GetRecentActivityDto) {
    const operators = await this.searchService.getRecentlyActiveOperators(
      query.activity_types,
      query.hours,
      query.limit
    );
    return ResponseHelper.ok(
      operators,
      "Recently active operators retrieved successfully"
    );
  }
}
