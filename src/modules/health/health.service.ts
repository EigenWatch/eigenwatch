import { Injectable } from "@nestjs/common";
import { CacheService } from "src/core/cache/cache.service";
import { DatabaseHealthService } from "src/core/database/database.health";

@Injectable()
export class HealthService {
  constructor(
    private databaseHealth: DatabaseHealthService,
    private cache: CacheService
  ) {}

  async check() {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const isHealthy =
      database.status === "healthy" && redis.status === "healthy";

    return {
      status: isHealthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      checks: {
        database,
        redis,
      },
    };
  }

  async checkDatabase() {
    return this.databaseHealth.check();
  }

  async checkRedis() {
    const isHealthy = await this.cache.ping();

    return {
      status: isHealthy ? "healthy" : "unhealthy",
    };
  }
}
