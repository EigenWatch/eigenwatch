import { Injectable } from "@nestjs/common";
import { PrismaUserService } from "src/core/database/prisma-user.service";

@Injectable()
export class BetaRepository {
  constructor(private readonly prisma: PrismaUserService) {}

  // --- Beta Members ---

  async findMemberByEmail(email: string) {
    return this.prisma.beta_members.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  async addMember(email: string, notes?: string) {
    return this.prisma.beta_members.upsert({
      where: { email: email.toLowerCase() },
      update: { is_active: true, notes },
      create: { email: email.toLowerCase(), notes },
    });
  }

  async removeMember(email: string) {
    return this.prisma.beta_members.update({
      where: { email: email.toLowerCase() },
      data: { is_active: false },
    });
  }

  async listMembers() {
    return this.prisma.beta_members.findMany({
      orderBy: { added_at: "desc" },
    });
  }

  // --- Beta Perks ---

  async findPerkByKey(key: string) {
    return this.prisma.beta_perks.findUnique({
      where: { key },
    });
  }

  async listPerks() {
    return this.prisma.beta_perks.findMany({
      orderBy: { created_at: "asc" },
    });
  }

  async updatePerk(key: string, data: { is_active?: boolean; config?: any; description?: string }) {
    return this.prisma.beta_perks.update({
      where: { key },
      data,
    });
  }

  async getActivePerks() {
    return this.prisma.beta_perks.findMany({
      where: { is_active: true },
    });
  }

  // --- User Beta Perks ---

  async findUserPerk(userId: string, perkId: string) {
    return this.prisma.user_beta_perks.findUnique({
      where: { user_id_perk_id: { user_id: userId, perk_id: perkId } },
    });
  }

  async activatePerkForUser(
    userId: string,
    perkId: string,
    metadata?: any,
  ) {
    return this.prisma.user_beta_perks.create({
      data: {
        user_id: userId,
        perk_id: perkId,
        metadata,
      },
    });
  }

  async getUnseenPerks(userId: string) {
    return this.prisma.user_beta_perks.findMany({
      where: {
        user_id: userId,
        notification_seen: false,
      },
      include: { perk: true },
    });
  }

  async markPerkSeen(userId: string, perkId: string) {
    return this.prisma.user_beta_perks.update({
      where: { user_id_perk_id: { user_id: userId, perk_id: perkId } },
      data: { notification_seen: true },
    });
  }

  async getUserPerks(userId: string) {
    return this.prisma.user_beta_perks.findMany({
      where: { user_id: userId },
      include: { perk: true },
    });
  }
}
