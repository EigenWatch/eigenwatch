import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaUserService } from "src/core/database/prisma-user.service";

@Injectable()
export class TierManagementService {
  private readonly logger = new Logger(TierManagementService.name);

  constructor(private readonly prisma: PrismaUserService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleTierExpiration() {
    this.logger.log("Running tier expiration check...");

    const now = new Date();

    const expiredUsers = await this.prisma.users.updateMany({
      where: {
        tier: { not: "FREE" },
        tier_expires_at: { lt: now },
      },
      data: {
        tier: "FREE",
        tier_expires_at: null,
      },
    });

    if (expiredUsers.count > 0) {
      this.logger.log(
        `Downgraded ${expiredUsers.count} users to FREE tier due to expiration.`,
      );
    } else {
      this.logger.log("No expired tiers found.");
    }
  }
}
