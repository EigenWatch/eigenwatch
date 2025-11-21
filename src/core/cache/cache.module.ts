import { Module, Global } from "@nestjs/common";
import { CacheService } from "./cache.service";
import { CacheKeyBuilder } from "./cache-key.builder";

@Global()
@Module({
  providers: [CacheService, CacheKeyBuilder],
  exports: [CacheService, CacheKeyBuilder],
})
export class CacheModule {}
