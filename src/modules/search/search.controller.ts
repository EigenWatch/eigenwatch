/* eslint-disable @typescript-eslint/no-unused-vars */
import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";

@ApiTags("Search")
@Controller("search")
export class SearchController {
  @Get()
  @ApiOperation({ summary: "Global search across entities" })
  async search(@Query("q") query: string) {
    return [];
  }
}
