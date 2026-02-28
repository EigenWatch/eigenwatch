import { Injectable, Logger } from "@nestjs/common";
import { PrismaAnalyticsService } from "@/core/database/prisma-analytics.service";
import { CacheService } from "@/core/cache/cache.service";

export interface AVSMetadata {
  avs_id: string;
  avs_address: string;
  name: string;
  description: string | null;
  logo: string | null;
  website: string | null;
  twitter: string | null;
  discord: string | null;
  telegram: string | null;
}

@Injectable()
export class AVSMetadataService {
  private readonly logger = new Logger(AVSMetadataService.name);
  private readonly CACHE_TTL = 604800; // 1 week in seconds

  constructor(
    private readonly prisma: PrismaAnalyticsService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Get AVS metadata by AVS ID
   * Checks Redis cache first, then avs_metadata DB table, then falls back to default
   */
  async getAVSMetadata(avsId: string): Promise<AVSMetadata | null> {
    const cacheKey = `avs:metadata:${avsId.toLowerCase()}`;
    const cached = await this.cacheService.get<AVSMetadata>(cacheKey);

    if (cached) return cached;

    // Query avs_metadata table (populated by the pipeline)
    const metadataRow = await this.prisma.avs_metadata.findUnique({
      where: { avs_id: avsId },
      include: { avs: true },
    });

    if (metadataRow) {
      const metadata: AVSMetadata = {
        avs_id: metadataRow.avs_id,
        avs_address: metadataRow.avs.address,
        name: metadataRow.name || this.formatAddress(metadataRow.avs.address),
        description: metadataRow.description || null,
        logo: metadataRow.logo || null,
        website: metadataRow.website || null,
        twitter: metadataRow.twitter || null,
        discord: null,
        telegram: null,
      };
      await this.cacheService.set(cacheKey, metadata, this.CACHE_TTL);
      return metadata;
    }

    // Fallback: fetch AVS basic info for address
    const avs = await this.prisma.avs.findUnique({
      where: { id: avsId },
    });

    if (!avs) return null;

    const metadata = this.createDefaultMetadata(avsId, avs.address);
    await this.cacheService.set(cacheKey, metadata, this.CACHE_TTL);
    return metadata;
  }

  /**
   * Get metadata for multiple AVS IDs
   */
  async getAVSMetadataBatch(
    avsIds: string[],
  ): Promise<Map<string, AVSMetadata>> {
    const result = new Map<string, AVSMetadata>();
    const uncached: string[] = [];

    // Check cache first
    for (const avsId of avsIds) {
      const cacheKey = `avs:metadata:${avsId.toLowerCase()}`;
      const cached = await this.cacheService.get<AVSMetadata>(cacheKey);
      if (cached) {
        result.set(avsId.toLowerCase(), cached);
      } else {
        uncached.push(avsId);
      }
    }

    if (uncached.length === 0) return result;

    // Batch query avs_metadata table for uncached IDs
    const metadataRows = await this.prisma.avs_metadata.findMany({
      where: { avs_id: { in: uncached } },
      include: { avs: true },
    });

    const foundIds = new Set<string>();

    for (const row of metadataRows) {
      const metadata: AVSMetadata = {
        avs_id: row.avs_id,
        avs_address: row.avs.address,
        name: row.name || this.formatAddress(row.avs.address),
        description: row.description || null,
        logo: row.logo || null,
        website: row.website || null,
        twitter: row.twitter || null,
        discord: null,
        telegram: null,
      };
      result.set(row.avs_id.toLowerCase(), metadata);
      foundIds.add(row.avs_id);

      const cacheKey = `avs:metadata:${row.avs_id.toLowerCase()}`;
      await this.cacheService.set(cacheKey, metadata, this.CACHE_TTL);
    }

    // For IDs not in avs_metadata, fall back to avs table for default metadata
    const stillMissing = uncached.filter((id) => !foundIds.has(id));
    if (stillMissing.length > 0) {
      const avsRecords = await this.prisma.avs.findMany({
        where: { id: { in: stillMissing } },
      });

      for (const avs of avsRecords) {
        const metadata = this.createDefaultMetadata(avs.id, avs.address);
        result.set(avs.id.toLowerCase(), metadata);

        const cacheKey = `avs:metadata:${avs.id.toLowerCase()}`;
        await this.cacheService.set(cacheKey, metadata, this.CACHE_TTL);
      }
    }

    return result;
  }

  /**
   * Force refresh metadata (clears cache, next read re-populates from DB)
   */
  async refreshMetadata(avsId: string): Promise<void> {
    const cacheKey = `avs:metadata:${avsId.toLowerCase()}`;
    await this.cacheService.delete(cacheKey);
  }

  /**
   * Create default metadata when none is available
   */
  private createDefaultMetadata(
    avsId: string,
    avsAddress: string,
  ): AVSMetadata {
    return {
      avs_id: avsId,
      avs_address: avsAddress,
      name: this.formatAddress(avsAddress),
      description: null,
      logo: null,
      website: null,
      twitter: null,
      discord: null,
      telegram: null,
    };
  }

  /**
   * Format address for display
   */
  private formatAddress(address: string): string {
    if (!address || address.length < 10) return address || "Unknown AVS";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  /**
   * Invalidate cache for an AVS
   */
  async invalidateCache(avsId: string): Promise<void> {
    const cacheKey = `avs:metadata:${avsId.toLowerCase()}`;
    await this.cacheService.delete(cacheKey);
  }

  /**
   * Invalidate all AVS metadata cache
   */
  async invalidateAllCache(): Promise<void> {
    await this.cacheService.deletePattern("avs:metadata:*");
  }
}
