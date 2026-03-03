import { Controller, Post, Body } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { RequireAuth } from "src/core/decorators/require-auth.decorator";
import { CurrentUser } from "src/core/decorators/current-user.decorator";
import { AuthUser } from "src/shared/types/auth.types";
import { PaymentsService } from "./payments.service";
import { VerifyPaymentDto } from "./dto/verify-payment.dto";
import { InitializePaystackDto } from "./dto/initialize-paystack.dto";

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

  @Post("paystack/initialize")
  @ApiOperation({ summary: "Initialize a Paystack payment" })
  async initializePaystack(
    @CurrentUser() user: AuthUser,
    @Body() body: InitializePaystackDto,
  ) {
    return this.paymentsService.initializePaystackTransaction(
      user.id,
      body.email,
    );
  }

  @Post("paystack/verify")
  @ApiOperation({ summary: "Verify a Paystack payment" })
  async verifyPaystack(
    @CurrentUser() user: AuthUser,
    @Body() body: { reference: string },
  ) {
    return this.paymentsService.verifyPaystackPayment(user.id, body.reference);
  }
}
