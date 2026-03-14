import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AppConfigService } from "src/core/config/config.service";
import { AdminJwtStrategy } from "./strategies/admin-jwt.strategy";
import { AdminAuthService } from "./admin-auth.service";
import { AdminAuthController } from "./admin-auth.controller";
import { AdminRepository } from "./admin.repository";
import { AdminUsersController } from "./controllers/admin-users.controller";
import { AdminFeedbackController } from "./controllers/admin-feedback.controller";
import { AdminStatsController } from "./controllers/admin-stats.controller";
import { AdminBetaController } from "./controllers/admin-beta.controller";
import { AdminPaymentsController } from "./controllers/admin-payments.controller";
import { BetaModule } from "../beta/beta.module";
import { PaymentsModule } from "../payments/payments.module";

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: "admin-jwt" }),
    JwtModule.registerAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        secret: config.auth.jwtSecret,
        signOptions: { expiresIn: "8h" },
      }),
    }),
    BetaModule,
    PaymentsModule,
  ],
  controllers: [
    AdminAuthController,
    AdminUsersController,
    AdminFeedbackController,
    AdminStatsController,
    AdminBetaController,
    AdminPaymentsController,
  ],
  providers: [AdminAuthService, AdminJwtStrategy, AdminRepository],
})
export class AdminModule {}
