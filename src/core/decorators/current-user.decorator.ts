import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { AuthUser } from "src/shared/types/auth.types";

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AuthUser | null => {
    const request = ctx.switchToHttp().getRequest();
    return request.user ?? null;
  },
);
