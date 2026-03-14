import { Module, forwardRef } from "@nestjs/common";
import { BetaService } from "./beta.service";
import { BetaRepository } from "./beta.repository";
import { BetaController } from "./beta.controller";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [forwardRef(() => AuthModule)],
  providers: [BetaService, BetaRepository],
  controllers: [BetaController],
  exports: [BetaService],
})
export class BetaModule {}
