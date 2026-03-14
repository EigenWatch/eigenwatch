import { Injectable, Logger, HttpStatus } from "@nestjs/common";
import { createHmac } from "crypto";
import { AppConfigService } from "src/core/config/config.service";
import { UserRepository } from "../auth/repositories/user.repository";
import { AppException } from "src/shared/errors/app.exceptions";
import { ERROR_CODES } from "src/shared/constants/error-codes.constants";
import { ChainrailsIntentDto } from "./dto/chainrails-intent.dto";

const CHAINRAILS_API_BASE = "https://api.chainrails.io/api/v1";
const REPLAY_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class ChainrailsService {
  private readonly logger = new Logger(ChainrailsService.name);

  constructor(
    private config: AppConfigService,
    private userRepository: UserRepository,
  ) {}

  async getQuotes(
    amount: string,
    destinationChain: string,
    tokenOut: string,
  ) {
    try {
      const params = new URLSearchParams({
        amount,
        destinationChain,
        tokenOut,
      });

      const response = await fetch(
        `${CHAINRAILS_API_BASE}/quotes/multi-source?${params}`,
        {
          headers: {
            Authorization: `Bearer ${this.config.payments.chainrails.apiKey}`,
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        this.logger.error(`Chainrails quote failed: ${JSON.stringify(data)}`);
        throw new AppException(
          ERROR_CODES.CHAINRAILS_INTENT_FAILED,
          data.message || "Failed to fetch quotes from Chainrails",
          HttpStatus.BAD_GATEWAY,
        );
      }

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
    try {
      await this.ensureVerifiedEmail(userId);
      this.logger.log(`Creating Chainrails intent for user ${userId}`);

      const response = await fetch(`${CHAINRAILS_API_BASE}/intents`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.payments.chainrails.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender: payload.sender,
          amount: payload.amount,
          amountSymbol: payload.amountSymbol || "USDC",
          tokenIn: payload.tokenIn,
          source_chain: payload.sourceChain,
          destination_chain: payload.destinationChain,
          recipient: payload.recipient,
          refund_address: payload.refundAddress,
          metadata: {
            ...payload.metadata,
            userId,
            source: "eigenwatch",
          },
        }),
      });

      const data = await response.json();

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

  async handleWebhook(
    rawBody: string,
    signature: string,
    timestamp: string,
  ) {
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
    switch (payload.type) {
      case "intent.completed": {
        const userId = payload.data?.metadata?.userId;
        if (!userId) {
          this.logger.error(
            `No userId in webhook metadata for intent ${payload.data?.intent_id}`,
          );
          return { status: "error", message: "No userId in metadata" };
        }

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        await this.userRepository.updateTier(userId, "PRO", expiresAt);

        this.logger.log(
          `User ${userId} upgraded to PRO via Chainrails (intent: ${payload.data?.intent_id})`,
        );
        return { status: "success", message: "User upgraded" };
      }

      case "intent.funded":
        this.logger.log(
          `Intent funded: ${payload.data?.intent_id} (bridge in progress)`,
        );
        return { status: "acknowledged", message: "Intent funded" };

      case "intent.expired":
        this.logger.log(
          `Intent expired: ${payload.data?.intent_id}`,
        );
        return { status: "acknowledged", message: "Intent expired" };

      case "intent.refunded":
        this.logger.log(
          `Intent refunded: ${payload.data?.intent_id}`,
        );
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

    return signature === expectedSignature;
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
