import { Injectable } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

export interface DatabaseHealthResult {
  status: "healthy" | "unhealthy";
  responseTime: number;
  error?: string;
}

@Injectable()
export class DatabaseHealthService {
  constructor(private prisma: PrismaService) {}

  async check(): Promise<DatabaseHealthResult> {
    const startTime = Date.now();

    try {
      await this.prisma.$queryRaw`SELECT 1`;
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
