import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { Request } from "express";
import { CurrentUser } from "src/core/decorators/current-user.decorator";
import { Public } from "src/core/decorators/public.decorator";
import { SkipApiKey } from "src/core/decorators/skip-api-key.decorator";
import { AuthService } from "./auth.service";
import {
  ChallengeRequestDto,
  VerifySignatureDto,
  RefreshTokenDto,
} from "./dto/auth.dto";
import { AuthUser } from "src/shared/types/auth.types";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

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
  async verify(@Body() body: VerifySignatureDto, @Req() req: Request) {
    const ipAddress = req.ip;
    const deviceInfo = req.headers["user-agent"];

    return this.authService.verifyAndAuthenticate(
      body.address,
      body.signature,
      body.nonce,
      ipAddress,
      deviceInfo,
    );
  }

  @Post("refresh")
  @Public()
  @SkipApiKey()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Refresh access token using refresh token" })
  async refresh(@Body() body: RefreshTokenDto, @Req() req: Request) {
    const ipAddress = req.ip;
    const deviceInfo = req.headers["user-agent"];

    return this.authService.refreshTokens(
      body.refresh_token,
      ipAddress,
      deviceInfo,
    );
  }

  @Post("logout")
  @Public()
  @SkipApiKey()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Logout and revoke refresh token" })
  async logout(@Body() body: RefreshTokenDto) {
    await this.authService.logout(body.refresh_token);
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
}
