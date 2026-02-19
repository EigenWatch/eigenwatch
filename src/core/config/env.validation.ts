import { cleanEnv, str, num, url, makeValidator } from 'envalid';

const secret = makeValidator<string>((input) => {
  if (input.length < 32) throw new Error('Must be at least 32 chars');
  return input;
});

export const env = cleanEnv(process.env, {
  NODE_ENV: str({
    choices: ['development', 'staging', 'production'],
    default: 'development',
  }),
  PORT: num({ default: 3000 }),

  ANALYTICS_DATABASE_URL: url(),
  ANALYTICS_DATABASE_POOL_SIZE: num({ default: 10 }),

  USER_DATABASE_URL: url(),
  USER_DATABASE_POOL_SIZE: num({ default: 5 }),

  REDIS_URL: url(),
  REDIS_TTL_DEFAULT: num({ default: 300 }),

  JWT_SECRET: secret(),
  JWT_EXPIRES_IN: str({ default: '7d' }),

  DASHBOARD_API_KEY: secret(),

  RATE_LIMIT_TTL: num({ default: 60 }),
  RATE_LIMIT_MAX_REQUESTS: num({ default: 100 }),

  LOG_LEVEL: str({
    choices: ['debug', 'info', 'warn', 'error'],
    default: 'info',
  }),
  CORS_ORIGINS: str({ default: '*' }),
});

export type Environment = typeof env;
