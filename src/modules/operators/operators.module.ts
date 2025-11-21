import { Module } from "@nestjs/common";
import { OperatorsController } from "./operators.controller";
import { OperatorService } from "./operators.service";
import { PrismaOperatorRepository } from "./repositories/operators.repository";

@Module({
  controllers: [OperatorsController],
  providers: [
    OperatorService,
    {
      provide: "OperatorRepository",
      useClass: PrismaOperatorRepository,
    },
  ],
  exports: [OperatorService],
})
export class OperatorsModule {}
