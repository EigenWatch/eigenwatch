import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AppConfigService } from "src/core/config/config.service";

@Injectable()
export class AdminAuthService {
  constructor(
    private config: AppConfigService,
    private jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    const adminEmail = this.config.admin.email;
    const adminPassword = this.config.admin.password;

    if (!adminEmail || !adminPassword) {
      throw new UnauthorizedException("Admin auth not configured");
    }

    if (email !== adminEmail || password !== adminPassword) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const payload = { email, isAdmin: true };
    const accessToken = this.jwtService.sign(payload, { expiresIn: "8h" });

    return { access_token: accessToken };
  }

  getProfile(admin: { email: string; isAdmin: boolean }) {
    return { email: admin.email, isAdmin: admin.isAdmin };
  }
}
