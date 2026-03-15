import { Module, forwardRef } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AppConfigService } from "src/core/config/config.service";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { EmailService } from "./email.service";
import { JwtStrategy } from "./jwt.strategy";
import { SignatureVerificationService } from "./signature-verification.service";
import { UserRepository } from "./repositories/user.repository";
import { SessionRepository } from "./repositories/session.repository";
import { NonceRepository } from "./repositories/nonce.repository";
import { EmailRepository } from "./repositories/email.repository";
import { EmailTransportService } from "./email-transport.service";
import { BetaModule } from "../beta/beta.module";
import { PaymentsModule } from "../payments/payments.module";

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
    SignatureVerificationService,
    JwtStrategy,
    UserRepository,
    SessionRepository,
    NonceRepository,
    EmailRepository,
  ],
  exports: [AuthService, UserRepository],
})
export class AuthModule {}
