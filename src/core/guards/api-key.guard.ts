import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { SKIP_API_KEY } from "../decorators/skip-api-key.decorator";
import { AppConfigService } from "../config/config.service";
import { InvalidApiKeyException } from "src/shared/errors/app.exceptions";

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(
    private reflector: Reflector,
    private config: AppConfigService
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;

    this.logger.debug(`Checking API key → ${method} ${url}`);

    const skipApiKey = this.reflector.getAllAndOverride<boolean>(SKIP_API_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipApiKey) {
      this.logger.debug(`Skipping API key validation for ${method} ${url}`);
      return true;
    }

    const apiKey = request.headers["x-api-key"];

    if (!apiKey) {
      this.logger.warn(`Missing API key for ${method} ${url}`);
      throw new InvalidApiKeyException();
    }

    const validApiKeys = [this.config.apiKeys.dashboard];

    if (!validApiKeys.includes(apiKey)) {
      this.logger.warn(
        `Invalid API key provided for ${method} ${url} → received: "${apiKey}"`
      );
      throw new InvalidApiKeyException();
    }

    this.logger.debug(`Valid API key for ${method} ${url}`);
    return true;
  }
}
