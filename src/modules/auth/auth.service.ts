import {
  Injectable,
  Logger,
  HttpStatus,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { createHash, randomBytes } from "crypto";
import { SignatureVerificationService } from "./signature-verification.service";
import { DynamicJwtService } from "./dynamic-jwt.service";
import { UserRepository } from "./repositories/user.repository";
import { SessionRepository } from "./repositories/session.repository";
import { NonceRepository } from "./repositories/nonce.repository";
import { EmailRepository } from "./repositories/email.repository";
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
    private dynamicJwtService: DynamicJwtService,
    private userRepository: UserRepository,
    private sessionRepository: SessionRepository,
    private nonceRepository: NonceRepository,
    private emailRepository: EmailRepository,
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

    // 6b. Check beta perks ONLY for the primary email (if verified)
    const primaryEmail = user.emails?.find(
      (e) => e.is_primary && e.is_verified,
    );
    if (primaryEmail) {
      await this.betaService.checkAndActivateBetaPerks(
        user.id,
        primaryEmail.email,
      );
    }

    // Re-fetch user in case beta check upgraded their tier
    const freshUser = primaryEmail
      ? ((await this.userRepository.findById(user.id)) ?? user)
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
    const betaDiscount = await this.betaService.getBetaDiscount(freshUser.id);

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
      beta_discount: betaDiscount,
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

  async authenticateWithDynamic(
    token: string,
    ipAddress?: string,
    deviceInfo?: string,
  ): Promise<{
    tokens: JwtTokenPair;
    user: AuthUser;
    is_new_user: boolean;
  }> {
    // 1. Verify Dynamic JWT via JWKS
    const payload = await this.dynamicJwtService.verifyToken(token);

    // 2. Extract wallet address
    const walletAddress = this.dynamicJwtService.extractWalletAddress(payload);
    if (!walletAddress) {
      throw new AppException(
        ERROR_CODES.INVALID_WALLET_ADDRESS,
        "No wallet address found in Dynamic token. Please connect a wallet.",
        HttpStatus.BAD_REQUEST,
      );
    }

    // 3. Handle email from Dynamic (email-based wallet creation)
    const dynamicEmail = payload.email?.toLowerCase();
    const emailVerifiedByDynamic = payload.email_verified === true;

    if (dynamicEmail && emailVerifiedByDynamic) {
      // Check if this email already belongs to any account
      const existingEmail =
        await this.emailRepository.findByEmailGlobally(dynamicEmail);
      if (existingEmail && existingEmail.user.wallet_address !== walletAddress) {
        throw new AppException(
          ERROR_CODES.EMAIL_CONFLICT,
          "This email is already linked to another account. Please sign in with the wallet associated with that account, or use a different email.",
          HttpStatus.CONFLICT,
        );
      }
    }

    // 4. Find or create user
    const { user, isNew } =
      await this.userRepository.findOrCreate(walletAddress);

    // 5. Auto-add verified email if provided by Dynamic and no conflict
    if (dynamicEmail && emailVerifiedByDynamic) {
      const userHasThisEmail = await this.emailRepository.findByUserIdAndEmail(
        user.id,
        dynamicEmail,
      );
      if (!userHasThisEmail) {
        await this.emailRepository.addVerifiedPrimaryEmail(
          user.id,
          dynamicEmail,
        );
        this.logger.log(
          `Auto-added Dynamic-verified email: ${dynamicEmail} for user ${user.wallet_address}`,
        );
      }
    }

    // 6. Update last login
    await this.userRepository.updateLastLogin(user.id);

    // 7. Check beta perks
    const freshUserData = await this.userRepository.findById(user.id);
    const freshUser = freshUserData ?? user;

    const primaryEmail = freshUser.emails?.find(
      (e) => e.is_primary && e.is_verified,
    );
    if (primaryEmail) {
      await this.betaService.checkAndActivateBetaPerks(
        freshUser.id,
        primaryEmail.email,
      );
    }

    // Re-fetch in case beta check upgraded tier
    const finalUser = primaryEmail
      ? ((await this.userRepository.findById(freshUser.id)) ?? freshUser)
      : freshUser;

    // 8. Issue tokens
    const tokens = await this.issueTokenPair(
      finalUser.id,
      finalUser.wallet_address,
      finalUser.tier as UserTier,
      ipAddress,
      deviceInfo,
    );

    // 9. Build auth user response
    const unseenBetaPerks = await this.betaService.getUnseenPerks(finalUser.id);
    const isBetaMember = await this.betaService.isBetaMember(finalUser.id);
    const betaDiscount = await this.betaService.getBetaDiscount(finalUser.id);

    const authUser: AuthUser = {
      id: finalUser.id,
      wallet_address: finalUser.wallet_address,
      tier: finalUser.tier as UserTier,
      display_name: finalUser.display_name,
      email_verified: finalUser.emails?.some((e) => e.is_verified) ?? false,
      emails: finalUser.emails?.map((e) => ({
        id: e.id,
        email: e.email,
        is_verified: e.is_verified,
        is_primary: e.is_primary,
        created_at: e.created_at,
      })),
      created_at: finalUser.created_at.toISOString(),
      tier_expires_at: finalUser.tier_expires_at,
      beta_member: isBetaMember,
      beta_discount: betaDiscount,
      unseen_beta_perks: unseenBetaPerks,
    };

    this.logger.log(
      `User authenticated via Dynamic: ${finalUser.wallet_address} (${isNew ? "new" : "returning"})`,
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

    // Check beta perks ONLY for the primary email (if verified)
    const primaryEmail = user.emails?.find(
      (e) => e.is_primary && e.is_verified,
    );
    if (primaryEmail) {
      await this.betaService.checkAndActivateBetaPerks(
        user.id,
        primaryEmail.email,
      );
    }

    // Re-fetch user in case beta check upgraded their tier
    const freshUser = primaryEmail
      ? ((await this.userRepository.findById(user.id)) ?? user)
      : user;

    const tokens = await this.issueTokenPair(
      freshUser.id,
      freshUser.wallet_address,
      freshUser.tier as UserTier,
      ipAddress,
      deviceInfo,
    );

    const unseenBetaPerks = await this.betaService.getUnseenPerks(freshUser.id);
    const isBetaMember = await this.betaService.isBetaMember(freshUser.id);
    const betaDiscount = await this.betaService.getBetaDiscount(freshUser.id);

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
      preferences: freshUser.preferences,
      beta_member: isBetaMember,
      beta_discount: betaDiscount,
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
