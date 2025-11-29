import { Module } from "@nestjs/common";
import { NetworkService } from "./network.service";
import { NetworkController } from "./network.controller";
import { NetworkRepository } from "./repositories/network.repository";
import { NetworkMapper } from "./mappers/network.mapper";
import { PrismaService } from "@/core/database/prisma.service";

@Module({
  controllers: [NetworkController],
  providers: [NetworkService, NetworkRepository, NetworkMapper, PrismaService],
  exports: [NetworkService],
})
export class NetworkModule {}
