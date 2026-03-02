import { Controller, Post, Body } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { RequireAuth } from "src/core/decorators/require-auth.decorator";
import { CurrentUser } from "src/core/decorators/current-user.decorator";
import { AuthUser } from "src/shared/types/auth.types";
import { PaymentsService } from "./payments.service";
import { VerifyPaymentDto } from "./dto/verify-payment.dto";

@ApiTags("Payments")
@Controller("payments")
@ApiBearerAuth()
@RequireAuth()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post("verify")
  @ApiOperation({ summary: "Verify a USDC payment on Base" })
  async verifyPayment(
    @CurrentUser() user: AuthUser,
    @Body() body: VerifyPaymentDto,
  ) {
    return this.paymentsService.verifyPayment(user.id, body.txHash);
  }
}
