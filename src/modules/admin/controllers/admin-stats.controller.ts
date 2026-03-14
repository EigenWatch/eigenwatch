import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { Public } from "src/core/decorators/public.decorator";
import { SkipApiKey } from "src/core/decorators/skip-api-key.decorator";
import { AdminAuthGuard } from "src/core/guards/admin-auth.guard";
import { AdminRepository } from "../admin.repository";

@ApiTags("Admin Stats")
@Controller("admin/stats")
@Public()
@SkipApiKey()
@UseGuards(AdminAuthGuard)
@ApiBearerAuth()
export class AdminStatsController {
  constructor(private readonly adminRepository: AdminRepository) {}

  @Get()
  @ApiOperation({ summary: "Get dashboard stats" })
  async getStats() {
    return this.adminRepository.getStats();
  }
}
