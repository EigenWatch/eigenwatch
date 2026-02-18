import { Injectable } from "@nestjs/common";
import { PrismaUserService } from "src/core/database/prisma-user.service";

@Injectable()
export class NonceRepository {
  constructor(private readonly prisma: PrismaUserService) {}

  async create(data: {
    walletAddress: string;
    nonce: string;
    message: string;
    expiresAt: Date;
  }) {
    return this.prisma.auth_nonces.create({
      data: {
        wallet_address: data.walletAddress.toLowerCase(),
        nonce: data.nonce,
        message: data.message,
        expires_at: data.expiresAt,
      },
    });
  }

  async findValidNonce(nonce: string) {
    return this.prisma.auth_nonces.findFirst({
      where: {
        nonce,
        used: false,
        expires_at: { gt: new Date() },
      },
    });
  }

  async markUsed(nonceId: string) {
    return this.prisma.auth_nonces.update({
      where: { id: nonceId },
      data: { used: true },
    });
  }

  async cleanupExpired() {
    return this.prisma.auth_nonces.deleteMany({
      where: {
        OR: [{ expires_at: { lt: new Date() } }, { used: true }],
      },
    });
  }
}
