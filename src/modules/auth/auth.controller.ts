import {
  Controller,
  Post,
  Get,
  Delete,
  Put,
  Body,
  Param,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { Request, Response } from "express";
import { CurrentUser } from "src/core/decorators/current-user.decorator";
import { Public } from "src/core/decorators/public.decorator";
import { RequireAuth } from "src/core/decorators/require-auth.decorator";
import { SkipApiKey } from "src/core/decorators/skip-api-key.decorator";
import { AuthService } from "./auth.service";
import { EmailService } from "./email.service";
import {
  ChallengeRequestDto,
  VerifySignatureDto,
  RefreshTokenDto,
} from "./dto/auth.dto";
import {
  AddEmailDto,
  VerifyEmailDto,
  ResendVerificationDto,
} from "./dto/email.dto";
import { AuthUser } from "src/shared/types/auth.types";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(
    private authService: AuthService,
    private emailService: EmailService,
  ) {}

  @Post("challenge")
  @Public()
  @SkipApiKey()
  @ApiOperation({ summary: "Get challenge message for wallet signature" })
  async getChallenge(@Body() body: ChallengeRequestDto) {
    return this.authService.generateChallenge(body.address);
  }

  @Post("verify")
  @Public()
  @SkipApiKey()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Verify signature and issue JWT tokens" })
  async verify(
    @Body() body: VerifySignatureDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipAddress = req.ip;
    const deviceInfo = req.headers["user-agent"];

    const result = await this.authService.verifyAndAuthenticate(
      body.address,
      body.signature,
      body.nonce,
      ipAddress,
      deviceInfo,
    );

    // Set refresh token as HttpOnly cookie
    res.cookie("refresh_token", result.tokens.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax", // Allows cookie to be sent on top-level navigation
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/",
    });

    return result;
  }

  @Post("refresh")
  @Public()
  @SkipApiKey()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Refresh access token using refresh token" })
  async refresh(
    @Body() body: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipAddress = req.ip;
    const deviceInfo = req.headers["user-agent"];

    // Try to get token from body or cookie
    const refreshToken = body.refresh_token || req.cookies?.refresh_token;

    if (!refreshToken) {
      throw new UnauthorizedException("No refresh token provided");
    }

    const result = await this.authService.refreshTokens(
      refreshToken,
      ipAddress,
      deviceInfo,
    );

    // Set new refresh token as cookie (rotation)
    res.cookie("refresh_token", result.tokens.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    return result;
  }

  @Post("logout")
  @Public()
  @SkipApiKey()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Logout and revoke refresh token" })
  async logout(
    @Body() body: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = body.refresh_token || req.cookies?.refresh_token;

    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }

    // Clear cookie
    res.clearCookie("refresh_token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
  }

  @Post("logout-all")
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Logout from all sessions" })
  async logoutAll(@CurrentUser() user: AuthUser) {
    await this.authService.logoutAll(user.id);
  }

  @Get("me")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current user information" })
  async getCurrentUser(@CurrentUser() user: AuthUser) {
    return user;
  }

  // ==================== EMAIL ====================

  @Post("email/add")
  @RequireAuth()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Add an email address and send verification code" })
  async addEmail(@CurrentUser() user: AuthUser, @Body() body: AddEmailDto) {
    return this.emailService.addEmail(user.id, body.email, {
      risk_alerts: body.risk_alerts,
      marketing: body.marketing,
    });
  }

  @Post("email/verify")
  @RequireAuth()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Verify an email with a 6-digit code" })
  async verifyEmailAddress(
    @CurrentUser() user: AuthUser,
    @Body() body: VerifyEmailDto,
  ) {
    return this.emailService.verifyEmail(user.id, body.email, body.code);
  }

  @Post("email/resend")
  @RequireAuth()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Resend email verification code" })
  async resendVerification(
    @CurrentUser() user: AuthUser,
    @Body() body: ResendVerificationDto,
  ) {
    return this.emailService.resendVerification(user.id, body.email);
  }

  @Delete("email/:id")
  @RequireAuth()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Remove an email address" })
  async removeEmail(
    @CurrentUser() user: AuthUser,
    @Param("id") emailId: string,
  ) {
    await this.emailService.removeEmail(user.id, emailId);
  }

  @Put("email/:id/primary")
  @RequireAuth()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Set an email as primary" })
  async setPrimaryEmail(
    @CurrentUser() user: AuthUser,
    @Param("id") emailId: string,
  ) {
    await this.emailService.setPrimaryEmail(user.id, emailId);
  }
}
