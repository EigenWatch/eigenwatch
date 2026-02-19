import { Injectable, Logger } from "@nestjs/common";
import { PrismaAnalyticsService } from "@/core/database/prisma-analytics.service";
import { CacheService } from "@/core/cache/cache.service";
import axios from "axios";

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

interface RawMetadataJson {
  name?: string;
  description?: string;
  logo?: string;
  website?: string;
  twitter?: string;
  discord?: string;
  telegram?: string;
  // Some metadata uses different field names
  image?: string;
  url?: string;
  social?: {
    twitter?: string;
    discord?: string;
    telegram?: string;
  };
}

@Injectable()
export class AVSMetadataService {
  private readonly logger = new Logger(AVSMetadataService.name);
  private readonly CACHE_TTL = 604800; // 1 week in seconds
  private readonly FETCH_TIMEOUT = 10000; // 10 seconds

  constructor(
    private readonly prisma: PrismaAnalyticsService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Get AVS metadata by AVS ID
   * Checks Redis cache, returns default if not cached
   */
  async getAVSMetadata(avsId: string): Promise<AVSMetadata | null> {
    const cacheKey = `avs:metadata:${avsId.toLowerCase()}`;
    const cached = await this.cacheService.get<AVSMetadata>(cacheKey);

    if (cached) return cached;

    // Fetch AVS basic info from DB to get address
    const avs = await this.prisma.avs.findUnique({
      where: { id: avsId },
    });

    if (!avs) return null;

    // Return default metadata (will be populated by data pipeline via setAVSMetadata)
    const metadata = this.createDefaultMetadata(avsId, avs.address);

    // Cache default so we don't keep hitting DB
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

    // Fetch uncached AVS records from DB
    const avsRecords = await this.prisma.avs.findMany({
      where: { id: { in: uncached } },
    });

    // Process each AVS - return default metadata
    for (const avs of avsRecords) {
      const metadata = this.createDefaultMetadata(avs.id, avs.address);
      result.set(avs.id.toLowerCase(), metadata);

      // Cache it
      const cacheKey = `avs:metadata:${avs.id.toLowerCase()}`;
      await this.cacheService.set(cacheKey, metadata, this.CACHE_TTL);
    }

    return result;
  }

  /**
   * Store metadata in Redis cache
   * This is the main method for the data pipeline to populate AVS metadata
   */
  async setAVSMetadata(
    avsId: string,
    avsAddress: string,
    rawMetadata: RawMetadataJson,
  ): Promise<AVSMetadata> {
    const metadata = this.normalizeMetadata(avsId, avsAddress, rawMetadata);
    const cacheKey = `avs:metadata:${avsId.toLowerCase()}`;
    await this.cacheService.set(cacheKey, metadata, this.CACHE_TTL);
    return metadata;
  }

  /**
   * Store metadata by fetching from a URI
   * Fetches the metadata from the URI, normalizes it, and stores in Redis
   */
  async setAVSMetadataFromUri(
    avsId: string,
    avsAddress: string,
    metadataUri: string,
  ): Promise<AVSMetadata | null> {
    const rawMetadata = await this.fetchMetadataFromUri(metadataUri);
    if (!rawMetadata) {
      return null;
    }
    return this.setAVSMetadata(avsId, avsAddress, rawMetadata);
  }

  /**
   * Fetch metadata from a URI (HTTP/HTTPS or IPFS)
   */
  private async fetchMetadataFromUri(
    uri: string,
  ): Promise<RawMetadataJson | null> {
    if (!uri) return null;

    try {
      // Handle IPFS URIs
      let fetchUrl = uri;
      if (uri.startsWith("ipfs://")) {
        const ipfsHash = uri.replace("ipfs://", "");
        fetchUrl = `https://ipfs.io/ipfs/${ipfsHash}`;
      } else if (uri.startsWith("ar://")) {
        // Arweave URIs
        const arweaveHash = uri.replace("ar://", "");
        fetchUrl = `https://arweave.net/${arweaveHash}`;
      }

      const response = await axios.get(fetchUrl, {
        timeout: this.FETCH_TIMEOUT,
        headers: {
          Accept: "application/json",
        },
      });

      if (response.status === 200 && response.data) {
        // Handle case where response might be a string
        if (typeof response.data === "string") {
          try {
            return JSON.parse(response.data);
          } catch {
            this.logger.warn(`Invalid JSON from URI: ${uri}`);
            return null;
          }
        }
        return response.data;
      }

      return null;
    } catch {
      this.logger.debug(`Failed to fetch metadata from URI: ${uri}`);
      return null;
    }
  }

  /**
   * Normalize different metadata formats to our standard structure
   */
  private normalizeMetadata(
    avsId: string,
    avsAddress: string,
    raw: RawMetadataJson,
  ): AVSMetadata {
    return {
      avs_id: avsId,
      avs_address: avsAddress,
      name: raw.name || this.formatAddress(avsAddress),
      description: raw.description || null,
      logo: raw.logo || raw.image || null,
      website: raw.website || raw.url || null,
      twitter: raw.twitter || raw.social?.twitter || null,
      discord: raw.discord || raw.social?.discord || null,
      telegram: raw.telegram || raw.social?.telegram || null,
    };
  }

  /**
   * Create default metadata when none is available
   */
  private createDefaultMetadata(avsId: string, avsAddress: string): AVSMetadata {
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
   * Force refresh metadata (clears cache, returns default)
   */
  async refreshMetadata(avsId: string): Promise<AVSMetadata | null> {
    const cacheKey = `avs:metadata:${avsId.toLowerCase()}`;
    await this.cacheService.delete(cacheKey);
    return this.getAVSMetadata(avsId);
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
