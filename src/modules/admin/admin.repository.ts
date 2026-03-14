import { Injectable } from "@nestjs/common";
import { PrismaUserService } from "src/core/database/prisma-user.service";

@Injectable()
export class AdminRepository {
  constructor(private readonly prisma: PrismaUserService) {}

  // --- Users ---

  async findUsers(params: {
    page: number;
    limit: number;
    search?: string;
    tier?: string;
    sort?: string;
    order?: "asc" | "desc";
  }) {
    const { page, limit, search, tier, sort = "created_at", order = "desc" } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (tier) {
      where.tier = tier;
    }
    if (search) {
      where.OR = [
        { wallet_address: { contains: search, mode: "insensitive" } },
        { display_name: { contains: search, mode: "insensitive" } },
        { emails: { some: { email: { contains: search, mode: "insensitive" } } } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.users.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort]: order },
        include: {
          emails: { where: { is_primary: true }, take: 1 },
          _count: { select: { payments: true } },
        },
      }),
      this.prisma.users.count({ where }),
    ]);

    return { users, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findUserById(id: string) {
    return this.prisma.users.findUnique({
      where: { id },
      include: {
        emails: true,
        sessions: {
          where: { revoked_at: null, expires_at: { gt: new Date() } },
          orderBy: { created_at: "desc" },
        },
        beta_perks: { include: { perk: true } },
        payments: {
          orderBy: { created_at: "desc" },
          include: { status_history: { orderBy: { timestamp: "asc" } } },
        },
        preferences: true,
      },
    });
  }

  async updateUserTier(id: string, tier: string, expiresAt?: Date | null) {
    return this.prisma.users.update({
      where: { id },
      data: { tier: tier as any, tier_expires_at: expiresAt },
    });
  }

  // --- Feedback ---

  async findFeedback(params: {
    page: number;
    limit: number;
    type?: string;
    sentiment?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const { page, limit, type, sentiment, search, dateFrom, dateTo } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (type) where.type = type;
    if (sentiment) where.sentiment = sentiment;
    if (search) {
      where.message = { contains: search, mode: "insensitive" };
    }
    if (dateFrom || dateTo) {
      where.created_at = {};
      if (dateFrom) where.created_at.gte = new Date(dateFrom);
      if (dateTo) where.created_at.lte = new Date(dateTo);
    }

    const [feedback, total] = await Promise.all([
      this.prisma.user_feedback.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
        include: { user: { select: { id: true, wallet_address: true, display_name: true } } },
      }),
      this.prisma.user_feedback.count({ where }),
    ]);

    return { feedback, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findFeedbackById(id: string) {
    return this.prisma.user_feedback.findUnique({
      where: { id },
      include: { user: { select: { id: true, wallet_address: true, display_name: true } } },
    });
  }

  async deleteFeedback(id: string) {
    return this.prisma.user_feedback.delete({ where: { id } });
  }

  // --- Stats ---

  async getStats() {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      proUsers,
      enterpriseUsers,
      betaMembers,
      totalFeedback,
      feedbackByType,
      feedbackBySentiment,
      usersThisWeek,
      usersThisMonth,
      totalRevenue,
      revenueThisMonth,
      confirmedPayments,
      totalPayments,
    ] = await Promise.all([
      this.prisma.users.count(),
      this.prisma.users.count({
        where: { tier: "PRO", tier_expires_at: { gt: now } },
      }),
      this.prisma.users.count({ where: { tier: "ENTERPRISE" } }),
      this.prisma.beta_members.count({ where: { is_active: true } }),
      this.prisma.user_feedback.count(),
      this.prisma.user_feedback.groupBy({
        by: ["type"],
        _count: { type: true },
      }),
      this.prisma.user_feedback.groupBy({
        by: ["sentiment"],
        _count: { sentiment: true },
      }),
      this.prisma.users.count({ where: { created_at: { gte: weekAgo } } }),
      this.prisma.users.count({ where: { created_at: { gte: monthAgo } } }),
      this.prisma.payment_transactions.aggregate({
        where: { status: "CONFIRMED" },
        _sum: { amount_usd: true },
      }),
      this.prisma.payment_transactions.aggregate({
        where: { status: "CONFIRMED", created_at: { gte: monthAgo } },
        _sum: { amount_usd: true },
      }),
      this.prisma.payment_transactions.count({ where: { status: "CONFIRMED" } }),
      this.prisma.payment_transactions.count(),
    ]);

    return {
      users: {
        total: totalUsers,
        pro: proUsers,
        enterprise: enterpriseUsers,
        free: totalUsers - proUsers - enterpriseUsers,
        new_this_week: usersThisWeek,
        new_this_month: usersThisMonth,
      },
      beta: {
        active_members: betaMembers,
      },
      feedback: {
        total: totalFeedback,
        by_type: feedbackByType.reduce(
          (acc, item) => ({ ...acc, [item.type]: item._count.type }),
          {},
        ),
        by_sentiment: feedbackBySentiment.reduce(
          (acc, item) => ({
            ...acc,
            [item.sentiment || "UNSET"]: item._count.sentiment,
          }),
          {},
        ),
      },
      revenue: {
        total_usd: Number(totalRevenue._sum.amount_usd || 0),
        this_month_usd: Number(revenueThisMonth._sum.amount_usd || 0),
        mrr: Number(revenueThisMonth._sum.amount_usd || 0),
      },
      payments: {
        total: totalPayments,
        confirmed: confirmedPayments,
        conversion_rate: totalPayments > 0
          ? Math.round((confirmedPayments / totalPayments) * 100)
          : 0,
      },
    };
  }

  // --- Payments ---

  async findPayments(params: {
    page: number;
    limit: number;
    status?: string;
    method?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const { page, limit, status, method, dateFrom, dateTo } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (method) where.payment_method = method;
    if (dateFrom || dateTo) {
      where.created_at = {};
      if (dateFrom) where.created_at.gte = new Date(dateFrom);
      if (dateTo) where.created_at.lte = new Date(dateTo);
    }

    const [payments, total] = await Promise.all([
      this.prisma.payment_transactions.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
        include: {
          user: { select: { id: true, wallet_address: true, display_name: true } },
          status_history: { orderBy: { timestamp: "asc" } },
        },
      }),
      this.prisma.payment_transactions.count({ where }),
    ]);

    return { payments, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findPaymentById(id: string) {
    return this.prisma.payment_transactions.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, wallet_address: true, display_name: true } },
        status_history: { orderBy: { timestamp: "asc" } },
      },
    });
  }
}
