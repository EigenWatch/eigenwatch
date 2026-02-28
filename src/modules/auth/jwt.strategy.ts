import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { AppConfigService } from "src/core/config/config.service";
import { UserRepository } from "./repositories/user.repository";
import { CacheService } from "@/core/cache/cache.service";
import { AuthUser, JwtPayload } from "src/shared/types/auth.types";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private static readonly AUTH_USER_CACHE_TTL = 60; // 1 minute

  constructor(
    config: AppConfigService,
    private userRepository: UserRepository,
    private cacheService: CacheService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.auth.jwtSecret,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const cacheKey = `auth:user:${payload.sub}`;
    const cached = await this.cacheService.get<AuthUser>(cacheKey);
    if (cached) return cached;

    const user = await this.userRepository.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    const authUser: AuthUser = {
      id: user.id,
      wallet_address: user.wallet_address,
      tier: (user.tier as string).toUpperCase() as AuthUser["tier"],
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      email_verified: user.emails?.some((e) => e.is_verified) ?? false,
      emails: user.emails?.map((e) => ({
        id: e.id,
        email: e.email,
        is_verified: e.is_verified,
        is_primary: e.is_primary,
        created_at: e.created_at,
      })),
      preferences: user.preferences,
      created_at: user.created_at.toISOString(),
    };

    await this.cacheService.set(
      cacheKey,
      authUser,
      JwtStrategy.AUTH_USER_CACHE_TTL,
    );

    return authUser;
  }
}
