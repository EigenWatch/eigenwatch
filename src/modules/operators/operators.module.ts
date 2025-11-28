import { Module } from "@nestjs/common";
import { OperatorsController } from "./operators.controller";
import { OperatorMapper } from "./mappers/operator.mapper";
import { OperatorService } from "./operators.service";
import { PrismaOperatorRepository } from "./repositories/operators.repository";

@Module({
  controllers: [OperatorsController],
  providers: [
    OperatorService,
    OperatorMapper,
    {
      provide: "OperatorRepository",
      useClass: PrismaOperatorRepository,
    },
  ],
  exports: [OperatorService],
})
export class OperatorsModule {}
