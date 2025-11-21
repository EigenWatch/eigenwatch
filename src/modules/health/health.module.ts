import { Module } from "@nestjs/common";
import { DatabaseHealthService } from "src/core/database/database.health";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";

@Module({
  controllers: [HealthController],
  providers: [HealthService, DatabaseHealthService],
})
export class HealthModule {}
