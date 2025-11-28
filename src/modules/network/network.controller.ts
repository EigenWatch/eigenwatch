import { Controller, Get, Query, HttpStatus, Logger } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
} from "@nestjs/swagger";

import {
  GetNetworkDistributionDto,
  GetNetworkHistoryDto,
} from "./dto/network.dto";
import { ResponseHelper } from "@/core/responses/response.helper";
import { NetworkService } from "./network.service";
import { Public } from "@/core/decorators/public.decorator";

@ApiTags("Network")
@Controller("network")
export class NetworkController {
  private readonly logger = new Logger(NetworkController.name);

  constructor(private networkService: NetworkService) {}

  /**
   * Endpoint 29: Get Network Statistics
   */
  @Get("stats")
  @Public()
  @ApiSecurity("api-key")
  @ApiOperation({
    summary: "Get network-wide statistics",
    description:
      "Current network-wide statistics including operators, TVS, delegation, and commission metrics",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Successfully retrieved network statistics",
  })
  async getNetworkStats() {
    const stats = await this.networkService.getNetworkStatistics();
    return ResponseHelper.ok(
      stats,
      "Network statistics retrieved successfully"
    );
  }

  /**
   * Endpoint 30: Get Network Distribution
   */
  @Get("distribution")
  @Public()
  @ApiSecurity("api-key")
  @ApiOperation({
    summary: "Get network distribution",
    description:
      "Distribution statistics for network metrics including percentiles and histogram",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Successfully retrieved network distribution",
  })
  async getNetworkDistribution(@Query() query: GetNetworkDistributionDto) {
    const distribution = await this.networkService.getNetworkDistribution(
      query.metric,
      query.date
    );
    return ResponseHelper.ok(
      distribution,
      "Network distribution retrieved successfully"
    );
  }

  /**
   * Endpoint 31: Get Network Daily Aggregates History
   */
  @Get("history")
  @Public()
  @ApiSecurity("api-key")
  @ApiOperation({
    summary: "Get network daily aggregates history",
    description:
      "Time series of network-wide metrics showing growth and trends over time",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Successfully retrieved network history",
  })
  async getNetworkHistory(@Query() query: GetNetworkHistoryDto) {
    const history = await this.networkService.getNetworkHistory(
      query.date_from,
      query.date_to
    );
    return ResponseHelper.ok(history, "Network history retrieved successfully");
  }
}
