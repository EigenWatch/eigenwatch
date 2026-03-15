import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { AppConfigService } from "src/core/config/config.service";

export interface AdminJwtPayload {
  email: string;
  isAdmin: true;
  iat: number;
  exp: number;
}

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, "admin-jwt") {
  constructor(config: AppConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.auth.jwtSecret,
    });
  }

  async validate(payload: AdminJwtPayload) {
    if (!payload.isAdmin) {
      throw new UnauthorizedException("Not an admin token");
    }
    return { email: payload.email, isAdmin: true };
  }
}
