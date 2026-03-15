import { Injectable, Logger, HttpStatus } from "@nestjs/common";
import { createHmac } from "crypto";
import { AppConfigService } from "src/core/config/config.service";
import { UserRepository } from "../auth/repositories/user.repository";
import { PaymentRepository } from "./payment.repository";
import { AppException } from "src/shared/errors/app.exceptions";
import { ERROR_CODES } from "src/shared/constants/error-codes.constants";
import { ChainrailsIntentDto } from "./dto/chainrails-intent.dto";
import { PricingService } from "./pricing.service";

const CHAINRAILS_API_BASE = "https://api.chainrails.io/api/v1";
const REPLAY_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class ChainrailsService {
  private readonly logger = new Logger(ChainrailsService.name);

  constructor(
    private config: AppConfigService,
    private userRepository: UserRepository,
    private paymentRepository: PaymentRepository,
    private pricingService: PricingService,
  ) {}

  private getApiUrl(): string {
    return CHAINRAILS_API_BASE;
  }

  async getQuotes(amount: string, destinationChain: string, tokenOut: string) {
    this.logger.debug(
      `[getQuotes] Triggered with amount: ${amount}, destinationChain: ${destinationChain}, tokenOut: ${tokenOut}`,
    );
    try {
      const params = new URLSearchParams({
        amount,
        destinationChain,
        tokenOut,
      });

      const url = `${CHAINRAILS_API_BASE}/quotes/multi-source?${params}`;
      this.logger.debug(`[getQuotes] Calling Chainrails API: ${url}`);

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.config.payments.chainrails.apiKey}`,
        },
      });

      const data = await response.json();
      this.logger.debug(
        `[getQuotes] Raw response from Chainrails: ${JSON.stringify(data)}`,
      );

      if (!response.ok) {
        this.logger.error(`Chainrails quote failed: ${JSON.stringify(data)}`);
        throw new AppException(
          ERROR_CODES.CHAINRAILS_INTENT_FAILED,
          data.message || "Failed to fetch quotes from Chainrails",
          HttpStatus.BAD_GATEWAY,
        );
      }

      this.logger.debug(
        `[getQuotes] Successfully fetched quotes, returning data.`,
      );
      return data;
    } catch (error) {
      if (error instanceof AppException) throw error;
      this.logger.error(
        `Error fetching Chainrails quotes: ${error.message}`,
        error.stack,
      );
      throw new AppException(
        ERROR_CODES.INTERNAL_ERROR,
        "An error occurred while fetching payment quotes.",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async createIntent(userId: string, payload: ChainrailsIntentDto) {
    this.logger.debug(
      `[createIntent] Triggered for user ${userId} with payload: ${JSON.stringify(payload)}`,
    );
    try {
      await this.ensureVerifiedEmail(userId);
      this.logger.debug(
        `[createIntent] Email verification passed for user ${userId}`,
      );
      this.logger.log(`Creating Chainrails intent for user ${userId}`);

      // Calculate discounted price
      const amountUsd = await this.pricingService.calculateProPrice(userId);

      const requestBody = {
        sender: payload.sender,
        amount: amountUsd.toString(), // Use calculated price
        amountSymbol: payload.amountSymbol || "USDC",
        tokenIn: payload.tokenIn,
        sourceChain: payload.sourceChain,
        destinationChain: payload.destinationChain,
        recipient: this.config.payments.adminWalletAddress,
        refundAddress: payload.refundAddress || payload.sender,
        metadata: {
          ...payload.metadata,
          userId,
          source: "eigenwatch",
          tier: "PRO",
        },
      };

      this.logger.debug(
        `[createIntent] Initializing request to Chainrails endpoint /intents with body: ${JSON.stringify(requestBody)}`,
      );

      const response = await fetch(`${CHAINRAILS_API_BASE}/intents`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.payments.chainrails.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      this.logger.debug(
        `[createIntent] Raw response from Chainrails /intents: ${JSON.stringify(data)}`,
      );

      if (!response.ok) {
        this.logger.error(
          `Chainrails intent creation failed: ${JSON.stringify(data)}`,
        );
        throw new AppException(
          ERROR_CODES.CHAINRAILS_INTENT_FAILED,
          data.message || "Failed to create payment intent",
          HttpStatus.BAD_GATEWAY,
        );
      }

      this.logger.debug(
        `[createIntent] Successfully created intent, entering DB tracking phase.`,
      );

      // Track the payment transaction
      await this.paymentRepository.createTransaction({
        user_id: userId,
        amount_usd: amountUsd,
        payment_method: "CHAINRAILS",
        provider_ref: data.id || data.intent_address,
        status: "PENDING",
        metadata: {
          source_chain: payload.sourceChain,
          destination_chain: payload.destinationChain,
          token_in: payload.tokenIn,
          intent_id: data.id,
          intent_address: data.intent_address,
        },
      });

      this.logger.debug(
        `[createIntent] DB tracking passed, returning data back to client.`,
      );
      this.logger.log(
        `Chainrails intent created for user ${userId}: ${data.intent_address}`,
      );

      return data;
    } catch (error) {
      if (error instanceof AppException) throw error;
      this.logger.error(
        `Error creating Chainrails intent: ${error.message}`,
        error.stack,
      );
      throw new AppException(
        ERROR_CODES.INTERNAL_ERROR,
        "An error occurred while creating the payment intent.",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async handleWebhook(rawBody: string, signature: string, timestamp: string) {
    // 1. Verify signature
    if (!this.verifySignature(rawBody, signature, timestamp)) {
      this.logger.error("Invalid Chainrails webhook signature");
      throw new AppException(
        ERROR_CODES.CHAINRAILS_WEBHOOK_INVALID,
        "Invalid webhook signature",
        HttpStatus.UNAUTHORIZED,
      );
    }

    const payload = JSON.parse(rawBody);
    this.logger.log(`Received Chainrails webhook: ${payload.type}`);

    // 2. Handle events
    const intentId = payload.data?.intent_id;
    const intentAddress = payload.data?.intent_address;
    const providerRef = intentId || intentAddress;

    // Look up existing transaction by provider ref
    const existingTx = providerRef
      ? await this.paymentRepository.findByProviderRef(providerRef)
      : null;

    switch (payload.type) {
      case "intent.completed": {
        const userId = payload.data?.metadata?.userId;
        if (!userId) {
          this.logger.error(
            `No userId in webhook metadata for intent ${intentId}`,
          );
          return { status: "error", message: "No userId in metadata" };
        }

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        await this.userRepository.updateTier(userId, "PRO", expiresAt);

        if (existingTx) {
          await this.paymentRepository.updateTransactionStatus(
            existingTx.id,
            existingTx.status as any,
            "CONFIRMED",
            { reason: "Intent completed via webhook" },
          );
        }

        this.logger.log(
          `User ${userId} upgraded to PRO via Chainrails (intent: ${intentId})`,
        );
        return { status: "success", message: "User upgraded" };
      }

      case "intent.funded":
        if (existingTx) {
          await this.paymentRepository.updateTransactionStatus(
            existingTx.id,
            existingTx.status as any,
            "CONFIRMING",
            { reason: "Intent funded, bridge in progress" },
          );
        }
        this.logger.log(`Intent funded: ${intentId} (bridge in progress)`);
        return { status: "acknowledged", message: "Intent funded" };

      case "intent.expired":
        if (existingTx) {
          await this.paymentRepository.updateTransactionStatus(
            existingTx.id,
            existingTx.status as any,
            "EXPIRED",
            { reason: "Intent expired" },
          );
        }
        this.logger.log(`Intent expired: ${intentId}`);
        return { status: "acknowledged", message: "Intent expired" };

      case "intent.refunded":
        if (existingTx) {
          await this.paymentRepository.updateTransactionStatus(
            existingTx.id,
            existingTx.status as any,
            "FAILED",
            { reason: "Intent refunded" },
          );
        }
        this.logger.log(`Intent refunded: ${intentId}`);
        return { status: "acknowledged", message: "Intent refunded" };

      default:
        this.logger.warn(`Unknown Chainrails webhook event: ${payload.type}`);
        return { status: "ignored" };
    }
  }

  private verifySignature(
    rawBody: string,
    signature: string,
    timestamp: string,
  ): boolean {
    const secret = this.config.payments.chainrails.webhookSecret;
    if (!secret || !signature || !timestamp) {
      return false;
    }

    // Check timestamp to prevent replay attacks
    const eventTime = parseInt(timestamp, 10) * 1000;
    const timeDiff = Math.abs(Date.now() - eventTime);
    if (timeDiff > REPLAY_WINDOW_MS) {
      this.logger.error("Chainrails webhook timestamp too old");
      return false;
    }

    // Compute expected signature: HMAC-SHA256(secret, timestamp + "." + body)
    const signedPayload = `${timestamp}.${rawBody}`;
    const expectedSignature = createHmac("sha256", secret)
      .update(signedPayload)
      .digest("hex");

    // Add the prefix for the comparison
    const expectedWithPrefix = `sha256=${expectedSignature}`;

    // Use timingSafeEqual for security
    return signature === expectedWithPrefix;
  }

  private async ensureVerifiedEmail(userId: string) {
    const user = await this.userRepository.findById(userId);
    const isVerified = user?.emails?.some((e) => e.is_verified);
    if (!isVerified) {
      throw new AppException(
        ERROR_CODES.INVALID_PAYMENT,
        "A verified email is required to proceed with payment.",
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
