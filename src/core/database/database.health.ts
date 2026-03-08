import { Injectable } from "@nestjs/common";
import { PrismaAnalyticsService } from "./prisma-analytics.service";
import { PrismaUserService } from "./prisma-user.service";

export interface DatabaseHealthResult {
  status: "healthy" | "unhealthy";
  responseTime: number;
  error?: string;
}

export interface CombinedDatabaseHealthResult {
  analytics_db: DatabaseHealthResult;
  user_db: DatabaseHealthResult;
}

@Injectable()
export class DatabaseHealthService {
  constructor(
    private analyticsDb: PrismaAnalyticsService,
    private userDb: PrismaUserService,
  ) {}

  async check(): Promise<CombinedDatabaseHealthResult> {
    const [analyticsHealth, userHealth] = await Promise.all([
      this.checkDatabase(this.analyticsDb),
      this.checkDatabase(this.userDb),
    ]);

    return {
      analytics_db: analyticsHealth,
      user_db: userHealth,
    };
  }

  private async checkDatabase(
    prisma: PrismaAnalyticsService | PrismaUserService,
  ): Promise<DatabaseHealthResult> {
    const startTime = Date.now();

    try {
      await prisma.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - startTime;

      return {
        status: "healthy",
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        status: "unhealthy",
        responseTime,
        error: error.message,
      };
    }
  }
}
