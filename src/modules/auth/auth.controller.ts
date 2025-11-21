/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Controller, Post, Get, Body } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { CurrentUser } from "src/core/decorators/current-user.decorator";
import { Public } from "src/core/decorators/public.decorator";
import { SkipApiKey } from "src/core/decorators/skip-api-key.decorator";
import { AuthService } from "./auth.service";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post("challenge")
  @Public()
  @SkipApiKey()
  @ApiOperation({ summary: "Get challenge message for wallet signature" })
  async getChallenge(@Body() body: { address: string }) {
    // TODO: Implement challenge generation
    return {
      challenge: "Sign this message to authenticate",
      nonce: "random-nonce",
    };
  }

  @Post("verify")
  @Public()
  @SkipApiKey()
  @ApiOperation({ summary: "Verify signature and issue JWT token" })
  async verify(
    @Body() body: { address: string; signature: string; nonce: string }
  ) {
    // TODO: Implement signature verification and JWT issuance
    return {
      access_token: "jwt-token",
      user: {
        address: body.address,
      },
    };
  }

  @Get("me")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current user information" })
  async getCurrentUser(@CurrentUser() user: any) {
    // TODO: Return user information
    return user;
  }
}
