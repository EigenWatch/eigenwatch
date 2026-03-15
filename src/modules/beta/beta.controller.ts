import {
  Controller,
  Get,
  Post,
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
}
