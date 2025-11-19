// src/logger/logger.service.ts
import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import pino from 'pino';
import { env } from '../config/env.validation';

@Injectable()
export class LoggerService implements NestLoggerService {
  private readonly logger: pino.Logger;

  constructor() {
    const isDevelopment = env.NODE_ENV === 'development';

    this.logger = pino({
      level: env.LOG_LEVEL,

      // Pretty print only in development
      transport: isDevelopment
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss',
              ignore: 'pid,hostname',
              singleLine: true,
            },
          }
        : undefined,

      // Optional: add some useful defaults
      base: {
        env: env.NODE_ENV,
        // you can add service name, version, etc.
      },
    });
  }

  log(message: any, context?: string) {
    this.logger.info({ context }, message);
  }

  error(message: any, trace?: string, context?: string) {
    this.logger.error({ context, trace }, message);
  }

  warn(message: any, context?: string) {
    this.logger.warn({ context }, message);
  }

  debug(message: any, context?: string) {
    this.logger.debug({ context }, message);
  }

  verbose(message: any, context?: string) {
    this.logger.trace({ context }, message);
  }

  // Bonus: child logger (very useful!)
  child(bindings: Record<string, any>): LoggerService {
    const childLogger = this.logger.child(bindings);
    return Object.assign(Object.create(Object.getPrototypeOf(this)), this, {
      logger: childLogger,
    }) as LoggerService;
  }
}
