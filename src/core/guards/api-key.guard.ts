import { Injectable, CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { SKIP_API_KEY } from "../decorators/skip-api-key.decorator";
import { AppConfigService } from "../config/config.service";
import { InvalidApiKeyException } from "src/shared/errors/app.exceptions";

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private config: AppConfigService
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const skipApiKey = this.reflector.getAllAndOverride<boolean>(SKIP_API_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipApiKey) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers["x-api-key"];

    if (!apiKey) {
      throw new InvalidApiKeyException();
    }

    // Validate against configured API keys
    const validApiKeys = [this.config.apiKeys.dashboard];

    if (!validApiKeys.includes(apiKey)) {
      throw new InvalidApiKeyException();
    }

    return true;
  }
}
