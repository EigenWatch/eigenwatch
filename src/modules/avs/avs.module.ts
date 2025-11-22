import { Module } from "@nestjs/common";
import { AVSController } from "./avs.controller";
import { AVSService } from "./avs.service";

@Module({
  controllers: [AVSController],
  providers: [AVSService],
  exports: [AVSService],
})
export class AVSModule {}
