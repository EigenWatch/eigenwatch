import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { TIER_GATED_KEY } from "../decorators/tier-gated.decorator";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { AppException } from "src/shared/errors/app.exceptions";
import { ERROR_CODES } from "src/shared/constants/error-codes.constants";
import { AuthUser, UserTier } from "src/shared/types/auth.types";

const TIER_HIERARCHY: Record<UserTier, number> = {
  FREE: 0,
  PRO: 1,
  ENTERPRISE: 2,
};

@Injectable()
export class TierGuard implements CanActivate {
  private readonly logger = new Logger(TierGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredTier = this.reflector.getAllAndOverride<UserTier>(
      TIER_GATED_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No tier requirement on this route
    if (!requiredTier) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser | null;
    const userTier: UserTier = user?.tier ?? "FREE";

    const userLevel = TIER_HIERARCHY[userTier] ?? 0;
    const requiredLevel = TIER_HIERARCHY[requiredTier] ?? 0;

    if (userLevel < requiredLevel) {
      this.logger.debug(
        `Tier guard blocked: user=${userTier}, required=${requiredTier}`,
      );
      throw new AppException(
        ERROR_CODES.TIER_REQUIRED,
        `This feature requires ${requiredTier} tier or higher. Upgrade to unlock.`,
        HttpStatus.FORBIDDEN,
        {
          required_tier: requiredTier.toLowerCase(),
          current_tier: userTier.toLowerCase(),
          upgrade_url: "/settings/subscription",
        },
      );
    }

    return true;
  }
}
