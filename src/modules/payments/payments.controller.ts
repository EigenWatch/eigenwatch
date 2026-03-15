import { Controller, Post, Body, Headers, Req, Logger } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { RequireAuth } from "src/core/decorators/require-auth.decorator";
import { Public } from "src/core/decorators/public.decorator";
import { SkipApiKey } from "src/core/decorators/skip-api-key.decorator";
import { CurrentUser } from "src/core/decorators/current-user.decorator";
import { AuthUser } from "src/shared/types/auth.types";
import { PaymentsService } from "./payments.service";
import { ChainrailsService } from "./chainrails.service";
import { VerifyPaymentDto } from "./dto/verify-payment.dto";
import { ChainrailsQuoteDto } from "./dto/chainrails-quote.dto";
import { ChainrailsIntentDto } from "./dto/chainrails-intent.dto";

@ApiTags("Payments")
@Controller("payments")
@ApiBearerAuth()
@RequireAuth()
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

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
    @Req() req: any,
    @Headers("x-chainrails-signature") signature: string,
    @Headers("x-chainrails-timestamp") timestamp: string,
  ) {
    const rawBody = req.rawBody?.toString() || "";
    return this.chainrailsService.handleWebhook(rawBody, signature, timestamp);
  }
}
