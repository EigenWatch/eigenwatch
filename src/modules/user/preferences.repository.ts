import { Injectable } from "@nestjs/common";
import { PrismaUserService } from "src/core/database/prisma-user.service";

@Injectable()
export class PreferencesRepository {
  constructor(private readonly prisma: PrismaUserService) {}

  async findByUserId(userId: string) {
    return this.prisma.user_preferences.findUnique({
      where: { user_id: userId },
    });
  }

  async upsert(
    userId: string,
    data: {
      risk_alerts_operator_changes?: boolean;
      risk_alerts_slashing?: boolean;
      risk_alerts_tvs_changes?: boolean;
      watchlist_daily_summary?: boolean;
      watchlist_status_changes?: boolean;
      product_updates?: boolean;
      newsletter?: boolean;
    },
  ) {
    return this.prisma.user_preferences.upsert({
      where: { user_id: userId },
      create: { user_id: userId, ...data },
      update: data as any,
    });
  }
}
