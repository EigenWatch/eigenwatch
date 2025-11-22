// We only import the env once at startup — this throws early if anything is wrong
import * as dotenv from "dotenv";
dotenv.config();
import { AppConfigService } from "./config.service";
import { Global, Module } from "@nestjs/common";

@Global()
@Module({
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
