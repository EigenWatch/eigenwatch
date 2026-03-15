import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { Public } from "src/core/decorators/public.decorator";
import { SkipApiKey } from "src/core/decorators/skip-api-key.decorator";
import { AdminAuthGuard } from "src/core/guards/admin-auth.guard";
import { AdminRepository } from "../admin.repository";

@ApiTags("Admin Payments")
@Controller("admin/payments")
@Public()
@SkipApiKey()
@UseGuards(AdminAuthGuard)
@ApiBearerAuth()
export class AdminPaymentsController {
  constructor(private readonly adminRepository: AdminRepository) {}

  @Get()
  @ApiOperation({ summary: "List all payments with filters" })
  async listPayments(
    @Query("page") page = "1",
    @Query("limit") limit = "20",
    @Query("status") status?: string,
    @Query("method") method?: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
  ) {
    return this.adminRepository.findPayments({
      page: parseInt(page, 10),
      limit: Math.min(parseInt(limit, 10), 100),
      status,
      method,
      dateFrom,
      dateTo,
    });
  }

  @Get(":id")
  @ApiOperation({ summary: "Get payment details with status history" })
  async getPayment(@Param("id") id: string) {
    return this.adminRepository.findPaymentById(id);
  }
}
