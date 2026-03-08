import { Injectable } from "@nestjs/common";
import { PrismaUserService } from "src/core/database/prisma-user.service";

@Injectable()
export class FeedbackRepository {
  constructor(private readonly prisma: PrismaUserService) {}

  async create(data: {
    user_id: string;
    type: string;
    sentiment?: string;
    category?: string;
    message?: string;
    page_url?: string;
    section_id?: string;
    metadata?: any;
  }) {
    return this.prisma.user_feedback.create({
      data: {
        user_id: data.user_id,
        type: data.type as any,
        sentiment: (data.sentiment as any) || null,
        category: data.category || null,
        message: data.message || null,
        page_url: data.page_url || null,
        section_id: data.section_id || null,
        metadata: data.metadata || null,
      },
    });
  }

  async findByUser(userId: string, limit = 50) {
    return this.prisma.user_feedback.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      take: limit,
    });
  }
}
