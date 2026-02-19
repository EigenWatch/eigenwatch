export type UserTier = "free" | "pro" | "enterprise";

export interface JwtPayload {
  sub: string; // User ID
  wallet_address: string;
  tier: UserTier;
  iat: number;
  exp: number;
}

export interface UserEmail {
  id: string;
  email: string;
  is_verified: boolean;
  is_primary: boolean;
  created_at: Date;
}

export interface AuthUser {
  id: string;
  wallet_address: string;
  tier: UserTier;
  email_verified: boolean;
  emails?: UserEmail[];
}

export interface JwtTokenPair {
  access_token: string;
  refresh_token: string;
}
