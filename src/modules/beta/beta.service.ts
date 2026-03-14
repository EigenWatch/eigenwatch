import { Injectable, Logger, HttpStatus } from "@nestjs/common";
import { BetaRepository } from "./beta.repository";
import { UserRepository } from "../auth/repositories/user.repository";
import { AppException } from "src/shared/errors/app.exceptions";
import { ERROR_CODES } from "src/shared/constants/error-codes.constants";

@Injectable()
export class BetaService {
  private readonly logger = new Logger(BetaService.name);

  constructor(
    private readonly betaRepository: BetaRepository,
    private readonly userRepository: UserRepository,
  ) {}

  /**
   * Check if an email is in the beta program and activate any pending perks for the user.
   * Called after email verification and on login for verified emails.
   */
  async checkAndActivateBetaPerks(
    userId: string,
    email: string,
  ): Promise<void> {
    try {
      const member = await this.betaRepository.findMemberByEmail(email);
      if (!member || !member.is_active) return;

      const activePerks = await this.betaRepository.getActivePerks();

      for (const perk of activePerks) {
        // Skip if already activated for this user
        const existing = await this.betaRepository.findUserPerk(
          userId,
          perk.id,
        );
        if (existing) continue;

        // Activate the perk
        await this.activatePerk(userId, perk);
        this.logger.log(
          `Activated beta perk "${perk.key}" for user ${userId} (email: ${email})`,
        );
      }
    } catch (error) {
      // Don't let beta check failures block auth flows
      this.logger.error(
        `Error checking beta perks for user ${userId}: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Get unseen perk notifications for a user.
   */
  async getUnseenPerks(userId: string) {
    const perks = await this.betaRepository.getUnseenPerks(userId);
    return perks.map((up) => ({
      id: up.perk_id,
      key: up.perk.key,
      description: up.perk.description,
      activated_at: up.activated_at.toISOString(),
      metadata: up.metadata,
    }));
  }

  /**
   * Mark a perk notification as seen.
   */
  async markPerkSeen(userId: string, perkId: string) {
    const userPerk = await this.betaRepository.findUserPerk(userId, perkId);
    if (!userPerk) {
      throw new AppException(
        ERROR_CODES.NOT_FOUND,
        "Perk not found for this user",
        HttpStatus.NOT_FOUND,
      );
    }
    await this.betaRepository.markPerkSeen(userId, perkId);
    return { message: "Perk notification marked as seen" };
  }

  /**
   * Check if a user is a beta member (via any of their verified emails).
   */
  async isBetaMember(userId: string): Promise<boolean> {
    const user = await this.userRepository.findById(userId);
    if (!user?.emails) return false;

    for (const email of user.emails) {
      if (!email.is_verified) continue;
      const member = await this.betaRepository.findMemberByEmail(email.email);
      if (member?.is_active) return true;
    }
    return false;
  }

  /**
   * Get beta status for a user including active perks.
   */
  async getBetaStatus(userId: string) {
    const isMember = await this.isBetaMember(userId);
    const userPerks = await this.betaRepository.getUserPerks(userId);

    return {
      is_beta_member: isMember,
      perks: userPerks.map((up) => ({
        id: up.perk_id,
        key: up.perk.key,
        description: up.perk.description,
        activated_at: up.activated_at.toISOString(),
        notification_seen: up.notification_seen,
      })),
    };
  }

  // --- Admin Methods ---

  async addBetaMember(email: string, notes?: string) {
    const member = await this.betaRepository.addMember(email, notes);
    this.logger.log(`Added beta member: ${email}`);
    return member;
  }

  async removeBetaMember(email: string) {
    const member = await this.betaRepository.findMemberByEmail(email);
    if (!member) {
      throw new AppException(
        ERROR_CODES.NOT_FOUND,
        "Beta member not found",
        HttpStatus.NOT_FOUND,
      );
    }
    await this.betaRepository.removeMember(email);
    this.logger.log(`Removed beta member: ${email}`);
    return { message: "Beta member removed" };
  }

  async listBetaMembers() {
    return this.betaRepository.listMembers();
  }

  async listPerks() {
    return this.betaRepository.listPerks();
  }

  async updatePerk(
    key: string,
    data: { is_active?: boolean; config?: any; description?: string },
  ) {
    const perk = await this.betaRepository.findPerkByKey(key);
    if (!perk) {
      throw new AppException(
        ERROR_CODES.NOT_FOUND,
        "Perk not found",
        HttpStatus.NOT_FOUND,
      );
    }
    return this.betaRepository.updatePerk(key, data);
  }

  /**
   * Get the discount percentage for a beta user, if the discounted_pro perk is active.
   */
  async getBetaDiscount(userId: string): Promise<number | null> {
    const userPerks = await this.betaRepository.getUserPerks(userId);
    const discountPerk = userPerks.find((up) => up.perk.key === "discounted_pro");
    if (!discountPerk) return null;

    const config = discountPerk.perk.config as any;
    if (!config?.enabled) return null;

    return config.discount_percent ?? 50;
  }

  // --- Private ---

  private async activatePerk(
    userId: string,
    perk: { id: string; key: string; config: any },
  ) {
    switch (perk.key) {
      case "free_pro_month": {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        await this.userRepository.updateTier(userId, "PRO", expiresAt);
        await this.betaRepository.activatePerkForUser(userId, perk.id, {
          tier: "PRO",
          duration_days: 30,
        });
        break;
      }

      case "discounted_pro": {
        // Discount perk doesn't activate a tier — it just records the perk
        // so the frontend can show discounted pricing
        const config = perk.config as any;
        if (config?.enabled) {
          await this.betaRepository.activatePerkForUser(userId, perk.id, {
            discount_percent: config.discount_percent ?? 50,
          });
        }
        break;
      }

      default:
        this.logger.warn(`Unknown beta perk key: ${perk.key}`);
        break;
    }
  }
}
