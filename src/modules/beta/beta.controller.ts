import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { RequireAuth } from "src/core/decorators/require-auth.decorator";
import { CurrentUser } from "src/core/decorators/current-user.decorator";
import { AuthUser } from "src/shared/types/auth.types";
import { BetaService } from "./beta.service";

@ApiTags("Beta")
@Controller("beta")
@ApiBearerAuth()
@RequireAuth()
export class BetaController {
  constructor(private readonly betaService: BetaService) {}

  // --- User Endpoints ---

  @Get("perks/unseen")
  @ApiOperation({ summary: "Get unseen beta perk notifications" })
  async getUnseenPerks(@CurrentUser() user: AuthUser) {
    return this.betaService.getUnseenPerks(user.id);
  }

  @Post("perks/:perkId/seen")
  @ApiOperation({ summary: "Mark a beta perk notification as seen" })
  async markPerkSeen(
    @CurrentUser() user: AuthUser,
    @Param("perkId") perkId: string,
  ) {
    return this.betaService.markPerkSeen(user.id, perkId);
  }

  @Get("status")
  @ApiOperation({ summary: "Get current user beta status and active perks" })
  async getBetaStatus(@CurrentUser() user: AuthUser) {
    return this.betaService.getBetaStatus(user.id);
  }

  // --- Admin Endpoints ---

  @Post("admin/members")
  @ApiOperation({ summary: "Add an email to the beta program" })
  async addBetaMember(@Body() body: { email: string; notes?: string }) {
    return this.betaService.addBetaMember(body.email, body.notes);
  }

  @Delete("admin/members/:email")
  @ApiOperation({ summary: "Remove an email from the beta program" })
  async removeBetaMember(@Param("email") email: string) {
    return this.betaService.removeBetaMember(email);
  }

  @Get("admin/members")
  @ApiOperation({ summary: "List all beta members" })
  async listBetaMembers() {
    return this.betaService.listBetaMembers();
  }

  @Get("admin/perks")
  @ApiOperation({ summary: "List all beta perks with config" })
  async listPerks() {
    return this.betaService.listPerks();
  }

  @Put("admin/perks/:key")
  @ApiOperation({
    summary: "Update a beta perk config (e.g. discount %, enable/disable)",
  })
  async updatePerk(
    @Param("key") key: string,
    @Body() body: { is_active?: boolean; config?: any; description?: string },
  ) {
    return this.betaService.updatePerk(key, body);
  }
}
