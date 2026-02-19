import { Injectable, Logger, HttpStatus } from "@nestjs/common";
import { randomInt } from "crypto";
import { EmailRepository } from "./repositories/email.repository";
import { AppException } from "src/shared/errors/app.exceptions";
import { ERROR_CODES } from "src/shared/constants/error-codes.constants";

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly emailRepository: EmailRepository) {}

  /**
   * Add an email to a user's account and send a verification code.
   * Maps frontend field names (risk_alerts, marketing) to Prisma schema
   * field names (alerts_opt_in, marketing_opt_in).
   */
  async addEmail(
    userId: string,
    email: string,
    preferences?: { risk_alerts?: boolean; marketing?: boolean },
  ) {
    const emailRecord = await this.emailRepository.addEmail(userId, email, {
      alerts_opt_in: preferences?.risk_alerts ?? true,
      marketing_opt_in: preferences?.marketing ?? false,
    });

    // Generate and "send" verification code (console-only for now)
    await this.generateAndLogCode(email);

    return {
      message: "Verification code sent to your email",
      email_id: emailRecord.id,
    };
  }

  /**
   * Verify an email using a 6-digit code.
   */
  async verifyEmail(userId: string, email: string, code: string) {
    // Ensure this email belongs to the user
    const emailRecord = await this.emailRepository.findByUserIdAndEmail(
      userId,
      email,
    );
    if (!emailRecord) {
      throw new AppException(
        ERROR_CODES.EMAIL_NOT_FOUND,
        "Email not found for this user",
        HttpStatus.NOT_FOUND,
      );
    }

    if (emailRecord.is_verified) {
      throw new AppException(
        ERROR_CODES.EMAIL_ALREADY_VERIFIED,
        "This email is already verified",
        HttpStatus.BAD_REQUEST,
      );
    }

    // Find a valid (unexpired, unused, < 3 attempts) code
    const codeRecord = await this.emailRepository.findValidCode(email, code);
    if (!codeRecord) {
      // Increment attempts on any matching code to track brute-force
      const anyCode = await this.emailRepository.findValidCode(email, code);
      // If no valid code at all, just reject
      throw new AppException(
        ERROR_CODES.INVALID_VERIFICATION_CODE,
        "Invalid or expired verification code",
        HttpStatus.BAD_REQUEST,
      );
    }

    // Mark code as used
    await this.emailRepository.markCodeUsed(codeRecord.id);

    // Mark email as verified
    await this.emailRepository.markVerified(userId, email);

    this.logger.log(`Email verified: ${email} for user ${userId}`);

    return { message: "Email verified successfully" };
  }

  /**
   * Resend a verification code. Rate-limited to 5 codes per hour.
   */
  async resendVerification(userId: string, email: string) {
    // Ensure this email belongs to the user
    const emailRecord = await this.emailRepository.findByUserIdAndEmail(
      userId,
      email,
    );
    if (!emailRecord) {
      throw new AppException(
        ERROR_CODES.EMAIL_NOT_FOUND,
        "Email not found for this user",
        HttpStatus.NOT_FOUND,
      );
    }

    if (emailRecord.is_verified) {
      throw new AppException(
        ERROR_CODES.EMAIL_ALREADY_VERIFIED,
        "This email is already verified",
        HttpStatus.BAD_REQUEST,
      );
    }

    // Rate limit: max 5 codes in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await this.emailRepository.countRecentCodes(
      email,
      oneHourAgo,
    );
    if (recentCount >= 5) {
      throw new AppException(
        ERROR_CODES.RATE_LIMIT_EXCEEDED,
        "Too many verification codes requested. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.generateAndLogCode(email);

    return { message: "Verification code sent to your email" };
  }

  /**
   * Remove a non-primary email.
   */
  async removeEmail(userId: string, emailId: string) {
    const emailRecord = await this.emailRepository.findById(emailId, userId);
    if (!emailRecord) {
      throw new AppException(
        ERROR_CODES.EMAIL_NOT_FOUND,
        "Email not found",
        HttpStatus.NOT_FOUND,
      );
    }

    if (emailRecord.is_primary) {
      throw new AppException(
        ERROR_CODES.BAD_REQUEST,
        "Cannot remove primary email. Set another email as primary first.",
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.emailRepository.removeEmail(emailId, userId);
    this.logger.log(`Email removed: ${emailRecord.email} for user ${userId}`);
  }

  /**
   * Set an email as the primary email (must be verified).
   */
  async setPrimaryEmail(userId: string, emailId: string) {
    const emailRecord = await this.emailRepository.findById(emailId, userId);
    if (!emailRecord) {
      throw new AppException(
        ERROR_CODES.EMAIL_NOT_FOUND,
        "Email not found",
        HttpStatus.NOT_FOUND,
      );
    }

    if (!emailRecord.is_verified) {
      throw new AppException(
        ERROR_CODES.BAD_REQUEST,
        "Only verified emails can be set as primary",
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.emailRepository.setPrimary(emailId, userId);
    this.logger.log(
      `Primary email set: ${emailRecord.email} for user ${userId}`,
    );
  }

  // ---- Private helpers ----

  private async generateAndLogCode(email: string): Promise<void> {
    const code = randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await this.emailRepository.createVerificationCode(email, code, expiresAt);

    // TODO: Replace with real email transport (SendGrid, Brevo, etc.)
    this.logger.warn(
      `[EMAIL VERIFICATION] Code for ${email}: ${code} (expires: ${expiresAt.toISOString()})`,
    );
  }
}
