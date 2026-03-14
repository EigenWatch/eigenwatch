import { Injectable, Logger, HttpStatus, Inject, forwardRef } from "@nestjs/common";
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
import { BetaService } from "../beta/beta.service";

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
    @Inject(forwardRef(() => BetaService))
    private betaService: BetaService,
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

    // 6b. Check beta perks for verified emails (catches users added to beta after registration)
    const verifiedEmails = user.emails?.filter((e) => e.is_verified) ?? [];
    for (const email of verifiedEmails) {
      await this.betaService.checkAndActivateBetaPerks(user.id, email.email);
    }

    // Re-fetch user in case beta check upgraded their tier
    const freshUser = verifiedEmails.length > 0
      ? await this.userRepository.findById(user.id) ?? user
      : user;

    // 7. Issue tokens
    const tokens = await this.issueTokenPair(
      freshUser.id,
      freshUser.wallet_address,
      freshUser.tier as UserTier,
      ipAddress,
      deviceInfo,
    );

    // 8. Get unseen beta perks for the response
    const unseenBetaPerks = await this.betaService.getUnseenPerks(freshUser.id);
    const isBetaMember = await this.betaService.isBetaMember(freshUser.id);

    // 9. Build auth user response
    const authUser: AuthUser = {
      id: freshUser.id,
      wallet_address: freshUser.wallet_address,
      tier: freshUser.tier as UserTier,
      display_name: freshUser.display_name,
      email_verified: freshUser.emails?.some((e) => e.is_verified) ?? false,
      emails: freshUser.emails?.map((e) => ({
        id: e.id,
        email: e.email,
        is_verified: e.is_verified,
        is_primary: e.is_primary,
        created_at: e.created_at,
      })),
      created_at: freshUser.created_at.toISOString(),
      tier_expires_at: freshUser.tier_expires_at,
      beta_member: isBetaMember,
      unseen_beta_perks: unseenBetaPerks,
    };

    this.logger.log(
      `User authenticated: ${freshUser.wallet_address} (${isNew ? "new" : "returning"})`,
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
      user.tier as UserTier,
      ipAddress,
      deviceInfo,
    );

    const unseenBetaPerks = await this.betaService.getUnseenPerks(user.id);
    const isBetaMember = await this.betaService.isBetaMember(user.id);

    const authUser: AuthUser = {
      id: user.id,
      wallet_address: user.wallet_address,
      tier: user.tier as UserTier,
      display_name: user.display_name,
      email_verified: user.emails?.some((e) => e.is_verified) ?? false,
      emails: user.emails?.map((e) => ({
        id: e.id,
        email: e.email,
        is_verified: e.is_verified,
        is_primary: e.is_primary,
        created_at: e.created_at,
      })),
      created_at: user.created_at.toISOString(),
      tier_expires_at: user.tier_expires_at,
      preferences: user.preferences,
      beta_member: isBetaMember,
      unseen_beta_perks: unseenBetaPerks,
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
      expiresIn: "7d",
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
