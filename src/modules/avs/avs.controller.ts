/* eslint-disable @typescript-eslint/no-unused-vars */
import { Controller, Get, Param } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";

@ApiTags("AVS")
@Controller("avs")
export class AVSController {
  @Get()
  @ApiOperation({ summary: "Get all AVS" })
  async findAll() {
    return [];
  }

  @Get(":id")
  @ApiOperation({ summary: "Get AVS by ID" })
  async findOne(@Param("id") id: string) {
    return null;
  }

  @Get(":id/operators")
  @ApiOperation({ summary: "Get operators for AVS" })
  async getOperators(@Param("id") id: string) {
    return [];
  }
}
