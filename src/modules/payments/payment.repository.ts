import { Injectable } from "@nestjs/common";
import { PrismaUserService } from "src/core/database/prisma-user.service";

@Injectable()
export class PaymentRepository {
  constructor(private readonly prisma: PrismaUserService) {}

  async createTransaction(data: {
    user_id: string;
    amount_usd: number;
    payment_method: "CRYPTO_DIRECT" | "CHAINRAILS";
    provider_ref?: string;
    status?: "PENDING" | "CONFIRMING" | "CONFIRMED" | "FAILED" | "EXPIRED";
    tier_granted?: "FREE" | "PRO" | "ENTERPRISE";
    duration_days?: number;
    metadata?: Record<string, any>;
  }) {
    const status = data.status || "PENDING";
    return this.prisma.payment_transactions.create({
      data: {
        user_id: data.user_id,
        amount_usd: data.amount_usd,
        payment_method: data.payment_method,
        provider_ref: data.provider_ref,
        status,
        tier_granted: data.tier_granted || "PRO",
        duration_days: data.duration_days || 30,
        metadata: data.metadata || undefined,
        status_history: {
          create: {
            from_status: null,
            to_status: status,
            metadata: { reason: "Transaction created" },
          },
        },
      },
      include: { status_history: true },
    });
  }

  async updateTransactionStatus(
    transactionId: string,
    fromStatus: "PENDING" | "CONFIRMING" | "CONFIRMED" | "FAILED" | "EXPIRED",
    toStatus: "PENDING" | "CONFIRMING" | "CONFIRMED" | "FAILED" | "EXPIRED",
    metadata?: Record<string, any>,
  ) {
    return this.prisma.$transaction([
      this.prisma.payment_transactions.update({
        where: { id: transactionId },
        data: { status: toStatus },
      }),
      this.prisma.payment_status_history.create({
        data: {
          transaction_id: transactionId,
          from_status: fromStatus,
          to_status: toStatus,
          metadata: metadata || undefined,
        },
      }),
    ]);
  }

  async findByProviderRef(providerRef: string) {
    return this.prisma.payment_transactions.findFirst({
      where: { provider_ref: String(providerRef) },
      include: { status_history: true },
    });
  }

  async findByUserId(userId: string) {
    return this.prisma.payment_transactions.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      include: { status_history: { orderBy: { timestamp: "asc" } } },
    });
  }

  async findPendingByUserId(userId: string) {
    return this.prisma.payment_transactions.findMany({
      where: {
        user_id: userId,
        status: "PENDING",
      },
    });
  }
}
