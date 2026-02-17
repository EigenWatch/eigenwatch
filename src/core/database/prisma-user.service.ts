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
import { Prisma, PrismaClient } from ".prisma/user-client";

@Injectable()
export class PrismaUserService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaUserService.name);

  constructor(private config: AppConfigService) {
    super({
      adapter: new PrismaPg({
        connectionString: `${process.env.USER_DATABASE_URL}`,
      }),
      log: [
        { level: "query", emit: "event" },
        { level: "error", emit: "event" },
        { level: "warn", emit: "event" },
      ],
    });

    this.$on("query" as any, (e: any) => {
      if (config.server.isDevelopment) {
        this.logger.debug(
          `[UserDB] Query: ${e.query} - Duration: ${e.duration}ms`
        );
      }

      if (e.duration > 1000) {
        this.logger.warn(
          `[UserDB] Slow query detected: ${e.query} - Duration: ${e.duration}ms`
        );
      }
    });

    this.$on("error" as any, (e: any) => {
      this.logger.error(`[UserDB] Prisma error: ${e.message}`, e.stack);
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log("User database connection established");
    } catch (error) {
      this.logger.error("Failed to connect to user database", error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log("User database connection closed");
  }

  async executeSafe<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      this.logger.error("[UserDB] Database query failed", error);

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        switch (error.code) {
          case "P2025":
            throw new AppException(
              ERROR_CODES.NOT_FOUND,
              "Record not found",
              HttpStatus.NOT_FOUND
            );
          case "P2002":
            throw new AppException(
              ERROR_CODES.VALIDATION_ERROR,
              "Record already exists",
              HttpStatus.CONFLICT
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
