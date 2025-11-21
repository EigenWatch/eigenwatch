/* eslint-disable @typescript-eslint/no-explicit-any */
import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AppConfigService } from "src/core/config/config.service";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./jwt.strategy";
import { SignatureVerificationService } from "./signature-verification.service";

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        secret: config.auth.jwtSecret,
        signOptions: { expiresIn: config.auth.jwtExpiresIn as any },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, SignatureVerificationService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
