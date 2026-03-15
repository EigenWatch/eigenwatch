import { SetMetadata } from "@nestjs/common";

export const REQUIRE_AUTH_KEY = "requireAuth";
export const RequireAuth = (isRequired = true) =>
  SetMetadata(REQUIRE_AUTH_KEY, isRequired);
