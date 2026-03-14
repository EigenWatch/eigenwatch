import { Injectable } from "@nestjs/common";
import { env } from "./env.validation";

@Injectable()
export class AppConfigService {
  // No constructor injection needed anymore!

  get server() {
    return {
      nodeEnv: env.NODE_ENV,
      port: env.PORT,
      isDevelopment: env.NODE_ENV === "development",
      isProduction: env.NODE_ENV === "production",
      isStaging: env.NODE_ENV === "staging",
    };
  }

  get analyticsDatabase() {
    return {
      url: env.ANALYTICS_DATABASE_URL,
      poolSize: env.ANALYTICS_DATABASE_POOL_SIZE,
    };
  }

  get userDatabase() {
    return {
      url: env.USER_DATABASE_URL,
      poolSize: env.USER_DATABASE_POOL_SIZE,
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
      origins: origins === "*" ? "*" : origins.split(",").map((o) => o.trim()),
    };
  }

  get email() {
    return {
      brevo: {
        apiKey: env.BREVO_API_KEY,
        senderEmail: env.BREVO_SENDER_EMAIL,
        senderName: env.BREVO_SENDER_NAME,
      },
      smtp: {
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
        fromEmail: env.SMTP_FROM_EMAIL,
        fromName: env.SMTP_FROM_NAME,
      },
    };
  }

  get payments() {
    return {
      baseRpcUrl: env.BASE_RPC_URL,
      alchemyApiKey: env.ALCHEMY_API_KEY,
      infuraApiKey: env.INFURA_API_KEY,
      adminWalletAddress: env.ADMIN_WALLET_ADDRESS,
      proPriceUsdc: env.PRO_PRICE_USDC,
      usdcAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base USDC
      usdtAddress: "0xfde4C96c8593536e31f229ea8f37b2ada2699bb2", // Base USDT
      paystack: {
        secretKey: env.PAYSTACK_SECRET_KEY,
        callbackUrl: env.PAYSTACK_CALLBACK_URL,
        proPriceUsd: env.PRO_PRICE_USD,
      },
      flutterwave: {
        secretKey: env.FLUTTERWAVE_SECRET_KEY,
        publicKey: env.FLUTTERWAVE_PUBLIC_KEY,
        planId: env.FLUTTERWAVE_PLAN_ID,
        redirectUrl: env.FLUTTERWAVE_REDIRECT_URL,
        webhookHash: env.FLUTTERWAVE_WEBHOOK_HASH,
      },
      chainrails: {
        apiKey: env.CHAINRAILS_API_KEY,
        webhookSecret: env.CHAINRAILS_WEBHOOK_SECRET,
        environment: env.CHAINRAILS_ENVIRONMENT,
      },
    };
  }
}
