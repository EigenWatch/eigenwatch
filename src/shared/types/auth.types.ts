export type UserTier = "FREE" | "PRO" | "ENTERPRISE";

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

export interface UnseenBetaPerk {
  id: string;
  key: string;
  description: string;
  activated_at: string;
  metadata?: any;
}

export interface AuthUser {
  id: string;
  wallet_address: string;
  tier: UserTier;
  email_verified: boolean;
  display_name?: string;
  avatar_url?: string;
  emails?: UserEmail[];
  preferences?: any;
  created_at?: string;
  tier_expires_at?: Date | null;
  beta_member?: boolean;
  beta_discount?: number | null;
  unseen_beta_perks?: UnseenBetaPerk[];
}

export interface JwtTokenPair {
  access_token: string;
  refresh_token: string;
}
