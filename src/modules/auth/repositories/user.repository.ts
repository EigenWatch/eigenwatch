import { Injectable } from "@nestjs/common";
import { PrismaUserService } from "src/core/database/prisma-user.service";

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaUserService) {}

  async findById(id: string) {
    return this.prisma.users.findUnique({
      where: { id },
      include: { emails: true, preferences: true },
    });
  }

  async findByWalletAddress(address: string) {
    return this.prisma.users.findUnique({
      where: { wallet_address: address.toLowerCase() },
      include: { emails: true, preferences: true },
    });
  }

  async create(walletAddress: string) {
    return this.prisma.users.create({
      data: { wallet_address: walletAddress.toLowerCase() },
      include: { emails: true, preferences: true },
    });
  }

  async findOrCreate(walletAddress: string) {
    const existing = await this.findByWalletAddress(walletAddress);
    if (existing) return { user: existing, isNew: false };
    const user = await this.create(walletAddress);
    return { user, isNew: true };
  }

  async updateLastLogin(userId: string) {
    return this.prisma.users.update({
      where: { id: userId },
      data: { last_login_at: new Date() },
    });
  }

  async updateTier(
    userId: string,
    tier: "FREE" | "PRO" | "ENTERPRISE",
    expiresAt?: Date,
  ) {
    return this.prisma.users.update({
      where: { id: userId },
      data: { tier, tier_expires_at: expiresAt },
    });
  }

  async updateProfile(userId: string, data: { display_name?: string }) {
    return this.prisma.users.update({
      where: { id: userId },
      data,
      include: { emails: true, preferences: true },
    });
  }

  async deleteUser(userId: string) {
    return this.prisma.users.delete({
      where: { id: userId },
    });
  }
}
