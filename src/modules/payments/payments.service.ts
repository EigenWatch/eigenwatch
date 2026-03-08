import { Injectable, Logger, HttpStatus } from "@nestjs/common";
import { ethers } from "ethers";
import { AppConfigService } from "src/core/config/config.service";
import { UserRepository } from "../auth/repositories/user.repository";
import { AppException } from "src/shared/errors/app.exceptions";
import { ERROR_CODES } from "src/shared/constants/error-codes.constants";

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private provider: ethers.Provider;

  constructor(
    private config: AppConfigService,
    private userRepository: UserRepository,
  ) {
    const configs = this.config.payments;
    const providers: any[] = [];

    // 1. Alchemy (High Priority)
    if (configs.alchemyApiKey) {
      providers.push({
        provider: new ethers.JsonRpcProvider(
          `https://base-mainnet.g.alchemy.com/v2/${configs.alchemyApiKey}`,
          8453,
          { staticNetwork: true },
        ),
        priority: 1,
        weight: 1,
      });
    }

    // 2. Infura (Standard Priority)
    if (configs.infuraApiKey) {
      providers.push({
        provider: new ethers.JsonRpcProvider(
          `https://base-mainnet.infura.io/v3/${configs.infuraApiKey}`,
          8453,
          { staticNetwork: true },
        ),
        priority: 2,
        weight: 1,
      });
    }

    // 3. Public RPC (Fallback Priority)
    if (configs.baseRpcUrl) {
      providers.push({
        provider: new ethers.JsonRpcProvider(configs.baseRpcUrl, 8453, {
          staticNetwork: true,
        }),
        priority: 3,
        weight: 1,
      });
    }

    // If no keys provided, at least use the default public RPC to avoid breaking everything
    if (providers.length === 0) {
      this.provider = new ethers.JsonRpcProvider(
        "https://mainnet.base.org",
        8453,
        { staticNetwork: true },
      );
    } else {
      this.provider = new ethers.FallbackProvider(providers);
    }
  }

  async verifyPayment(userId: string, txHash: string) {
    try {
      await this.ensureVerifiedEmail(userId);
      this.logger.log(`Verifying payment for user ${userId}, tx: ${txHash}`);

      // 1. Fetch transaction receipt
      const receipt = await this.provider.getTransactionReceipt(txHash);
      if (!receipt) {
        throw new AppException(
          ERROR_CODES.INVALID_PAYMENT,
          "Transaction not found or not yet confirmed.",
          HttpStatus.BAD_REQUEST,
        );
      }

      if (receipt.status !== 1) {
        throw new AppException(
          ERROR_CODES.INVALID_PAYMENT,
          "Transaction failed on-chain.",
          HttpStatus.BAD_REQUEST,
        );
      }

      // 2. Fetch transaction data to check "to", "value", and "contract"
      const tx = await this.provider.getTransaction(txHash);
      if (!tx) {
        throw new AppException(
          ERROR_CODES.INVALID_PAYMENT,
          "Could not fetch transaction details.",
          HttpStatus.BAD_REQUEST,
        );
      }

      const transferEventTopic = ethers.id("Transfer(address,address,uint256)");
      const log = receipt.logs.find(
        (l) =>
          (l.address.toLowerCase() ===
            this.config.payments.usdcAddress.toLowerCase() ||
            l.address.toLowerCase() ===
              this.config.payments.usdtAddress.toLowerCase()) &&
          l.topics[0] === transferEventTopic,
      );

      if (!log) {
        throw new AppException(
          ERROR_CODES.INVALID_PAYMENT,
          "No valid stablecoin transfer found in this transaction.",
          HttpStatus.BAD_REQUEST,
        );
      }

      // Decode ERC20 Transfer log
      // topics[1] = from, topics[2] = to
      const from = ethers.stripZerosLeft(log.topics[1]);
      const to = ethers.stripZerosLeft(log.topics[2]);
      const value = ethers.toBigInt(log.data);

      const adminAddress =
        this.config.payments.adminWalletAddress.toLowerCase();
      if (to.toLowerCase() !== adminAddress) {
        throw new AppException(
          ERROR_CODES.INVALID_PAYMENT,
          `Recipient address mismatch. Expected ${adminAddress}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // Check amount (USDC has 6 decimals)
      const expectedAmount = ethers.parseUnits(
        this.config.payments.proPriceUsdc,
        6,
      );
      if (value < expectedAmount) {
        throw new AppException(
          ERROR_CODES.INVALID_PAYMENT,
          `Insufficient amount. Expected at least ${this.config.payments.proPriceUsdc} USDC`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // 3. Upgrade user tier
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      await this.userRepository.updateTier(userId, "PRO", expiresAt);

      this.logger.log(`User ${userId} upgraded to PRO via tx ${txHash}`);

      return {
        success: true,
        tier: "PRO",
        message: "Payment verified and account upgraded successfully.",
      };
    } catch (error) {
      if (error instanceof AppException) throw error;
      this.logger.error(
        `Error verifying payment: ${error.message}`,
        error.stack,
      );
      throw new AppException(
        ERROR_CODES.INTERNAL_ERROR,
        "An error occurred during payment verification.",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async initializePaystackTransaction(userId: string, email: string) {
    try {
      await this.ensureVerifiedEmail(userId);
      this.logger.log(`Initializing Paystack transaction for user ${userId}`);

      const response = await fetch(
        "https://api.paystack.co/transaction/initialize",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.config.payments.paystack.secretKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            amount:
              parseFloat(this.config.payments.paystack.proPriceUsd) * 100 * 100, // Convert to cents, then to "base units" (Paystack USD is in cents)
            currency: "USD",
            callback_url: this.config.payments.paystack.callbackUrl,
            metadata: {
              userId,
              tier: "PRO",
            },
          }),
        },
      );

      const data = await response.json();

      if (!response.ok || !data.status) {
        this.logger.error(`Paystack initialization failed: ${data.message}`);
        throw new AppException(
          ERROR_CODES.INTERNAL_ERROR,
          data.message || "Failed to initialize Paystack transaction",
          HttpStatus.BAD_GATEWAY,
        );
      }

      return {
        authorization_url: data.data.authorization_url,
        reference: data.data.reference,
      };
    } catch (error) {
      if (error instanceof AppException) throw error;
      this.logger.error(
        `Error initializing Paystack: ${error.message}`,
        error.stack,
      );
      throw new AppException(
        ERROR_CODES.INTERNAL_ERROR,
        "An error occurred while initializing payment.",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async verifyPaystackPayment(userId: string, reference: string) {
    try {
      await this.ensureVerifiedEmail(userId);
      this.logger.log(
        `Verifying Paystack payment for user ${userId}, ref: ${reference}`,
      );

      const response = await fetch(
        `https://api.paystack.co/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${this.config.payments.paystack.secretKey}`,
          },
        },
      );

      const data = await response.json();

      if (!response.ok || !data.status) {
        this.logger.error(`Paystack verification failed: ${data.message}`);
        throw new AppException(
          ERROR_CODES.INVALID_PAYMENT,
          data.message || "Failed to verify Paystack payment",
          HttpStatus.BAD_GATEWAY,
        );
      }

      const { status, amount, metadata } = data.data;

      if (status !== "success") {
        throw new AppException(
          ERROR_CODES.INVALID_PAYMENT,
          `Transaction is ${status}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // Check if the userId in metadata matches
      if (metadata?.userId !== userId) {
        throw new AppException(
          ERROR_CODES.INVALID_PAYMENT,
          "User ID mismatch",
          HttpStatus.BAD_REQUEST,
        );
      }

      // Check amount (Paystack USD is in cents)
      const expectedAmountCents =
        parseFloat(this.config.payments.paystack.proPriceUsd) * 100;
      if (amount < expectedAmountCents) {
        throw new AppException(
          ERROR_CODES.INVALID_PAYMENT,
          `Insufficient amount. Expected at least ${this.config.payments.paystack.proPriceUsd} USD`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // Upgrade user tier
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      await this.userRepository.updateTier(userId, "PRO", expiresAt);

      this.logger.log(
        `User ${userId} upgraded to PRO via Paystack ref ${reference}`,
      );

      return {
        success: true,
        tier: "PRO",
        message: "Payment verified and account upgraded successfully.",
      };
    } catch (error) {
      if (error instanceof AppException) throw error;
      this.logger.error(
        `Error verifying Paystack payment: ${error.message}`,
        error.stack,
      );
      throw new AppException(
        ERROR_CODES.INTERNAL_ERROR,
        "An error occurred during payment verification.",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async initializeFlutterwaveTransaction(userId: string, email: string) {
    try {
      await this.ensureVerifiedEmail(userId);
      this.logger.log(
        `Initializing Flutterwave transaction for user ${userId}`,
      );

      const response = await fetch("https://api.flutterwave.com/v3/payments", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.payments.flutterwave.secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tx_ref: `pro-sub-${userId}-${Date.now()}`,
          amount: this.config.payments.paystack.proPriceUsd, // Reusing USD price
          currency: "USD",
          redirect_url: this.config.payments.flutterwave.redirectUrl,
          payment_plan: this.config.payments.flutterwave.planId,
          customer: {
            email,
          },
          meta: {
            userId,
            tier: "PRO",
          },
          customizations: {
            title: "EigenWatch Pro Subscription",
            description: "Monthly recurring subscription for Pro features.",
            logo: "https://dashboard.eigenwatch.xyz/logo.png",
          },
        }),
      });

      const data = await response.json();

      if (!response.ok || data.status !== "success") {
        this.logger.error(`Flutterwave initialization failed: ${data.message}`);
        throw new AppException(
          ERROR_CODES.INTERNAL_ERROR,
          data.message || "Failed to initialize Flutterwave transaction",
          HttpStatus.BAD_GATEWAY,
        );
      }

      return {
        authorization_url: data.data.link,
      };
    } catch (error) {
      if (error instanceof AppException) throw error;
      this.logger.error(
        `Error initializing Flutterwave: ${error.message}`,
        error.stack,
      );
      throw new AppException(
        ERROR_CODES.INTERNAL_ERROR,
        "An error occurred while initializing payment.",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async verifyFlutterwavePayment(userId: string, transactionId: string) {
    try {
      await this.ensureVerifiedEmail(userId);
      this.logger.log(
        `Verifying Flutterwave payment for user ${userId}, txId: ${transactionId}`,
      );

      const response = await fetch(
        `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
        {
          headers: {
            Authorization: `Bearer ${this.config.payments.flutterwave.secretKey}`,
          },
        },
      );

      const data = await response.json();

      if (!response.ok || data.status !== "success") {
        this.logger.error(`Flutterwave verification failed: ${data.message}`);
        throw new AppException(
          ERROR_CODES.INVALID_PAYMENT,
          data.message || "Failed to verify Flutterwave payment",
          HttpStatus.BAD_GATEWAY,
        );
      }

      const { status, amount, meta } = data.data;

      if (status !== "successful") {
        throw new AppException(
          ERROR_CODES.INVALID_PAYMENT,
          `Transaction is ${status}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // Check if the userId in meta matches
      if (meta?.userId !== userId) {
        throw new AppException(
          ERROR_CODES.INVALID_PAYMENT,
          "User ID mismatch",
          HttpStatus.BAD_REQUEST,
        );
      }

      // Upgrade user tier
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      await this.userRepository.updateTier(userId, "PRO", expiresAt);

      this.logger.log(
        `User ${userId} upgraded to PRO via Flutterwave id ${transactionId}`,
      );

      return {
        success: true,
        tier: "PRO",
        message: "Payment verified and account upgraded successfully.",
      };
    } catch (error) {
      if (error instanceof AppException) throw error;
      this.logger.error(
        `Error verifying Flutterwave payment: ${error.message}`,
        error.stack,
      );
      throw new AppException(
        ERROR_CODES.INTERNAL_ERROR,
        "An error occurred during payment verification.",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async handleFlutterwaveWebhook(payload: any, signature: string) {
    const webhookHash = this.config.payments.flutterwave.webhookHash;

    // 1. Verify signature
    if (!webhookHash || signature !== webhookHash) {
      this.logger.error("Invalid Flutterwave webhook signature");
      throw new AppException(
        ERROR_CODES.INVALID_PAYMENT,
        "Invalid signature",
        HttpStatus.UNAUTHORIZED,
      );
    }

    this.logger.log(`Received Flutterwave webhook: ${payload.event}`);

    // 2. Handle relevant events
    if (payload.event === "charge.completed") {
      const { status, meta, amount, currency, id } = payload.data;

      if (status === "successful") {
        const userId = meta?.userId;
        if (!userId) {
          this.logger.error(
            `No userId in webhook metadata for transaction ${id}`,
          );
          return { status: "error", message: "No userId in metadata" };
        }

        // Upgrade user tier
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        await this.userRepository.updateTier(userId, "PRO", expiresAt);

        this.logger.log(
          `User ${userId} upgraded to PRO via Flutterwave Webhook (tx: ${id})`,
        );

        return { status: "success", message: "User upgraded" };
      }
    }

    return { status: "ignored" };
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
