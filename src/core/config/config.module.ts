import { Global, Module } from '@nestjs/common';

// We only import the env once at startup — this throws early if anything is wrong
import '@/env'; // ← this line runs your envalid validation immediately
import { AppConfigService } from './config.service';

@Global()
@Module({
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
