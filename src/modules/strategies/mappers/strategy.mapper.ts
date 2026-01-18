import { Injectable } from "@nestjs/common";
import { FormatUtils } from "@/core/utils/format.utils";
import {
  StrategyListItem,
  StrategyDetail,
  StrategyOperatorItem,
  StrategyDelegatorItem,
  PriceHistoryPoint,
  TVSHistoryPoint,
  StrategyNetworkStats,
  UnderlyingToken,
} from "../entities/strategy.entities";

@Injectable()
export class StrategyMapper {
  /**
   * Map raw database data to StrategyListItem
   */
  mapToListItem(data: any): StrategyListItem {
    const tokenMetadata = data.token_metadata;

    return {
      strategy_id: data.id,
      strategy_address: data.address,
      name: tokenMetadata?.name || FormatUtils.formatAddress(data.address),
      symbol: tokenMetadata?.symbol || "UNKNOWN",
      logo_url: tokenMetadata?.logo_small || tokenMetadata?.logo_large || null,
      underlying_token: this.mapUnderlyingToken(data),
      total_tvs_usd: data.total_tvs_usd?.toString() || "0",
      total_operators: data.operator_count || 0,
      total_delegators: data.delegator_count || 0,
      total_shares: data.total_shares?.toString() || "0",
      exchange_rate:
        data.exchange_rate?.shares_to_underlying_rate?.toString() || null,
      categories: tokenMetadata?.categories || [],
    };
  }

  /**
   * Map raw database data to StrategyDetail
   */
  mapToDetail(data: any): StrategyDetail {
    const listItem = this.mapToListItem(data);
    const tokenMetadata = data.token_metadata;

    return {
      ...listItem,
      description: tokenMetadata?.description || null,
      links: {
        homepage: tokenMetadata?.homepage_url || undefined,
        twitter: tokenMetadata?.twitter_url || undefined,
        discord: tokenMetadata?.discord_url || undefined,
        github: tokenMetadata?.github_urls || undefined,
      },
      price_availability: {
        available_from:
          tokenMetadata?.price_available_from?.toISOString() || null,
        available_to: tokenMetadata?.price_available_to?.toISOString() || null,
      },
      is_rebasing: tokenMetadata?.is_rebasing || false,
      coingecko_id: tokenMetadata?.coingecko_id || null,
      created_at: data.created_at?.toISOString() || "",
      updated_at: data.updated_at?.toISOString() || "",
    };
  }

  /**
   * Map underlying token data
   */
  private mapUnderlyingToken(data: any): UnderlyingToken | null {
    const tokenMetadata = data.token_metadata;
    const exchangeRate = data.exchange_rate;

    if (!exchangeRate?.underlying_token) return null;

    return {
      address: exchangeRate.underlying_token,
      name: tokenMetadata?.name || "Unknown",
      symbol: tokenMetadata?.symbol || "UNKNOWN",
      decimals: tokenMetadata?.decimals || 18,
      logo_url: tokenMetadata?.logo_small || tokenMetadata?.logo_large || null,
    };
  }

  /**
   * Map operator data for strategy operators list
   */
  mapToOperatorItem(data: any): StrategyOperatorItem {
    const operator = data.operators;
    const metadata = operator?.operator_metadata?.metadata_json;

    return {
      operator_id: data.operator_id,
      operator_address: operator?.address || "",
      operator_name: metadata?.name || null,
      tvs_usd: data.tvs_usd?.toString() || "0",
      shares: data.max_magnitude?.toString() || "0",
      utilization_rate: data.utilization_rate?.toString() || "0",
      is_active: operator?.operator_state?.is_active || false,
    };
  }

  /**
   * Map delegator data for strategy delegators list
   */
  mapToDelegatorItem(data: any, totalShares: number): StrategyDelegatorItem {
    const staker = data.stakers;
    const operator = data.operators;
    const operatorMetadata = operator?.operator_metadata?.metadata_json;
    const shares = parseFloat(data.shares?.toString() || "0");
    const sharePercentage = totalShares > 0 ? (shares / totalShares) * 100 : 0;

    return {
      staker_id: data.staker_id,
      staker_address: staker?.address || "",
      operator_id: data.operator_id,
      operator_name: operatorMetadata?.name || null,
      shares: data.shares?.toString() || "0",
      share_percentage: sharePercentage.toFixed(4),
      last_updated_at: data.updated_at?.toISOString() || "",
    };
  }

  /**
   * Map price history data
   */
  mapToPriceHistory(data: any[]): PriceHistoryPoint[] {
    return data.map((point) => ({
      timestamp: point.timestamp?.toISOString() || "",
      price_usd: point.price_usd?.toString() || "0",
      market_cap_usd: point.market_cap_usd?.toString() || null,
      total_volume_usd: point.total_volume_usd?.toString() || null,
    }));
  }

  /**
   * Map TVS history data
   */
  mapToTVSHistory(data: any[]): TVSHistoryPoint[] {
    return data.map((point) => ({
      date: point.date?.toISOString?.() || point.date,
      total_tvs_usd: point.total_tvs_usd?.toString() || "0",
      total_shares: point.total_shares?.toString() || "0",
      operator_count: point.operator_count || 0,
    }));
  }

  /**
   * Map network-wide strategy stats
   */
  mapToNetworkStats(
    data: any,
    strategyDetails: Map<string, any>,
  ): StrategyNetworkStats {
    const totalTvs = parseFloat(data.total_tvs_usd?.toString() || "0");

    return {
      total_strategies: data.total_strategies,
      total_tvs_usd: data.total_tvs_usd?.toString() || "0",
      top_strategies: data.top_strategies.map((s: any) => {
        const details = strategyDetails.get(s.strategy_id);
        const tvs = parseFloat(s.total_tvs_usd?.toString() || "0");
        const sharePercentage = totalTvs > 0 ? (tvs / totalTvs) * 100 : 0;

        return {
          strategy_id: s.strategy_id,
          strategy_address: s.strategy_address,
          name:
            details?.token_metadata?.name ||
            FormatUtils.formatAddress(s.strategy_address || ""),
          symbol: details?.token_metadata?.symbol || "UNKNOWN",
          total_tvs_usd: s.total_tvs_usd?.toString() || "0",
          operator_count: s.operator_count || 0,
          share_percentage: sharePercentage.toFixed(2),
        };
      }),
    };
  }
}
