export type UserTier = "free" | "pro" | "enterprise";

export interface JwtPayload {
  sub: string; // User ID
  wallet_address: string;
  tier: UserTier;
  iat: number;
  exp: number;
}

export interface AuthUser {
  id: string;
  wallet_address: string;
  tier: UserTier;
  email_verified: boolean;
}

export interface JwtTokenPair {
  access_token: string;
  refresh_token: string;
}
