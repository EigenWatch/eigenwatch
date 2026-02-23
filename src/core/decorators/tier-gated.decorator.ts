import { SetMetadata } from "@nestjs/common";
import { UserTier } from "src/shared/types/auth.types";

export const TIER_GATED_KEY = "tierGated";
export const TierGated = (tier: Uppercase<UserTier>) =>
  SetMetadata(TIER_GATED_KEY, tier.toUpperCase());
