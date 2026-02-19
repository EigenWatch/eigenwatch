/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { REQUIRE_AUTH_KEY } from "../decorators/require-auth.decorator";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;

    this.logger.debug(`JWT Guard activated → ${method} ${url}`);

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      this.logger.debug(
        `Route marked @Public → skipping JWT → ${method} ${url}`
      );
      return true;
    }

    this.logger.debug(`JWT extraction attempt → ${method} ${url}`);
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    // Check if this route strictly requires authentication
    const requireAuth = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_AUTH_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requireAuth) {
      // Strict mode: must have valid JWT
      if (err || !user) {
        this.logger.warn(
          `JWT required but failed → ${err?.message ?? "No token provided"}`,
        );
        throw err || new UnauthorizedException("Authentication required");
      }
      return user;
    }

    // Optional mode (default): extract user if token present, null otherwise
    if (err) {
      this.logger.debug(
        `JWT error (non-fatal, optional auth) → ${err.message}`,
      );
      return null;
    }

    if (!user) {
      this.logger.debug("No JWT provided → anonymous request");
      return null;
    }

    this.logger.debug(`JWT authentication successful → user: ${user.id}`);
    return user;
  }
}
