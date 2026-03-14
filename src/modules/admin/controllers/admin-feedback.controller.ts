import { Controller, Get, Delete, Param, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { Public } from "src/core/decorators/public.decorator";
import { SkipApiKey } from "src/core/decorators/skip-api-key.decorator";
import { AdminAuthGuard } from "src/core/guards/admin-auth.guard";
import { AdminRepository } from "../admin.repository";

@ApiTags("Admin Feedback")
@Controller("admin/feedback")
@Public()
@SkipApiKey()
@UseGuards(AdminAuthGuard)
@ApiBearerAuth()
export class AdminFeedbackController {
  constructor(private readonly adminRepository: AdminRepository) {}

  @Get()
  @ApiOperation({ summary: "List all feedback with filters" })
  async listFeedback(
    @Query("page") page = "1",
    @Query("limit") limit = "20",
    @Query("type") type?: string,
    @Query("sentiment") sentiment?: string,
    @Query("search") search?: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
  ) {
    return this.adminRepository.findFeedback({
      page: parseInt(page, 10),
      limit: Math.min(parseInt(limit, 10), 100),
      type,
      sentiment,
      search,
      dateFrom,
      dateTo,
    });
  }

  @Get(":id")
  @ApiOperation({ summary: "Get feedback details" })
  async getFeedback(@Param("id") id: string) {
    return this.adminRepository.findFeedbackById(id);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a feedback entry" })
  async deleteFeedback(@Param("id") id: string) {
    await this.adminRepository.deleteFeedback(id);
    return { message: "Feedback deleted" };
  }
}
