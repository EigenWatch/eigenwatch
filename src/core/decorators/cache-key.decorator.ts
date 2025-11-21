/* eslint-disable @typescript-eslint/no-explicit-any */
import { SetMetadata } from "@nestjs/common";

export const CACHE_KEY_METADATA = "cacheKey";
export const CACHE_TTL_METADATA = "cacheTTL";

export interface CacheKeyOptions {
  ttl?: number;
}

export const CacheKey = (key: string, options?: CacheKeyOptions) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    SetMetadata(CACHE_KEY_METADATA, key)(target, propertyKey, descriptor);
    if (options?.ttl) {
      SetMetadata(CACHE_TTL_METADATA, options.ttl)(
        target,
        propertyKey,
        descriptor
      );
    }
  };
};
