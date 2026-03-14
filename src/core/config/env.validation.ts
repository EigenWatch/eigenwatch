import { cleanEnv, str, num, url, makeValidator } from "envalid";

const secret = makeValidator<string>((input) => {
  if (input.length < 32) throw new Error("Must be at least 32 chars");
  return input;
});

export const env = cleanEnv(process.env, {
  NODE_ENV: str({
    choices: ["development", "staging", "production"],
    default: "development",
  }),
  PORT: num({ default: 3000 }),

  ANALYTICS_DATABASE_URL: url(),
  ANALYTICS_DATABASE_POOL_SIZE: num({ default: 10 }),

  USER_DATABASE_URL: url(),
  USER_DATABASE_POOL_SIZE: num({ default: 5 }),

  REDIS_URL: url(),
  REDIS_TTL_DEFAULT: num({ default: 300 }),

  JWT_SECRET: secret(),
  JWT_EXPIRES_IN: str({ default: "7d" }),

  DASHBOARD_API_KEY: secret(),

  RATE_LIMIT_TTL: num({ default: 60 }),
  RATE_LIMIT_MAX_REQUESTS: num({ default: 100 }),

  LOG_LEVEL: str({
    choices: ["debug", "info", "warn", "error"],
    default: "info",
  }),
  CORS_ORIGINS: str({ default: "*" }),

  // Email - Brevo (Primary)
  BREVO_API_KEY: str({ default: "" }),
  BREVO_SENDER_EMAIL: str({ default: "noreply@eigenwatch.xyz" }),
  BREVO_SENDER_NAME: str({ default: "EigenWatch" }),

  // Email - SMTP Fallback (Google)
  SMTP_HOST: str({ default: "smtp.gmail.com" }),
  SMTP_PORT: num({ default: 587 }),
  SMTP_USER: str({ default: "" }),
  SMTP_PASS: str({ default: "" }),
  SMTP_FROM_EMAIL: str({ default: "" }),
  SMTP_FROM_NAME: str({ default: "EigenWatch" }),

  // Payments
  BASE_RPC_URL: str({ default: "https://mainnet.base.org" }),
  ALCHEMY_API_KEY: str({ default: "" }),
  INFURA_API_KEY: str({ default: "" }),
  ADMIN_WALLET_ADDRESS: str({
    default: "0x0000000000000000000000000000000000000000",
  }),
  PRO_PRICE_USDC: str({ default: "20" }),

  // Paystack
  PAYSTACK_SECRET_KEY: str({ default: "" }),
  PAYSTACK_CALLBACK_URL: str({ default: "http://localhost:3000/settings" }),
  PRO_PRICE_USD: str({ default: "20" }),

  // Flutterwave
  FLUTTERWAVE_SECRET_KEY: str({ default: "" }),
  FLUTTERWAVE_PUBLIC_KEY: str({ default: "" }),
  FLUTTERWAVE_PLAN_ID: str({ default: "" }),
  FLUTTERWAVE_REDIRECT_URL: str({ default: "http://localhost:3000/settings" }),
  FLUTTERWAVE_WEBHOOK_HASH: str({ default: "" }),

  // Chainrails
  CHAINRAILS_API_KEY: str({ default: "" }),
  CHAINRAILS_WEBHOOK_SECRET: str({ default: "" }),
  CHAINRAILS_ENVIRONMENT: str({
    choices: ["live", "test"],
    default: "test",
  }),
});

export type Environment = typeof env;
