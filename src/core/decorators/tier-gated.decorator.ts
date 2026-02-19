import { SetMetadata } from "@nestjs/common";
import { UserTier } from "src/shared/types/auth.types";

export const TIER_GATED_KEY = "tierGated";
export const TierGated = (tier: Lowercase<UserTier>) =>
  SetMetadata(TIER_GATED_KEY, tier.toUpperCase());
