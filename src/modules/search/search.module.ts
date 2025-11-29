// ============================================================================
// NEW FILE: SRC/MODULES/SEARCH/SEARCH.MODULE.TS
// ============================================================================
import { Module } from "@nestjs/common";
import { SearchController } from "./search.controller";
import { SearchService } from "./search.service";
import { SearchRepository } from "./repositories/search.repository";
import { SearchMapper } from "./mappers/search.mapper";

@Module({
  controllers: [SearchController],
  providers: [SearchService, SearchRepository, SearchMapper],
  exports: [SearchService],
})
export class SearchModule {}
