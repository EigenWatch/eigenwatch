import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { AppConfigService } from "src/core/config/config.service";
import { UserRepository } from "./repositories/user.repository";
import { AuthUser, JwtPayload } from "src/shared/types/auth.types";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: AppConfigService,
    private userRepository: UserRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.auth.jwtSecret,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.userRepository.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    return {
      id: user.id,
      wallet_address: user.wallet_address,
      tier: user.tier as AuthUser["tier"],
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
  }
}
