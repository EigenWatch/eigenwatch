import { Module, MiddlewareConsumer, NestModule } from "@nestjs/common";
import { APP_PIPE, APP_INTERCEPTOR, APP_FILTER, APP_GUARD } from "@nestjs/core";
import { AppConfigModule } from "./core/config/config.module";
import { LoggerModule } from "./core/logging/logger.module";
import { PrismaModule } from "./core/database/prisma.module";
import { CacheModule } from "./core/cache/cache.module";
import { RequestLoggerMiddleware } from "./core/logging/request-logger.middleware";
import { ValidationPipe } from "./core/pipes/validation.pipe";
import { ResponseInterceptor } from "./core/interceptors/response.interceptor";
import { LoggingInterceptor } from "./core/interceptors/logging.interceptor";
import { GlobalExceptionFilter } from "./core/filters/global-exception.filter";
import { PrismaExceptionFilter } from "./core/filters/prisma-exception.filter";
import { ApiKeyGuard } from "./core/guards/api-key.guard";
import { JwtAuthGuard } from "./core/guards/jwt-auth.guard";
import { RolesGuard } from "./core/guards/roles.guard";
// import { AuthModule } from "./modules/auth/auth.module";
import { OperatorsModule } from "./modules/operators/operators.module";
import { HealthModule } from "./modules/health/health.module";
// import { AVSModule } from "./modules/avs/avs.module";
// import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { SearchModule } from "./modules/search/search.module";
import { NetworkModule } from "./modules/network/network.module";
import { StrategiesModule } from "./modules/strategies/strategies.module";

@Module({
  imports: [
    AppConfigModule,
    LoggerModule,
    PrismaModule,
    CacheModule,
    // AuthModule,
    OperatorsModule,
    // AVSModule,
    // AnalyticsModule,
    SearchModule,
    NetworkModule,
    StrategiesModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: PrismaExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ApiKeyGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes("*");
  }
}
