import { Module, forwardRef } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AppConfigService } from "src/core/config/config.service";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { EmailService } from "./email.service";
import { JwtStrategy } from "./jwt.strategy";
import { DynamicJwtService } from "./dynamic-jwt.service";
import { UserRepository } from "./repositories/user.repository";
import { SessionRepository } from "./repositories/session.repository";
import { EmailRepository } from "./repositories/email.repository";
import { EmailTransportService } from "./email-transport.service";
import { BetaModule } from "../beta/beta.module";

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        secret: config.auth.jwtSecret,
        signOptions: { expiresIn: "7d" },
      }),
    }),
    forwardRef(() => BetaModule),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    EmailService,
    EmailTransportService,
    DynamicJwtService,
    JwtStrategy,
    UserRepository,
    SessionRepository,
    EmailRepository,
  ],
  exports: [AuthService, UserRepository, EmailTransportService],
})
export class AuthModule {}
