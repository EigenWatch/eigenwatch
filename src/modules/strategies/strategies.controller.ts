/* eslint-disable @typescript-eslint/no-unused-vars */
import { Controller, Get, Param } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";

@ApiTags("Strategies")
@Controller("strategies")
export class StrategiesController {
  @Get()
  @ApiOperation({ summary: "Get all strategies" })
  async findAll() {
    return [];
  }

  @Get(":address")
  @ApiOperation({ summary: "Get strategy by address" })
  async findOne(@Param("address") address: string) {
    return null;
  }

  @Get(":address/operators")
  @ApiOperation({ summary: "Get operators for strategy" })
  async getOperators(@Param("address") address: string) {
    return [];
  }
}
