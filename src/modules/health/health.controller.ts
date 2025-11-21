import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { Public } from "src/core/decorators/public.decorator";
import { SkipApiKey } from "src/core/decorators/skip-api-key.decorator";
import { HealthService } from "./health.service";

@ApiTags("Health")
@Controller("health")
export class HealthController {
  constructor(private healthService: HealthService) {}

  @Get()
  @Public()
  @SkipApiKey()
  @ApiOperation({ summary: "Check overall system health" })
  async check() {
    return this.healthService.check();
  }

  @Get("database")
  @Public()
  @SkipApiKey()
  @ApiOperation({ summary: "Check database health" })
  async checkDatabase() {
    return this.healthService.checkDatabase();
  }

  @Get("redis")
  @Public()
  @SkipApiKey()
  @ApiOperation({ summary: "Check Redis health" })
  async checkRedis() {
    return this.healthService.checkRedis();
  }
}
