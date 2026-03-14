import { Module } from "@nestjs/common";
import { PaymentsService } from "./payments.service";
import { ChainrailsService } from "./chainrails.service";
import { TierManagementService } from "./tier-management.service";
import { PaymentRepository } from "./payment.repository";
import { PaymentsController } from "./payments.controller";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  providers: [
    PaymentsService,
    ChainrailsService,
    TierManagementService,
    PaymentRepository,
  ],
  controllers: [PaymentsController],
  exports: [PaymentsService, ChainrailsService, PaymentRepository],
})
export class PaymentsModule {}
