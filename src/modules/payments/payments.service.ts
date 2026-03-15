import { Injectable, Logger, HttpStatus } from "@nestjs/common";
import { ethers } from "ethers";
import { AppConfigService } from "src/core/config/config.service";
import { UserRepository } from "../auth/repositories/user.repository";
import { PaymentRepository } from "./payment.repository";
import { PricingService } from "./pricing.service";
import { AppException } from "src/shared/errors/app.exceptions";
import { ERROR_CODES } from "src/shared/constants/error-codes.constants";

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private provider: ethers.Provider;

  constructor(
    private config: AppConfigService,
    private userRepository: UserRepository,
    private paymentRepository: PaymentRepository,
    private pricingService: PricingService,
  ) {
    // ... (provider initialization remains the same)
    const configs = this.config.payments;
    const providers: any[] = [];
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
    if (configs.baseRpcUrl) {
      providers.push({
        provider: new ethers.JsonRpcProvider(configs.baseRpcUrl, 8453, {
          staticNetwork: true,
        }),
        priority: 3,
        weight: 1,
      });
    }
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

      // Calculate discounted price
      const amountUsd = await this.pricingService.calculateProPrice(userId);

      // Create transaction record
      const transaction = await this.paymentRepository.createTransaction({
        user_id: userId,
        amount_usd: amountUsd,
        payment_method: "CRYPTO_DIRECT",
        provider_ref: txHash,
        status: "PENDING",
        metadata: { chain: "base", token: "USDC/USDT" },
      });

      // 1. Fetch transaction receipt
      const receipt = await this.provider.getTransactionReceipt(txHash);
      if (!receipt) {
        await this.paymentRepository.updateTransactionStatus(
          transaction.id,
          "PENDING",
          "FAILED",
          { reason: "Transaction not found or not yet confirmed" },
        );
        throw new AppException(
          ERROR_CODES.INVALID_PAYMENT,
          "Transaction not found or not yet confirmed.",
          HttpStatus.BAD_REQUEST,
        );
      }

      // Mark as confirming
      await this.paymentRepository.updateTransactionStatus(
        transaction.id,
        "PENDING",
        "CONFIRMING",
        { reason: "Receipt found, verifying transfer details" },
      );

      if (receipt.status !== 1) {
        await this.paymentRepository.updateTransactionStatus(
          transaction.id,
          "CONFIRMING",
          "FAILED",
          { reason: "Transaction failed on-chain" },
        );
        throw new AppException(
          ERROR_CODES.INVALID_PAYMENT,
          "Transaction failed on-chain.",
          HttpStatus.BAD_REQUEST,
        );
      }

      // 2. Fetch transaction data
      const tx = await this.provider.getTransaction(txHash);
      if (!tx) {
        await this.paymentRepository.updateTransactionStatus(
          transaction.id,
          "CONFIRMING",
          "FAILED",
          { reason: "Could not fetch transaction details" },
        );
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
        await this.paymentRepository.updateTransactionStatus(
          transaction.id,
          "CONFIRMING",
          "FAILED",
          { reason: "No valid stablecoin transfer found" },
        );
        throw new AppException(
          ERROR_CODES.INVALID_PAYMENT,
          "No valid stablecoin transfer found in this transaction.",
          HttpStatus.BAD_REQUEST,
        );
      }

      // Decode ERC20 Transfer log
      const to = ethers.stripZerosLeft(log.topics[2]);
      const value = ethers.toBigInt(log.data);

      const adminAddress =
        this.config.payments.adminWalletAddress.toLowerCase();
      if (to.toLowerCase() !== adminAddress) {
        await this.paymentRepository.updateTransactionStatus(
          transaction.id,
          "CONFIRMING",
          "FAILED",
          { reason: `Recipient mismatch. Expected ${adminAddress}` },
        );
        throw new AppException(
          ERROR_CODES.INVALID_PAYMENT,
          `Recipient address mismatch. Expected ${adminAddress}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // Check amount (using calculated discounted price)
      const expectedAmountBigInt = ethers.parseUnits(amountUsd.toString(), 6);
      if (value < expectedAmountBigInt) {
        await this.paymentRepository.updateTransactionStatus(
          transaction.id,
          "CONFIRMING",
          "FAILED",
          { reason: `Insufficient amount. Expected ${amountUsd} USDC` },
        );
        throw new AppException(
          ERROR_CODES.INVALID_PAYMENT,
          `Insufficient amount. Expected at least ${amountUsd} USDC`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // 3. Upgrade user tier
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      await this.userRepository.updateTier(userId, "PRO", expiresAt);

      // Mark payment as confirmed
      await this.paymentRepository.updateTransactionStatus(
        transaction.id,
        "CONFIRMING",
        "CONFIRMED",
        { reason: "Payment verified and tier upgraded" },
      );

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

  /**
   * Process any PENDING transactions for a user.
   * Called during polling (e.g., auth/me) to move transactions to CONFIRMING
   * so the admin panel reflects that checking is underway.
   */
  async processPendingTransactions(userId: string) {
    const userTransactions = await this.paymentRepository.findByUserId(userId);
    const pendingTxs = userTransactions.filter((tx) => tx.status === "PENDING");

    for (const tx of pendingTxs) {
      await this.paymentRepository.updateTransactionStatus(
        tx.id,
        "PENDING",
        "CONFIRMING",
        { reason: "User is active and polling; tracking payment progress" },
      );
      this.logger.log(
        `Moved transaction ${tx.id} for user ${userId} to CONFIRMING status during polling.`,
      );
    }
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
