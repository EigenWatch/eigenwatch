import { Global, Module } from "@nestjs/common";
import { PrismaAnalyticsService } from "./prisma-analytics.service";
import { PrismaUserService } from "./prisma-user.service";

@Global()
@Module({
  providers: [PrismaAnalyticsService, PrismaUserService],
  exports: [PrismaAnalyticsService, PrismaUserService],
})
export class PrismaModule {}
