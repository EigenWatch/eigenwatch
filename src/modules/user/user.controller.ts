import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { CurrentUser } from "src/core/decorators/current-user.decorator";
import { RequireAuth } from "src/core/decorators/require-auth.decorator";
import { AuthUser } from "src/shared/types/auth.types";
import { UserService } from "./user.service";
import { UpdateProfileDto, UpdatePreferencesDto } from "./dto/user.dto";

@ApiTags("User")
@Controller("user")
@ApiBearerAuth()
@RequireAuth()
export class UserController {
  constructor(private userService: UserService) {}

  // ==================== PROFILE ====================

  @Put("profile")
  @ApiOperation({ summary: "Update user profile" })
  async updateProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.userService.updateProfile(user.id, dto);
  }

  // ==================== PREFERENCES ====================

  @Get("preferences")
  @ApiOperation({ summary: "Get user preferences" })
  async getPreferences(@CurrentUser() user: AuthUser) {
    return this.userService.getPreferences(user.id);
  }

  @Put("preferences")
  @ApiOperation({ summary: "Update user preferences" })
  async updatePreferences(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.userService.updatePreferences(user.id, dto);
  }

  // ==================== SESSIONS ====================

  @Get("sessions")
  @ApiOperation({ summary: "List active sessions" })
  async getSessions(@CurrentUser() user: AuthUser) {
    return this.userService.getSessions(user.id);
  }

  @Delete("sessions/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Revoke a specific session" })
  async revokeSession(
    @CurrentUser() user: AuthUser,
    @Param("id") sessionId: string,
  ) {
    await this.userService.revokeSession(user.id, sessionId);
  }

  @Delete("sessions")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Revoke all other sessions" })
  async revokeAllSessions(@CurrentUser() user: AuthUser) {
    await this.userService.revokeAllSessions(user.id);
  }

  // ==================== ACCOUNT ====================

  @Delete("account")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete user account" })
  async deleteAccount(@CurrentUser() user: AuthUser) {
    await this.userService.deleteAccount(user.id);
  }
}
