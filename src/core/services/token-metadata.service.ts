import { Injectable } from "@nestjs/common";
import { PrismaService } from "@/core/database/prisma.service";
import { CacheService } from "@/core/cache/cache.service";

export interface TokenMetadata {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logo_url: string | null;
  coingecko_id: string | null;
}

export interface StrategyMetadata {
  strategy_address: string;
  name: string;
  symbol: string;
  logo_url: string | null;
  underlying_token_address: string | null;
}

@Injectable()
export class TokenMetadataService {
  private readonly CACHE_TTL = 3600; // 1 hour

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Get token metadata from the token_metadata table
   */
  async getTokenMetadata(tokenAddress: string): Promise<TokenMetadata | null> {
    const cacheKey = `token:metadata:${tokenAddress.toLowerCase()}`;
    const cached = await this.cacheService.get<TokenMetadata>(cacheKey);

    if (cached) return cached;

    const token = await this.prisma.token_metadata.findUnique({
      where: { contract_address: tokenAddress },
    });

    if (!token) return null;

    const metadata: TokenMetadata = {
      address: token.contract_address,
      name: token.name,
      symbol: token.symbol,
      decimals: token.decimals || 18,
      logo_url: token.logo_small || token.logo_large || null,
      coingecko_id: token.coingecko_id || null,
    };

    await this.cacheService.set(cacheKey, metadata, this.CACHE_TTL);

    return metadata;
  }

  /**
   * Get strategy metadata by looking up the strategy's underlying token
   */
  async getStrategyMetadata(
    strategyAddress: string,
  ): Promise<StrategyMetadata | null> {
    const cacheKey = `strategy:metadata:${strategyAddress.toLowerCase()}`;
    const cached = await this.cacheService.get<StrategyMetadata>(cacheKey);

    if (cached) return cached;

    // Look up exchange rate to find underlying token
    const exchangeRate = await this.prisma.strategy_exchange_rates.findUnique({
      where: { strategy_address: strategyAddress },
    });

    let tokenMetadata: TokenMetadata | null = null;
    if (exchangeRate?.underlying_token) {
      tokenMetadata = await this.getTokenMetadata(
        exchangeRate.underlying_token,
      );
    }

    const metadata: StrategyMetadata = {
      strategy_address: strategyAddress,
      name: tokenMetadata?.name || this.formatAddress(strategyAddress),
      symbol: tokenMetadata?.symbol || "UNKNOWN",
      logo_url: tokenMetadata?.logo_url || null,
      underlying_token_address: exchangeRate?.underlying_token || null,
    };

    await this.cacheService.set(cacheKey, metadata, this.CACHE_TTL);

    return metadata;
  }

  /**
   * Batch get strategy metadata for multiple addresses
   */
  async getStrategyMetadataBatch(
    strategyAddresses: string[],
  ): Promise<Map<string, StrategyMetadata>> {
    const result = new Map<string, StrategyMetadata>();
    const uncached: string[] = [];

    // Check cache first
    for (const address of strategyAddresses) {
      const cacheKey = `strategy:metadata:${address.toLowerCase()}`;
      const cached = await this.cacheService.get<StrategyMetadata>(cacheKey);
      if (cached) {
        result.set(address.toLowerCase(), cached);
      } else {
        uncached.push(address);
      }
    }

    if (uncached.length === 0) return result;

    // Fetch exchange rates for uncached addresses
    const exchangeRates = await this.prisma.strategy_exchange_rates.findMany({
      where: { strategy_address: { in: uncached } },
    });

    const rateMap = new Map(
      exchangeRates.map((r) => [r.strategy_address.toLowerCase(), r]),
    );

    // Get unique underlying tokens
    const underlyingTokens = exchangeRates
      .filter((r) => r.underlying_token)
      .map((r) => r.underlying_token!);

    // Fetch token metadata
    const tokens = await this.prisma.token_metadata.findMany({
      where: { contract_address: { in: underlyingTokens } },
    });

    const tokenMap = new Map(
      tokens.map((t) => [t.contract_address.toLowerCase(), t]),
    );

    // Build metadata for each uncached address
    for (const address of uncached) {
      const rate = rateMap.get(address.toLowerCase());
      const token = rate?.underlying_token
        ? tokenMap.get(rate.underlying_token.toLowerCase())
        : null;

      const metadata: StrategyMetadata = {
        strategy_address: address,
        name: token?.name || this.formatAddress(address),
        symbol: token?.symbol || "UNKNOWN",
        logo_url: token?.logo_small || token?.logo_large || null,
        underlying_token_address: rate?.underlying_token || null,
      };

      result.set(address.toLowerCase(), metadata);

      // Cache it
      const cacheKey = `strategy:metadata:${address.toLowerCase()}`;
      await this.cacheService.set(cacheKey, metadata, this.CACHE_TTL);
    }

    return result;
  }

  /**
   * Format address for display
   */
  private formatAddress(address: string): string {
    if (!address || address.length < 10) return address || "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
}
