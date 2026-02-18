import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { UserController } from "./user.controller";
import { UserService } from "./user.service";
import { PreferencesRepository } from "./preferences.repository";
import { SessionRepository } from "../auth/repositories/session.repository";

@Module({
  imports: [AuthModule],
  controllers: [UserController],
  providers: [UserService, PreferencesRepository, SessionRepository],
})
export class UserModule {}
