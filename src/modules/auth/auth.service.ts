import { Injectable, Logger, HttpStatus } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { createHash, randomBytes } from "crypto";
import { SignatureVerificationService } from "./signature-verification.service";
import { UserRepository } from "./repositories/user.repository";
import { SessionRepository } from "./repositories/session.repository";
import { NonceRepository } from "./repositories/nonce.repository";
import { AppException } from "src/shared/errors/app.exceptions";
import { ERROR_CODES } from "src/shared/constants/error-codes.constants";
import { AppConfigService } from "src/core/config/config.service";
import {
  AuthUser,
  JwtPayload,
  JwtTokenPair,
  UserTier,
} from "src/shared/types/auth.types";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private jwtService: JwtService,
    private signatureVerification: SignatureVerificationService,
    private userRepository: UserRepository,
    private sessionRepository: SessionRepository,
    private nonceRepository: NonceRepository,
    private config: AppConfigService,
  ) {}

  async generateChallenge(address: string): Promise<{
    message: string;
    nonce: string;
    expires_at: string;
  }> {
    const nonce = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    const message = this.signatureVerification.generateMessage(nonce);

    // Ensure user exists before creating nonce (FK constraint)
    await this.userRepository.findOrCreate(address);

    await this.nonceRepository.create({
      walletAddress: address,
      nonce,
      message,
      expiresAt,
    });

    return {
      message,
      nonce,
      expires_at: expiresAt.toISOString(),
    };
  }

  async verifyAndAuthenticate(
    address: string,
    signature: string,
    nonce: string,
    ipAddress?: string,
    deviceInfo?: string,
  ): Promise<{
    tokens: JwtTokenPair;
    user: AuthUser;
    is_new_user: boolean;
  }> {
    // 1. Validate nonce
    const nonceRecord = await this.nonceRepository.findValidNonce(nonce);
    if (!nonceRecord) {
      throw new AppException(
        ERROR_CODES.NONCE_EXPIRED,
        "Nonce is invalid or expired. Please request a new challenge.",
        HttpStatus.BAD_REQUEST,
      );
    }

    // 2. Verify nonce matches address
    if (nonceRecord.wallet_address !== address.toLowerCase()) {
      throw new AppException(
        ERROR_CODES.INVALID_WALLET_ADDRESS,
        "Address does not match the challenge.",
        HttpStatus.BAD_REQUEST,
      );
    }

    // 3. Verify signature
    const isValid = await this.signatureVerification.verifySignature(
      nonceRecord.message,
      signature,
      address,
    );

    if (!isValid) {
      throw new AppException(
        ERROR_CODES.INVALID_SIGNATURE,
        "Signature verification failed.",
        HttpStatus.UNAUTHORIZED,
      );
    }

    // 4. Mark nonce as used
    await this.nonceRepository.markUsed(nonceRecord.id);

    // 5. Find or create user
    const { user, isNew } = await this.userRepository.findOrCreate(address);

    // 6. Update last login
    await this.userRepository.updateLastLogin(user.id);

    // 7. Issue tokens
    const tokens = await this.issueTokenPair(
      user.id,
      user.wallet_address,
      (user.tier as string).toLowerCase() as UserTier,
      ipAddress,
      deviceInfo,
    );

    // 8. Build auth user response
    const authUser: AuthUser = {
      id: user.id,
      wallet_address: user.wallet_address,
      tier: (user.tier as string).toLowerCase() as UserTier,
      email_verified: user.emails?.some((e) => e.is_verified) ?? false,
      emails: user.emails?.map((e) => ({
        id: e.id,
        email: e.email,
        is_verified: e.is_verified,
        is_primary: e.is_primary,
        created_at: e.created_at,
      })),
    };

    this.logger.log(
      `User authenticated: ${user.wallet_address} (${isNew ? "new" : "returning"})`,
    );

    return {
      tokens,
      user: authUser,
      is_new_user: isNew,
    };
  }

  async refreshTokens(
    refreshToken: string,
    ipAddress?: string,
    deviceInfo?: string,
  ): Promise<{
    tokens: JwtTokenPair;
    user: AuthUser;
  }> {
    const tokenHash = this.hashToken(refreshToken);
    const session = await this.sessionRepository.findByTokenHash(tokenHash);

    if (!session) {
      throw new AppException(
        ERROR_CODES.REFRESH_TOKEN_EXPIRED,
        "Refresh token is invalid or expired.",
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Revoke old session (token rotation)
    await this.sessionRepository.revoke(session.id);

    const user = session.user;
    const tokens = await this.issueTokenPair(
      user.id,
      user.wallet_address,
      (user.tier as string).toLowerCase() as UserTier,
      ipAddress,
      deviceInfo,
    );

    const authUser: AuthUser = {
      id: user.id,
      wallet_address: user.wallet_address,
      tier: (user.tier as string).toLowerCase() as UserTier,
      email_verified: user.emails?.some((e) => e.is_verified) ?? false,
      emails: user.emails?.map((e) => ({
        id: e.id,
        email: e.email,
        is_verified: e.is_verified,
        is_primary: e.is_primary,
        created_at: e.created_at,
      })),
    };

    return { tokens, user: authUser };
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    const session = await this.sessionRepository.findByTokenHash(tokenHash);
    if (session) {
      await this.sessionRepository.revoke(session.id);
    }
  }

  async logoutAll(userId: string): Promise<void> {
    await this.sessionRepository.revokeAllForUser(userId);
  }

  private async issueTokenPair(
    userId: string,
    walletAddress: string,
    tier: UserTier,
    ipAddress?: string,
    deviceInfo?: string,
  ): Promise<JwtTokenPair> {
    // Access token: short-lived (15 min)
    const accessPayload: Omit<JwtPayload, "iat" | "exp"> = {
      sub: userId,
      wallet_address: walletAddress,
      tier,
    };

    const accessToken = this.jwtService.sign(accessPayload, {
      expiresIn: "15m",
    });

    // Refresh token: long-lived (7 days)
    const refreshToken = randomBytes(64).toString("hex");
    const refreshTokenHash = this.hashToken(refreshToken);
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.sessionRepository.create({
      userId,
      refreshTokenHash,
      expiresAt: refreshExpiresAt,
      ipAddress,
      deviceInfo,
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}
