import { Injectable, Logger, HttpStatus } from "@nestjs/common";
import * as jwt from "jsonwebtoken";
import * as crypto from "crypto";
import axios from "axios";
import { AppConfigService } from "src/core/config/config.service";
import { AppException } from "src/shared/errors/app.exceptions";
import { ERROR_CODES } from "src/shared/constants/error-codes.constants";

export interface DynamicVerifiedCredential {
  id: string;
  address?: string;
  chain?: string;
  email?: string;
  format?: string;
  wallet_name?: string;
  wallet_provider?: string;
  name_service?: Record<string, unknown>;
  public_identifier?: string;
  embedded_wallet_id?: string | null;
  ref_id?: string;
  signer_ref_id?: string;
  oauth_provider?: string;
  oauth_username?: string;
  oauth_display_name?: string;
  oauth_account_id?: string;
}

export interface DynamicJwtPayload {
  sub: string;
  aud?: string;
  email?: string;
  environment_id: string;
  alias?: string;
  given_name?: string;
  family_name?: string;
  lists?: string[];
  verified_credentials?: DynamicVerifiedCredential[];
  verified_account?: {
    id: string;
    address?: string;
    chain?: string;
    wallet_name?: string;
  };
  iss: string;
  iat: number;
  exp: number;
  scope?: string;
}

interface JwksKey {
  kty: string;
  kid: string;
  use?: string;
  n: string;
  e: string;
  alg?: string;
}

interface JwksResponse {
  keys: JwksKey[];
}

@Injectable()
export class DynamicJwtService {
  private readonly logger = new Logger(DynamicJwtService.name);
  private readonly environmentId: string;
  private readonly jwksUrl: string;
  private readonly staticPublicKey: string | null;

  // In-memory JWKS cache
  private cachedKeys: JwksKey[] | null = null;
  private cacheExpiresAt = 0;
  private readonly cacheTtlMs = 10 * 60 * 1000; // 10 minutes

  constructor(private config: AppConfigService) {
    this.environmentId = config.dynamic.environmentId;
    this.jwksUrl = config.dynamic.jwksUrl;

    // .env files store PEM keys with literal \n — convert to real newlines
    const rawKey = config.dynamic.publicKey;
    this.staticPublicKey = rawKey ? rawKey.replace(/\\n/g, "\n") : null;

    if (this.staticPublicKey) {
      this.logger.log(
        "Using static DYNAMIC_PUBLIC_KEY for JWT verification (no JWKS fetch needed).",
      );
    }
  }

  /**
   * Fetch JWKS from Dynamic's endpoint (with caching).
   * Uses axios instead of native fetch — axios uses Node's http/https modules
   * which handle IPv6→IPv4 fallback correctly (undici/fetch does not).
   */
  private async fetchJwks(): Promise<JwksKey[]> {
    // Return cached keys if still valid
    if (this.cachedKeys && Date.now() < this.cacheExpiresAt) {
      return this.cachedKeys;
    }

    this.logger.debug(`Fetching JWKS from ${this.jwksUrl}...`);

    const { data } = await axios.get<JwksResponse>(this.jwksUrl, {
      timeout: 15_000, // 15s timeout
      headers: { Accept: "application/json" },
    });

    if (!data.keys || !Array.isArray(data.keys) || data.keys.length === 0) {
      throw new Error("JWKS response contains no keys");
    }

    // Cache the keys
    this.cachedKeys = data.keys;
    this.cacheExpiresAt = Date.now() + this.cacheTtlMs;

    this.logger.debug(
      `JWKS fetched successfully. ${data.keys.length} key(s) cached.`,
    );
    return data.keys;
  }

  /**
   * Convert a JWK (RSA) to a PEM public key string.
   */
  private jwkToPem(jwk: JwksKey): string {
    const keyObject = crypto.createPublicKey({
      key: {
        kty: jwk.kty,
        n: jwk.n,
        e: jwk.e,
      },
      format: "jwk",
    });

    return keyObject.export({ type: "spki", format: "pem" }) as string;
  }

