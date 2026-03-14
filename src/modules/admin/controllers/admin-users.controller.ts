import { Controller, Get, Patch, Param, Query, Body, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { Public } from "src/core/decorators/public.decorator";
import { SkipApiKey } from "src/core/decorators/skip-api-key.decorator";
import { AdminAuthGuard } from "src/core/guards/admin-auth.guard";
import { AdminRepository } from "../admin.repository";

@ApiTags("Admin Users")
@Controller("admin/users")
@Public()
@SkipApiKey()
@UseGuards(AdminAuthGuard)
@ApiBearerAuth()
export class AdminUsersController {
  constructor(private readonly adminRepository: AdminRepository) {}

  @Get()
  @ApiOperation({ summary: "List all users with pagination, search, and filters" })
  async listUsers(
    @Query("page") page = "1",
    @Query("limit") limit = "20",
    @Query("search") search?: string,
    @Query("tier") tier?: string,
    @Query("sort") sort?: string,
    @Query("order") order?: "asc" | "desc",
  ) {
    return this.adminRepository.findUsers({
      page: parseInt(page, 10),
      limit: Math.min(parseInt(limit, 10), 100),
      search,
      tier,
      sort,
      order,
    });
  }

  @Get(":id")
  @ApiOperation({ summary: "Get full user details" })
  async getUser(@Param("id") id: string) {
    return this.adminRepository.findUserById(id);
  }

  @Patch(":id/tier")
  @ApiOperation({ summary: "Manually update a user's tier" })
  async updateTier(
    @Param("id") id: string,
    @Body() body: { tier: string; expires_at?: string | null },
  ) {
    const expiresAt = body.expires_at ? new Date(body.expires_at) : null;
    return this.adminRepository.updateUserTier(id, body.tier, expiresAt);
  }
}
