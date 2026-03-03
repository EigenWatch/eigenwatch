import { Controller, Post, Body, Headers, HttpStatus } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { RequireAuth } from "src/core/decorators/require-auth.decorator";
import { Public } from "src/core/decorators/public.decorator";
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

  @Post("flutterwave/initialize")
  @ApiOperation({ summary: "Initialize a Flutterwave payment" })
  async initializeFlutterwave(
    @CurrentUser() user: AuthUser,
    @Body() body: { email: string },
  ) {
    return this.paymentsService.initializeFlutterwaveTransaction(
      user.id,
      body.email,
    );
  }

  @Post("flutterwave/verify")
  @ApiOperation({ summary: "Verify a Flutterwave payment" })
  async verifyFlutterwave(
    @CurrentUser() user: AuthUser,
    @Body() body: { transaction_id: string },
  ) {
    return this.paymentsService.verifyFlutterwavePayment(
      user.id,
      body.transaction_id,
    );
  }

  @Public()
  @Post("flutterwave/webhook")
  @ApiOperation({ summary: "Handle Flutterwave webhooks" })
  async handleFlutterwaveWebhook(
    @Body() body: any,
    @Headers("verf-hash") signature: string, // Flutterwave usually uses verif-hash or verf-hash
    @Headers("verif-hash") signatureAlt: string,
  ) {
    const finalSignature = signature || signatureAlt;
    return this.paymentsService.handleFlutterwaveWebhook(body, finalSignature);
  }
}
