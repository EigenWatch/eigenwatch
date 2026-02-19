import { Injectable } from "@nestjs/common";
import { PrismaUserService } from "src/core/database/prisma-user.service";

@Injectable()
export class EmailRepository {
  constructor(private readonly prisma: PrismaUserService) {}

  async addEmail(
    userId: string,
    email: string,
    preferences: { alerts_opt_in: boolean; marketing_opt_in: boolean },
  ) {
    return this.prisma.user_emails.upsert({
      where: {
        user_id_email: { user_id: userId, email: email.toLowerCase() },
      },
      create: {
        user_id: userId,
        email: email.toLowerCase(),
        alerts_opt_in: preferences.alerts_opt_in,
        marketing_opt_in: preferences.marketing_opt_in,
      },
      update: {
        alerts_opt_in: preferences.alerts_opt_in,
        marketing_opt_in: preferences.marketing_opt_in,
      },
    });
  }

  async findByUserIdAndEmail(userId: string, email: string) {
    return this.prisma.user_emails.findUnique({
      where: {
        user_id_email: { user_id: userId, email: email.toLowerCase() },
      },
    });
  }

  async findAllByUserId(userId: string) {
    return this.prisma.user_emails.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
    });
  }

  async markVerified(userId: string, email: string) {
    return this.prisma.user_emails.update({
      where: {
        user_id_email: { user_id: userId, email: email.toLowerCase() },
      },
      data: {
        is_verified: true,
        verified_at: new Date(),
      },
    });
  }

  async removeEmail(emailId: string, userId: string) {
    return this.prisma.user_emails.delete({
      where: { id: emailId, user_id: userId },
    });
  }

  async setPrimary(emailId: string, userId: string) {
    // Unset all primary flags for this user, then set the target one
    await this.prisma.$transaction([
      this.prisma.user_emails.updateMany({
        where: { user_id: userId },
        data: { is_primary: false },
      }),
      this.prisma.user_emails.update({
        where: { id: emailId, user_id: userId },
        data: { is_primary: true },
      }),
    ]);
  }

  async findById(emailId: string, userId: string) {
    return this.prisma.user_emails.findFirst({
      where: { id: emailId, user_id: userId },
    });
  }

  // ---- Verification codes ----

  async createVerificationCode(email: string, code: string, expiresAt: Date) {
    return this.prisma.email_verification_codes.create({
      data: {
        email: email.toLowerCase(),
        code,
        expires_at: expiresAt,
      },
    });
  }

  async findValidCode(email: string, code: string) {
    return this.prisma.email_verification_codes.findFirst({
      where: {
        email: email.toLowerCase(),
        code,
        used: false,
        expires_at: { gt: new Date() },
        attempts: { lt: 3 },
      },
    });
  }

  async incrementAttempts(codeId: string) {
    return this.prisma.email_verification_codes.update({
      where: { id: codeId },
      data: { attempts: { increment: 1 } },
    });
  }

  async markCodeUsed(codeId: string) {
    return this.prisma.email_verification_codes.update({
      where: { id: codeId },
      data: { used: true },
    });
  }

  async countRecentCodes(email: string, since: Date) {
    return this.prisma.email_verification_codes.count({
      where: {
        email: email.toLowerCase(),
        created_at: { gte: since },
      },
    });
  }
}
