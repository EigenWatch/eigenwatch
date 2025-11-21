import { Injectable, Logger } from "@nestjs/common";
import { CacheService } from "../cache/cache.service";
import { AppConfigService } from "../config/config.service";

@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);

  constructor(
    private cache: CacheService,
    private config: AppConfigService
  ) {}

  async checkIpLimit(ip: string): Promise<boolean> {
    const key = `ratelimit:ip:${ip}`;
    return this.checkLimit(key);
  }

  async checkApiKeyLimit(apiKey: string): Promise<boolean> {
    const key = `ratelimit:apikey:${apiKey}`;
    return this.checkLimit(key);
  }

  async checkUserLimit(userId: string): Promise<boolean> {
    const key = `ratelimit:user:${userId}`;
    return this.checkLimit(key);
  }

  private async checkLimit(key: string): Promise<boolean> {
    try {
      const current = await this.cache.get<number>(key);
      const maxRequests = this.config.rateLimit.maxRequests;
      const ttl = this.config.rateLimit.ttl;

      if (current === null) {
        await this.cache.set(key, 1, ttl);
        return true;
      }

      if (current >= maxRequests) {
        return false;
      }

      await this.cache.set(key, current + 1, ttl);
      return true;
    } catch (error) {
      this.logger.error(`Rate limit check failed for ${key}`, error);
      return true; // Fail open
    }
  }

  async getRemainingQuota(key: string): Promise<number> {
    try {
      const current = await this.cache.get<number>(key);
      const maxRequests = this.config.rateLimit.maxRequests;

      if (current === null) {
        return maxRequests;
      }

      return Math.max(0, maxRequests - current);
    } catch (error) {
      this.logger.error(`Failed to get remaining quota for ${key}`, error);
      return 0;
    }
  }
}
