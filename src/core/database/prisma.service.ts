/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  HttpStatus,
} from "@nestjs/common";
import { AppConfigService } from "../config/config.service";
import { ERROR_CODES } from "src/shared/constants/error-codes.constants";
import { AppException } from "src/shared/errors/app.exceptions";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(private config: AppConfigService) {
    super({
      adapter: new PrismaPg({
        connectionString: `${process.env.DATABASE_URL}`,
      }),
      log: [
        { level: "query", emit: "event" },
        { level: "error", emit: "event" },
        { level: "warn", emit: "event" },
      ],
    });

    // Setup query logging
    this.$on("query" as any, (e: any) => {
      if (config.server.isDevelopment) {
        this.logger.debug(
          `Query: ${e.query} - Params: ${e.params} - Duration: ${e.duration}ms`
        );
      }

      // Log slow queries in production
      if (e.duration > 1000) {
        this.logger.warn(
          `Slow query detected: ${e.query} - Duration: ${e.duration}ms`
        );
      }
    });

    this.$on("error" as any, (e: any) => {
      this.logger.error(`Prisma error: ${e.message}`, e.stack);
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log("Database connection established");
      await this.verifyReadOnly();
    } catch (error) {
      this.logger.error("Failed to connect to database", error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log("Database connection closed");
  }

  private async verifyReadOnly() {
    try {
      await this.$queryRaw`SELECT 1`;
      this.logger.log("Read-only verification passed");
    } catch (error) {
      this.logger.error("Read-only verification failed", error);
    }
  }

  async executeSafe<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      this.logger.error("Database query failed", error);

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        switch (error.code) {
          case "P2025":
            throw new AppException(
              ERROR_CODES.NOT_FOUND,
              "Record not found",
              HttpStatus.NOT_FOUND
            );
          case "P2024":
            throw new AppException(
              ERROR_CODES.DATABASE_ERROR,
              "Connection timeout",
              HttpStatus.GATEWAY_TIMEOUT
            );
          default:
            throw new AppException(
              ERROR_CODES.DATABASE_ERROR,
              "Database operation failed",
              HttpStatus.INTERNAL_SERVER_ERROR,
              { prismaCode: error.code }
            );
        }
      }

      throw error;
    }
  }
}
