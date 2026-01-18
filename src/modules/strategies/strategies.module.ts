import { Module } from "@nestjs/common";
import { StrategiesController } from "./strategies.controller";
import { StrategiesService } from "./strategies.service";
import { StrategiesRepository } from "./repositories/strategies.repository";
import { StrategyMapper } from "./mappers/strategy.mapper";

@Module({
  controllers: [StrategiesController],
  providers: [StrategiesService, StrategiesRepository, StrategyMapper],
  exports: [StrategiesService],
})
export class StrategiesModule {}
