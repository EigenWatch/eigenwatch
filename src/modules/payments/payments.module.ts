import { Module } from "@nestjs/common";
import { PaymentsService } from "./payments.service";
import { ChainrailsService } from "./chainrails.service";
import { TierManagementService } from "./tier-management.service";
import { PaymentRepository } from "./payment.repository";
import { PaymentsController } from "./payments.controller";
import { AuthModule } from "../auth/auth.module";
import { BetaModule } from "../beta/beta.module";
import { PricingService } from "./pricing.service";

@Module({
  imports: [AuthModule, BetaModule],
  providers: [
    PaymentsService,
    ChainrailsService,
    PricingService,
    TierManagementService,
    PaymentRepository,
  ],
  controllers: [PaymentsController],
  exports: [
    PaymentsService,
    ChainrailsService,
    PricingService,
    PaymentRepository,
  ],
})
export class PaymentsModule {}
