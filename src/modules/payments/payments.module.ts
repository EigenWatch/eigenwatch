import { Module } from "@nestjs/common";
import { PaymentsService } from "./payments.service";
import { ChainrailsService } from "./chainrails.service";
import { TierManagementService } from "./tier-management.service";
import { PaymentsController } from "./payments.controller";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  providers: [PaymentsService, ChainrailsService, TierManagementService],
  controllers: [PaymentsController],
  exports: [PaymentsService, ChainrailsService],
})
export class PaymentsModule {}
