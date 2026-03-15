import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { Public } from "src/core/decorators/public.decorator";
import { SkipApiKey } from "src/core/decorators/skip-api-key.decorator";
import { AdminAuthGuard } from "src/core/guards/admin-auth.guard";
import { BetaService } from "../../beta/beta.service";

@ApiTags("Admin Beta")
@Controller("admin/beta")
@Public()
@SkipApiKey()
@UseGuards(AdminAuthGuard)
@ApiBearerAuth()
export class AdminBetaController {
  constructor(private readonly betaService: BetaService) {}

  @Get("members")
  @ApiOperation({ summary: "List all beta members with pagination" })
  async listMembers(@Query("page") page = "1", @Query("limit") limit = "20") {
    return this.betaService.listBetaMembers(
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @Post("members")
  @ApiOperation({ summary: "Add an email to the beta program" })
  async addMember(@Body() body: { email: string; notes?: string }) {
    return this.betaService.addBetaMember(body.email, body.notes);
  }

  @Delete("members/:email")
  @ApiOperation({ summary: "Remove an email from the beta program" })
  async removeMember(@Param("email") email: string) {
    return this.betaService.removeBetaMember(email);
  }

  @Get("perks")
  @ApiOperation({ summary: "List all beta perks" })
  async listPerks() {
    return this.betaService.listPerks();
  }

  @Put("perks/:key")
  @ApiOperation({ summary: "Update a beta perk" })
  async updatePerk(
    @Param("key") key: string,
    @Body() body: { is_active?: boolean; config?: any; description?: string },
  ) {
    return this.betaService.updatePerk(key, body);
  }

  @Post("perks/seed")
  @ApiOperation({ summary: "Seed default beta perks if they do not exist" })
  async seedPerks() {
    return this.betaService.seedPerks();
  }
}
