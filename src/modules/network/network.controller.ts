import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";

@ApiTags("Network")
@Controller("network")
export class NetworkController {
  @Get("stats")
  @ApiOperation({ summary: "Get network-wide statistics" })
  async getStats() {
    return null;
  }

  @Get("trends")
  @ApiOperation({ summary: "Get network trends" })
  async getTrends() {
    return [];
  }
}
