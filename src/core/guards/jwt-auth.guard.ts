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

    this.logger.debug(`JWT validation required → ${method} ${url}`);
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any) {
    if (err || !user) {
      this.logger.warn(
        `JWT authentication failed → ${err?.message ?? "No user object returned"}`
      );
      throw err || new UnauthorizedException("Invalid token");
    }

    this.logger.debug(`JWT authentication successful`);
    return user;
  }
}
