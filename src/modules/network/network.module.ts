import { Module } from "@nestjs/common";
import { NetworkService } from "./network.service";
import { NetworkController } from "./network.controller";
import { NetworkRepository } from "./repositories/network.repository";
import { NetworkMapper } from "./mappers/network.mapper";

@Module({
  controllers: [NetworkController],
  providers: [NetworkService, NetworkRepository, NetworkMapper],
  exports: [NetworkService],
})
export class NetworkModule {}