  /**
   * Get the PEM public key for a given kid.
   * Always fetches from JWKS endpoint for production reliability.
   * Static key fallback is commented out — re-enable only for local dev if needed.
   */
  private async getPublicKey(kid: string): Promise<string> {
    // Static key fallback — commented out so JWKS is always used in production
    // if (this.staticPublicKey) {
    //   return this.staticPublicKey;
    // }

    const keys = await this.fetchJwks();
    const matchingKey = keys.find((k) => k.kid === kid);

    if (!matchingKey) {
      // Invalidate cache and retry once — the key may have rotated
      this.cachedKeys = null;
      const freshKeys = await this.fetchJwks();
      const retryKey = freshKeys.find((k) => k.kid === kid);

      if (!retryKey) {
        throw new AppException(
          ERROR_CODES.INVALID_JWT,
          `No matching signing key found for kid: ${kid}`,
          HttpStatus.UNAUTHORIZED,
        );
      }

      return this.jwkToPem(retryKey);
    }

    return this.jwkToPem(matchingKey);
  }

  async verifyToken(token: string): Promise<DynamicJwtPayload> {
    try {
      // 1. Decode header to extract kid
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded || !decoded.header.kid) {
        throw new AppException(
          ERROR_CODES.INVALID_JWT,
          "Invalid Dynamic token format: missing kid in header",
          HttpStatus.UNAUTHORIZED,
        );
      }

      this.logger.debug(
        `Fetching signing key for kid: ${decoded.header.kid}...`,
      );

      // 2. Get the public key for this kid
      const publicKey = await this.getPublicKey(decoded.header.kid);

      // 3. Verify the token signature and expiration
      const decodedToken = jwt.verify(token, publicKey, {
        algorithms: ["RS256"],
        ignoreExpiration: false,
      });

      this.logger.debug("Token signature verified.");
      const payload = decodedToken as DynamicJwtPayload;

      // 4. Verify scope includes user:basic
      const scopes = (payload.scope || "").split(" ");
      if (!scopes.includes("user:basic")) {
        throw new AppException(
          ERROR_CODES.INVALID_JWT,
          "Authentication incomplete — scope does not include user:basic",
          HttpStatus.UNAUTHORIZED,
        );
      }

      // 5. Validate environment ID matches
      if (payload.environment_id !== this.environmentId) {
        this.logger.error(
          `Dynamic JWT environment mismatch! Configured: ${this.environmentId}, Received: ${payload.environment_id}`,
        );
        throw new AppException(
          ERROR_CODES.INVALID_JWT,
          `Token environment mismatch (configured: ${this.environmentId}, got: ${payload.environment_id})`,
          HttpStatus.UNAUTHORIZED,
        );
      }

      this.logger.debug("Dynamic JWT verification complete.");
      return payload;
    } catch (error: any) {
      if (error instanceof AppException) throw error;

      this.logger.error(
        `Dynamic JWT verification failed! Error type: ${error.name}, Message: ${error.message || "NONE"}, Stack: ${error.stack}`,
      );

      // Network errors (axios uses error.code for ETIMEDOUT, etc.)
      const networkCode = error.code || error.cause?.code || "";
      if (
        error.name === "AbortError" ||
        networkCode === "ETIMEDOUT" ||
        networkCode === "ECONNREFUSED" ||
        networkCode === "ENOTFOUND" ||
        networkCode === "ECONNABORTED"
      ) {
        this.logger.error(
          `Network error reaching Dynamic JWKS endpoint: ${networkCode || error.name}. Check DNS/connectivity to ${this.jwksUrl}`,
        );
        throw new AppException(
          ERROR_CODES.INVALID_JWT,
          "Unable to verify Dynamic token: authentication service unreachable. Please try again.",
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      if (error.name === "TokenExpiredError") {
        throw new AppException(
          ERROR_CODES.JWT_EXPIRED,
          "Dynamic token has expired. Please sign in again.",
          HttpStatus.UNAUTHORIZED,
        );
      }

      throw new AppException(
        ERROR_CODES.INVALID_JWT,
        `Dynamic token verification failed: ${error.message || "Unknown error"}`,
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  /**
   * Extract the wallet address from Dynamic JWT verified credentials.
   */
  extractWalletAddress(payload: DynamicJwtPayload): string | null {
    const walletCredential = payload.verified_credentials?.find(
      (cred) => cred.address && cred.format === "blockchain",
    );
    return walletCredential?.address?.toLowerCase() ?? null;
  }

  /**
   * Extract the verified email from Dynamic JWT verified credentials.
   * An email is considered verified if it appears as a credential with format "email".
   */
  extractVerifiedEmail(
    payload: DynamicJwtPayload,
  ): { email: string; verified: true } | null {
    const emailCredential = payload.verified_credentials?.find(
      (cred) => cred.format === "email" && cred.email,
    );
    if (emailCredential?.email) {
      return { email: emailCredential.email.toLowerCase(), verified: true };
    }
    return null;
  }
}
