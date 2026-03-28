import { Injectable, Logger, HttpStatus } from "@nestjs/common";
import { JwksClient } from "jwks-rsa";
import * as jwt from "jsonwebtoken";
import { AppConfigService } from "src/core/config/config.service";
import { AppException } from "src/shared/errors/app.exceptions";
import { ERROR_CODES } from "src/shared/constants/error-codes.constants";

export interface DynamicJwtPayload {
  sub: string;
  email?: string;
  email_verified?: boolean;
  environment_id: string;
  verified_credentials?: Array<{
    address?: string;
    chain?: string;
    format?: string;
    wallet_name?: string;
    name_service?: Record<string, unknown>;
  }>;
  iss: string;
  iat: number;
  exp: number;
}

@Injectable()
export class DynamicJwtService {
  private readonly logger = new Logger(DynamicJwtService.name);
  private readonly jwksClient: JwksClient;
  private readonly environmentId: string;

  constructor(private config: AppConfigService) {
    this.environmentId = config.dynamic.environmentId;
    this.jwksClient = new JwksClient({
      jwksUri: config.dynamic.jwksUrl,
      cache: true,
      cacheMaxAge: 600000, // 10 minutes
      rateLimit: true,
      jwksRequestsPerMinute: 10,
      timeout: 5000, // 5 second timeout for JWKS requests
    });
  }

  async verifyToken(token: string): Promise<DynamicJwtPayload> {
    try {
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded || !decoded.header.kid) {
        throw new AppException(
          ERROR_CODES.INVALID_JWT,
          "Invalid Dynamic token format",
          HttpStatus.UNAUTHORIZED,
        );
      }

      this.logger.debug(
        `Fetching signing key for kid: ${decoded.header.kid}...`,
      );
      const signingKey = await this.jwksClient.getSigningKey(
        decoded.header.kid,
      );
      this.logger.debug("Signing key fetched successfully.");
      const publicKey = signingKey.getPublicKey();

      this.logger.debug("Verifying token signature...");
      const payload = jwt.verify(token, publicKey, {
        algorithms: ["RS256"],
      }) as DynamicJwtPayload;
      this.logger.debug("Token signature verified.");

      // Validate environment ID matches
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

      if (
        error.code === "ETIMEDOUT" ||
        error.code === "ECONNREFUSED" ||
        error.code === "ENOTFOUND"
      ) {
        this.logger.error(
          `Network error reaching Dynamic JWKS endpoint: ${error.code}. Check DNS/connectivity to ${this.config.dynamic.jwksUrl}`,
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
}
