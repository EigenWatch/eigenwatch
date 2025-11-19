import { Injectable } from '@nestjs/common';
import { env } from './env.validation';

@Injectable()
export class AppConfigService {
  // No constructor injection needed anymore!

  get server() {
    return {
      nodeEnv: env.NODE_ENV,
      port: env.PORT,
      isDevelopment: env.NODE_ENV === 'development',
      isProduction: env.NODE_ENV === 'production',
      isStaging: env.NODE_ENV === 'staging',
    };
  }

  get database() {
    return {
      url: env.DATABASE_URL,
      poolSize: env.DATABASE_POOL_SIZE,
    };
  }

  get redis() {
    return {
      url: env.REDIS_URL,
      ttlDefault: env.REDIS_TTL_DEFAULT,
    };
  }

  get auth() {
    return {
      jwtSecret: env.JWT_SECRET,
      jwtExpiresIn: env.JWT_EXPIRES_IN,
    };
  }

  get apiKeys() {
    return {
      dashboard: env.DASHBOARD_API_KEY,
    };
  }

  get logging() {
    return {
      level: env.LOG_LEVEL,
    };
  }

  get rateLimit() {
    return {
      ttl: env.RATE_LIMIT_TTL,
      maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
    };
  }

  get cors() {
    const origins = env.CORS_ORIGINS;
    return {
      origins: origins === '*' ? '*' : origins.split(',').map((o) => o.trim()),
    };
  }
}
