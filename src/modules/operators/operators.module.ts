import { Module } from "@nestjs/common";
import { OperatorsController } from "./operators.controller";
import { OperatorMapper } from "./mappers/operator.mapper";
import { OperatorService } from "./operators.service";
import { PrismaOperatorRepository } from "./repositories/operators.repository";
import { OperatorStrategyRepository } from "./repositories/operator-strategy.repository";
import { OperatorDelegatorRepository } from "./repositories/operator-delegator.repository";
import { OperatorAVSRepository } from "./repositories/operator-avs.repository";
import { OperatorAllocationRepository } from "./repositories/operator-allocation.repository";
import { OperatorAnalyticsRepository } from "./repositories/operator-analytics.repository";

@Module({
  controllers: [OperatorsController],
  providers: [
    OperatorService,
    PrismaOperatorRepository,
    OperatorStrategyRepository,
    OperatorDelegatorRepository,
    OperatorAVSRepository,
    OperatorAllocationRepository,
    OperatorAnalyticsRepository,
    OperatorMapper,
  ],
  exports: [OperatorService],
})
export class OperatorsModule {}
