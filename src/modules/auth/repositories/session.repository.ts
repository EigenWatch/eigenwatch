import { Injectable } from "@nestjs/common";
import { PrismaUserService } from "src/core/database/prisma-user.service";

@Injectable()
export class SessionRepository {
  constructor(private readonly prisma: PrismaUserService) {}

  async create(data: {
    userId: string;
    refreshTokenHash: string;
    expiresAt: Date;
    deviceInfo?: string;
    ipAddress?: string;
  }) {
    return this.prisma.user_sessions.create({
      data: {
        user_id: data.userId,
        refresh_token_hash: data.refreshTokenHash,
        expires_at: data.expiresAt,
        device_info: data.deviceInfo,
        ip_address: data.ipAddress,
      },
    });
  }

  async findByTokenHash(hash: string) {
    return this.prisma.user_sessions.findFirst({
      where: {
        refresh_token_hash: hash,
        revoked_at: null,
        expires_at: { gt: new Date() },
      },
      include: { user: { include: { emails: true, preferences: true } } },
    });
  }

  async revoke(sessionId: string) {
    return this.prisma.user_sessions.update({
      where: { id: sessionId },
      data: { revoked_at: new Date() },
    });
  }

  async revokeAllForUser(userId: string) {
    return this.prisma.user_sessions.updateMany({
      where: { user_id: userId, revoked_at: null },
      data: { revoked_at: new Date() },
    });
  }

  async findActiveByUser(userId: string) {
    return this.prisma.user_sessions.findMany({
      where: {
        user_id: userId,
        revoked_at: null,
        expires_at: { gt: new Date() },
      },
      orderBy: { created_at: "desc" },
    });
  }
}
