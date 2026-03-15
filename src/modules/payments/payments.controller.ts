import { Controller, Post, Body, Headers, Req } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { RequireAuth } from "src/core/decorators/require-auth.decorator";
import { Public } from "src/core/decorators/public.decorator";
import { SkipApiKey } from "src/core/decorators/skip-api-key.decorator";
import { CurrentUser } from "src/core/decorators/current-user.decorator";
import { AuthUser } from "src/shared/types/auth.types";
import { PaymentsService } from "./payments.service";
import { ChainrailsService } from "./chainrails.service";
import { VerifyPaymentDto } from "./dto/verify-payment.dto";
import { InitializePaystackDto } from "./dto/initialize-paystack.dto";
import { ChainrailsQuoteDto } from "./dto/chainrails-quote.dto";
import { ChainrailsIntentDto } from "./dto/chainrails-intent.dto";
import { RawBodyRequest } from "@nestjs/common";
import { Request } from "express";

@ApiTags("Payments")
@Controller("payments")
@ApiBearerAuth()
@RequireAuth()
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly chainrailsService: ChainrailsService,
  ) {}

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
  @SkipApiKey()
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

  // --- Chainrails ---

  @Post("chainrails/quote")
  @ApiOperation({ summary: "Get cross-chain payment quotes from Chainrails" })
  async getChainrailsQuotes(@Body() body: ChainrailsQuoteDto) {
    return this.chainrailsService.getQuotes(
      body.amount,
      body.destinationChain,
      body.tokenOut,
    );
  }

  @Post("chainrails/create-intent")
  @ApiOperation({ summary: "Create a Chainrails cross-chain payment intent" })
  async createChainrailsIntent(
    @CurrentUser() user: AuthUser,
    @Body() body: ChainrailsIntentDto,
  ) {
    return this.chainrailsService.createIntent(user.id, body);
  }

  @Public()
  @SkipApiKey()
  @RequireAuth(false)
  @Post("chainrails/webhook")
  @ApiOperation({ summary: "Handle Chainrails webhooks" })
  async handleChainrailsWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("x-chainrails-signature") signature: string,
    @Headers("x-chainrails-timestamp") timestamp: string,
  ) {
    const rawBody = req.rawBody?.toString() || "";
    return this.chainrailsService.handleWebhook(rawBody, signature, timestamp);
  }
}
