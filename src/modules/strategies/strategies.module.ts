import { Module } from "@nestjs/common";
import { StrategiesController } from "./strategies.controller";
import { StrategyService } from "./strategies.service";

@Module({
  controllers: [StrategiesController],
  providers: [StrategyService],
  exports: [StrategyService],
})
export class StrategiesModule {}
