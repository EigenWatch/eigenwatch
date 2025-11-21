import { Injectable, Logger } from "@nestjs/common";
import { createClient, RedisClientType } from "redis";
import { AppConfigService } from "../config/config.service";

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private client: RedisClientType;
  private isConnected = false;

  constructor(private config: AppConfigService) {}

  async onModuleInit() {
    try {
      this.client = createClient({
        url: this.config.redis.url,
      });

      this.client.on("error", (err) => {
        this.logger.error("Redis Client Error", err);
        this.isConnected = false;
      });

      this.client.on("connect", () => {
        this.logger.log("Redis connection established");
        this.isConnected = true;
      });

      await this.client.connect();
    } catch (error) {
      this.logger.error("Failed to connect to Redis", error);
      this.isConnected = false;
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
      this.logger.log("Redis connection closed");
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected) return null;

    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      this.logger.error(`Failed to get key: ${key}`, error);
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    if (!this.isConnected) return;

    try {
      const serialized = JSON.stringify(value);
      const ttlSeconds = ttl || this.config.redis.ttlDefault;
      await this.client.setEx(key, ttlSeconds, serialized);
    } catch (error) {
      this.logger.error(`Failed to set key: ${key}`, error);
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.isConnected) return;

    try {
      await this.client.del(key);
    } catch (error) {
      this.logger.error(`Failed to delete key: ${key}`, error);
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    if (!this.isConnected) return;

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch (error) {
      this.logger.error(`Failed to delete pattern: ${pattern}`, error);
    }
  }

  async getJSON<T>(key: string): Promise<T | null> {
    return this.get<T>(key);
  }

  async setJSON(key: string, value: any, ttl?: number): Promise<void> {
    return this.set(key, value, ttl);
  }

  async getTTL(key: string): Promise<number> {
    if (!this.isConnected) return -1;

    try {
      return await this.client.ttl(key);
    } catch (error) {
      this.logger.error(`Failed to get TTL for key: ${key}`, error);
      return -1;
    }
  }

  async setTTL(key: string, ttl: number): Promise<void> {
    if (!this.isConnected) return;

    try {
      await this.client.expire(key, ttl);
    } catch (error) {
      this.logger.error(`Failed to set TTL for key: ${key}`, error);
    }
  }

  async ping(): Promise<boolean> {
    if (!this.isConnected) return false;

    try {
      await this.client.ping();
      return true;
    } catch (error) {
      this.logger.error("Redis ping failed", error);
      return false;
    }
  }
}
