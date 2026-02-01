/* eslint-disable @typescript-eslint/no-explicit-any */
import { FormatUtils } from "@/core/utils/format.utils";
import { Injectable } from "@nestjs/common";
import {
  OperatorActivity,
  OperatorListItem,
  OperatorMetadata,
  OperatorOverview,
  OperatorStatistics,
  StrategyBreakdown,
} from "../entities/operator.entities";
import {
  OperatorStrategyListItem,
  OperatorStrategyDetail,
} from "../entities/strategy.entities";
import axios from "axios";
import {
  AVSRelationshipListItem,
  AVSRelationshipDetail,
  AVSRegistrationHistoryItem,
} from "../entities/avs.entities";
import { OperatorRiskProfile } from "../entities/risk.entities";
import {
  CommissionOverviewResponseDto,
  CommissionHistoryResponseDto,
} from "../dto/commission-response.dto";
import {
  OperatorAllocationsOverview,
  StrategyAllocationBreakdown,
  AVSAllocationBreakdown,
  AllocationRiskMetrics,
  DetailedAllocationItem,
  DetailedAllocationsResponse,
  getUtilizationStatus,
  getUtilizationRiskLevel,
} from "../entities/allocation.entities";
import {
  DelegatorExposureResponse,
  AVSExposure,
  StrategyExposure,
} from "../entities/delegator-exposure.entities";

import { CacheService } from "@/core/cache/cache.service";
import {
  TokenMetadataService,
  StrategyMetadata,
} from "@/core/services/token-metadata.service";
import {
  AVSMetadataService,
  AVSMetadata,
} from "@/core/services/avs-metadata.service";
import { OperatorStrategyRepository } from "../repositories/operator-strategy.repository";

@Injectable()
export class OperatorMapper {
  // Cache for strategy metadata to avoid repeated lookups within a request
  private strategyMetadataCache = new Map<string, StrategyMetadata | null>();
  // Cache for AVS metadata to avoid repeated lookups within a request
  private avsMetadataCache = new Map<string, AVSMetadata | null>();

  constructor(
    private cacheService: CacheService,
    private tokenMetadataService: TokenMetadataService,
    private avsMetadataService: AVSMetadataService,
    private operatorStrategyRepository: OperatorStrategyRepository,
  ) {}
  async mapToListItem(data: any): Promise<OperatorListItem> {
    const state = data.operator_state;
    const analytics = data.operator_analytics?.[0];
    const metadata = await this.getOperatorMetadataByUri(
      data.operator_state?.current_metadata_uri || "",
    );

    return {
      operator_id: data.id,
      operator_address: data.address,
      is_active: state?.is_active ?? false,
      total_tvs: state?.total_tvs?.toString() ?? "0",
      delegator_count: state?.active_delegators ?? 0,
      active_avs_count: state?.active_avs_count ?? 0,
      operational_days: state?.operational_days ?? 0,
      current_pi_commission_bips: state?.current_pi_split_bips ?? 0,
      total_slash_events: state?.total_slash_events ?? 0,
      risk_level: analytics?.risk_level ?? "medium",
      risk_score: analytics?.risk_score?.toString() ?? "0",
      metadata,
    };
  }

  async mapToOverview(data: any): Promise<OperatorOverview> {
    const state = data.operator_state;
    const registration = data.operator_registration;
    const metadata = await this.getOperatorMetadataByUri(
      data.operator_state?.current_metadata_uri || "",
    );

    return {
      operator_id: data.id,
      operator_address: data.address,
      metadata,
      status: {
        is_active: state?.is_active ?? false,
        is_permissioned: state?.is_permissioned ?? false,
        registered_at: registration?.registered_at?.toISOString() ?? "",
        first_activity_at: state?.first_activity_at?.toISOString() ?? "",
        operational_days: state?.operational_days ?? 0,
        last_activity_at: state?.last_activity_at?.toISOString() ?? "",
      },
      delegation_config: {
        current_delegation_approver: state?.current_delegation_approver ?? "",
        delegation_approver_updated_at:
          state?.delegation_approver_updated_at?.toISOString() ?? "",
      },
      performance_summary: {
        total_slash_events: state?.total_slash_events ?? 0,
        last_slashed_at: state?.last_slashed_at?.toISOString() ?? null,
        force_undelegation_count: state?.force_undelegation_count ?? 0,
      },
    };
  }

  async mapToStatistics(data: any): Promise<OperatorStatistics> {
    const state = data.operator_state;
    const strategies = data.operator_strategy_state || [];

    // Calculate total shares from delegators
    const totalShares =
      data.operator_delegator_shares_sum !== undefined
        ? parseFloat(data.operator_delegator_shares_sum.toString())
        : (data.operator_delegator_shares?.reduce(
            (sum: number, share: any) =>
              sum + parseFloat(share.shares.toString()),
            0,
          ) ?? 0);

    return {
      tvs: {
        // Use precomputed total_tvs from operator_state instead of summing max_magnitude
        total: parseFloat(state?.total_tvs?.toString() ?? "0"),
        by_strategy: await Promise.all(
          strategies.map(async (s: any) => {
            const delegatorCount =
              await this.operatorStrategyRepository.countDelegatorsByStrategy(
                data.id,
                s.strategy_id,
              );
            return this.mapStrategyBreakdownAsync(
              s,
              parseFloat(state?.total_tvs?.toString() ?? "0"),
              delegatorCount,
            );
          }),
        ),
      },
      delegation: {
        total_delegators: state?.total_delegators ?? 0,
        active_delegators: state?.active_delegators ?? 0,
        total_shares: totalShares.toString(),
      },
      avs_participation: {
        active_avs_count: state?.active_avs_count ?? 0,
        registered_avs_count: state?.registered_avs_count ?? 0,
        active_operator_set_count: state?.active_operator_set_count ?? 0,
      },
      commission: {
        pi_split_bips: state?.current_pi_split_bips ?? 0,
        pi_split_activated_at:
          state?.pi_split_activated_at?.toISOString() ?? "",
      },
    };
  }

  /**
   * Async version of mapStrategyBreakdown that uses database lookups for strategy names
   */
  private async mapStrategyBreakdownAsync(
    strategyState: any,
    totalTvsUsd: number,
    delegatorCount: number,
  ): Promise<StrategyBreakdown> {
    const address = strategyState.strategies?.address ?? "";
    const tvsUsd = parseFloat(strategyState.tvs_usd?.toString() ?? "0");
    const tvsPercentage = totalTvsUsd > 0 ? (tvsUsd / totalTvsUsd) * 100 : 0;

    // Fetch token metadata
    const metadata =
      await this.tokenMetadataService.getStrategyMetadata(address);
    const tokenMetadata = metadata
      ? await this.tokenMetadataService.getTokenMetadata(
          metadata.underlying_token_address || "",
        )
      : null;

    const maxMag = parseFloat(strategyState.max_magnitude?.toString() ?? "0");
    const encumbered = parseFloat(
      strategyState.encumbered_magnitude?.toString() ?? "0",
    );
    const utilizationRate = maxMag > 0 ? encumbered / maxMag : 0;

    return {
      strategy_address: address,
      token: {
        name: metadata?.name || FormatUtils.formatAddress(address),
        symbol: metadata?.symbol || "UNKNOWN",
        logo_url: metadata?.logo_url || null,
        decimals: tokenMetadata?.decimals ?? 18,
      },
      tvs_usd: parseFloat(tvsUsd.toFixed(2)),
      tvs_percentage: parseFloat(tvsPercentage.toFixed(2)),
      utilization_rate: parseFloat(utilizationRate.toFixed(4)),
      delegator_count: delegatorCount,
    };
  }

  /**
   * @deprecated Use precomputed total_tvs from operator_state instead
   */
  private calculateTotalTVS(strategies: any[]): string {
    if (!strategies || strategies.length === 0) return "0";

    const total = strategies.reduce(
      (sum, s) => sum + parseFloat(s.max_magnitude.toString()),
      0,
    );

    return total.toString();
  }

  /**
   * @deprecated Use getStrategyNameAsync instead for proper database lookups
   */
  private getStrategyName(address: string): string {
    // Synchronous fallback - used when async is not available
    // The async version should be preferred when possible
    const cached = this.strategyMetadataCache.get(address?.toLowerCase());
    if (cached) return cached.name;

    // Strategy name mapping - would be fetched from metadata or config
    const names: Record<string, string> = {
      // Add known strategy addresses and names
    };
    return (
      names[address?.toLowerCase()] || FormatUtils.formatAddress(address || "")
    );
  }

  /**
   * Async method to get strategy name from database
   * Preferred over getStrategyName when async is possible
   */
  async getStrategyNameAsync(address: string): Promise<string> {
    if (!address) return "";

    const lowerAddress = address.toLowerCase();

    // Check local cache first
    if (this.strategyMetadataCache.has(lowerAddress)) {
      const cached = this.strategyMetadataCache.get(lowerAddress);
      return cached?.name || FormatUtils.formatAddress(address);
    }

    // Fetch from TokenMetadataService
    const metadata =
      await this.tokenMetadataService.getStrategyMetadata(address);
    this.strategyMetadataCache.set(lowerAddress, metadata);

    return metadata?.name || FormatUtils.formatAddress(address);
  }

  /**
   * Async method to get strategy symbol from database
   */
  async getStrategySymbolAsync(address: string): Promise<string> {
    if (!address) return "UNKNOWN";

    const lowerAddress = address.toLowerCase();

    // Check local cache first
    if (this.strategyMetadataCache.has(lowerAddress)) {
      const cached = this.strategyMetadataCache.get(lowerAddress);
      return cached?.symbol || "UNKNOWN";
    }

    // Fetch from TokenMetadataService
    const metadata =
      await this.tokenMetadataService.getStrategyMetadata(address);
    this.strategyMetadataCache.set(lowerAddress, metadata);

    return metadata?.symbol || "UNKNOWN";
  }

  /**
   * Preload strategy metadata for a batch of addresses
   * Call this before processing many strategies to minimize DB queries
   */
  async preloadStrategyMetadata(addresses: string[]): Promise<void> {
    const uniqueAddresses = [...new Set(addresses.filter(Boolean))];
    const uncached = uniqueAddresses.filter(
      (addr) => !this.strategyMetadataCache.has(addr.toLowerCase()),
    );

    if (uncached.length === 0) return;

    const metadataMap =
      await this.tokenMetadataService.getStrategyMetadataBatch(uncached);
    for (const [address, metadata] of metadataMap) {
      this.strategyMetadataCache.set(address.toLowerCase(), metadata);
    }
  }

  /**
   * Clear the local strategy metadata cache
   */
  clearStrategyMetadataCache(): void {
    this.strategyMetadataCache.clear();
  }

  mapToStrategyListItem(
    strategyState: any,
    delegatorCount: number,
  ): OperatorStrategyListItem {
    const maxMag = parseFloat(strategyState.max_magnitude.toString());
    const encumbered = parseFloat(
      strategyState.encumbered_magnitude.toString(),
    );
    const available = maxMag - encumbered;
    const utilization = maxMag > 0 ? encumbered / maxMag : 0;

    return {
      strategy_id: strategyState.strategy_id,
      strategy_address: strategyState.strategies?.address ?? "",
      strategy_name: this.getStrategyName(strategyState.strategies?.address),
      strategy_symbol: this.getStrategySymbol(
        strategyState.strategies?.address,
      ),
      max_magnitude: strategyState.max_magnitude.toString(),
      encumbered_magnitude: strategyState.encumbered_magnitude.toString(),
      available_magnitude: available.toString(),
      utilization_rate: utilization.toFixed(4),
      last_updated_at: strategyState.updated_at?.toISOString() ?? "",
      delegator_count: delegatorCount,
    };
  }

  // TODO: Review these against backend data, some of these are precomputed
  mapToStrategyDetail(
    strategyState: any,
    allocations: any[],
    delegators: any[],
    totalShares: string,
  ): OperatorStrategyDetail {
    const maxMag = parseFloat(strategyState.max_magnitude.toString());
    const encumbered = parseFloat(
      strategyState.encumbered_magnitude.toString(),
    );
    const available = maxMag - encumbered;
    const utilization = maxMag > 0 ? encumbered / maxMag : 0;

    // Calculate allocation percentages
    const mappedAllocations = allocations.map((alloc) => {
      const allocMag = parseFloat(alloc.magnitude.toString());
      const percentage = encumbered > 0 ? (allocMag / encumbered) * 100 : 0;

      return {
        operator_set_id: alloc.operator_set_id,
        avs_name: alloc.operator_sets?.avs?.address ?? "Unknown AVS",
        allocated_magnitude: alloc.magnitude.toString(),
        allocation_percentage: percentage.toFixed(2),
      };
    });

    // Sort delegators by shares and take top 10
    const sortedDelegators = delegators
      .sort(
        (a, b) =>
          parseFloat(b.shares.toString()) - parseFloat(a.shares.toString()),
      )
      .slice(0, 10);

    const totalSharesNum = parseFloat(totalShares);
    const topDelegators = sortedDelegators.map((d) => ({
      staker_address: d.stakers?.address ?? "",
      shares: d.shares.toString(),
      percentage:
        totalSharesNum > 0
          ? ((parseFloat(d.shares.toString()) / totalSharesNum) * 100).toFixed(
              2,
            )
          : "0",
    }));

    return {
      strategy_id: strategyState.strategy_id,
      strategy_address: strategyState.strategies?.address ?? "",
      strategy_name: this.getStrategyName(strategyState.strategies?.address),
      current_state: {
        max_magnitude: strategyState.max_magnitude.toString(),
        encumbered_magnitude: strategyState.encumbered_magnitude.toString(),
        available_magnitude: available.toString(),
        utilization_rate: utilization.toFixed(4),
        last_updated_at: strategyState.updated_at?.toISOString() ?? "",
      },
      allocations: mappedAllocations,
      delegators: {
        total_count: delegators.length,
        total_shares: totalShares,
        top_delegators: topDelegators,
      },
    };
  }

  private getStrategySymbol(address: string): string {
    // Strategy symbol mapping
    const symbols: Record<string, string> = {
      // Add known strategy addresses and symbols
    };
    return symbols[address?.toLowerCase()] || "UNKNOWN";
  }

  // TODO: Optimise how we handle getting metadata
  private async getOperatorMetadataByUri(
    uri: string,
  ): Promise<OperatorMetadata | null> {
    try {
      // Only fetch if it's a fully qualified HTTP(S) URL
      if (!uri.startsWith("http")) return null;

      const cacheKey = `metadata:${uri}`;
      const cached = await this.cacheService.get<OperatorMetadata>(cacheKey);

      if (cached) {
        return cached;
      }

      const { data } = await axios.get(uri);

      // Validate and normalize the returned metadata structure
      const metadata: OperatorMetadata = {
        name: data.name ?? "",
        website: data.website ?? "",
        description: data.description ?? "",
        logo: data.logo ?? "",
        twitter: data.twitter ?? "",
      };

      await this.cacheService.set(cacheKey, metadata, 432000); // 5 days TTL

      return metadata;
    } catch (error) {
      console.error("Failed to fetch operator metadata:", error);
      return null;
    }
  }

  // ============================================================================
  // ACTIVITY MAPPING
  // ============================================================================
  mapToActivity(activity: any): OperatorActivity {
    const baseActivity = {
      activity_type: activity.type,
      timestamp: activity.timestamp.toISOString(),
      block_number: activity.block_number,
      transaction_hash: activity.transaction_hash || "",
      details: {},
      description: "",
    };

    switch (activity.type) {
      case "registration":
        const avsName = activity.data.avs
          ? this.getAVSName(activity.data.avs.address)
          : "Unknown AVS";
        return {
          ...baseActivity,
          description: `Registered with ${avsName}`,
          details: {
            delegation_approver: activity.data.delegation_approver,
            avs_address: activity.data.avs?.address,
            avs_name: avsName,
          },
        };

      case "delegation": {
        const delegationType = activity.data.delegation_type;
        return {
          ...baseActivity,
          description: `Staker ${delegationType}`,
          details: {
            staker_address: activity.data.stakers?.address,
            delegation_type: delegationType,
          },
        };
      }

      case "allocation":
        return {
          ...baseActivity,
          description: "Allocated to operator set",
          details: {
            avs_address: activity.data.operator_sets?.avs?.address,
            strategy_address: activity.data.strategies?.address,
            magnitude: activity.data.magnitude.toString(),
            effect_block: activity.data.effect_block,
          },
        };

      case "commission":
        const commAvsName = activity.data.avs
          ? this.getAVSName(activity.data.avs.address)
          : "Unknown AVS";
        return {
          ...baseActivity,
          description: `Commission rate to ${commAvsName} changed from ${activity.data.old_bips} to ${activity.data.new_bips} bips`,
          details: {
            commission_type: activity.data.commission_type,
            old_bips: activity.data.old_bips,
            new_bips: activity.data.new_bips,
            change_delta: activity.data.change_delta,
            avs_address: activity.data.avs?.address,
            avs_name: commAvsName,
            activated_at: activity.data.activated_at.toISOString(),
          },
        };

      case "metadata":
        return {
          ...baseActivity,
          description: "Metadata updated",
          details: {
            metadata_uri: activity.data.metadata_uri,
            metadata: activity.data.metadata_json,
          },
        };

      case "slashing": {
        const totalSlashed =
          activity.data.operator_slashing_amounts?.reduce(
            (sum: number, amt: any) =>
              sum + parseFloat(amt.wad_slashed.toString()),
            0,
          ) || 0;
        return {
          ...baseActivity,
          description: activity.data.description,
          details: {
            avs_address: activity.data.operator_sets?.avs?.address,
            total_amount_slashed: totalSlashed.toString(),
            strategies: activity.data.operator_slashing_amounts?.map(
              (amt: any) => ({
                strategy_address: amt.strategies?.address,
                wad_slashed: amt.wad_slashed.toString(),
              }),
            ),
          },
        };
      }

      default:
        return baseActivity;
    }
  }

  // ============================================================================
  // AVS RELATIONSHIP MAPPING
  // ============================================================================
  mapToAVSRelationshipListItem(relationship: any): AVSRelationshipListItem {
    return {
      avs_id: relationship.avs_id,
      avs_address: relationship.avs?.address || "",
      avs_name: this.getAVSName(relationship.avs?.address),
      avs_logo: this.getAVSLogo(relationship.avs?.address),
      current_status: relationship.current_status,
      current_status_since: relationship.current_status_since.toISOString(),
      first_registered_at:
        relationship.first_registered_at?.toISOString() || "",
      total_days_registered: relationship.total_days_registered || 0,
      current_period_days: relationship.current_period_days || 0,
      total_registration_cycles: relationship.total_registration_cycles || 0,
      active_operator_set_count: relationship.active_operator_set_count || 0,
      avs_commission_bips: relationship.avs_commission_bips || 0,
    };
  }

  mapToAVSRelationshipDetail(
    relationship: any,
    operatorSets: any[],
    commissions: any[],
  ): AVSRelationshipDetail {
    // Map operator sets
    const mappedOperatorSets = operatorSets.map((set) => ({
      operator_set_id: set.id,
      operator_set_number: set.operator_set_id,
      is_active: set.is_active,
      allocations: set.allocations.map((alloc: any) => ({
        strategy_id: alloc.strategy_id,
        strategy_name: this.getStrategyName(alloc.strategies?.address),
        allocated_magnitude: alloc.magnitude.toString(),
      })),
    }));

    // Map commissions
    const avsCommission = commissions.find((c) => c.commission_type === "avs");
    const operatorSetCommissions = commissions
      .filter((c) => c.commission_type === "operator_set")
      .map((c) => ({
        operator_set_id: c.operator_set_id,
        commission_bips: c.current_bips,
      }));

    return {
      avs: {
        avs_id: relationship.avs_id,
        avs_address: relationship.avs?.address || "",
        avs_name: this.getAVSName(relationship.avs?.address),
        metadata: {
          name: this.getAVSName(relationship.avs?.address),
          logo: this.getAVSLogo(relationship.avs?.address),
          website: "",
        },
      },
      relationship: {
        current_status: relationship.current_status,
        current_status_since: relationship.current_status_since.toISOString(),
        first_registered_at:
          relationship.first_registered_at?.toISOString() || "",
        last_registered_at:
          relationship.last_registered_at?.toISOString() || "",
        last_unregistered_at:
          relationship.last_unregistered_at?.toISOString() || "",
        total_days_registered: relationship.total_days_registered || 0,
        total_registration_cycles: relationship.total_registration_cycles || 0,
      },
      operator_sets: mappedOperatorSets,
      commission: {
        avs_commission_bips: avsCommission?.current_bips || 0,
        operator_set_commissions: operatorSetCommissions,
      },
    };
  }

  mapToAVSRegistrationHistory(history: any[]): AVSRegistrationHistoryItem[] {
    return history.map((item, index) => {
      let durationSincePrevious = 0;
      if (index > 0) {
        const currentTime = new Date(item.status_changed_at).getTime();
        const previousTime = new Date(
          history[index - 1].status_changed_at,
        ).getTime();
        durationSincePrevious = Math.floor(
          (currentTime - previousTime) / (1000 * 60 * 60 * 24),
        );
      }

      return {
        status: item.status,
        timestamp: item.status_changed_at.toISOString(),
        block_number: item.status_changed_block,
        transaction_hash: item.transaction_hash || "",
        duration_since_previous: durationSincePrevious,
      };
    });
  }

  private getAVSName(avsIdOrAddress: string): string {
    if (!avsIdOrAddress) return "Unknown AVS";

    // Check AVS metadata cache by ID first
    const lowerId = avsIdOrAddress.toLowerCase();
    const cachedById = this.avsMetadataCache.get(lowerId);
    if (cachedById?.name) return cachedById.name;

    // Check if any cached metadata matches by address
    for (const [, metadata] of this.avsMetadataCache) {
      if (metadata?.avs_address?.toLowerCase() === lowerId && metadata?.name) {
        return metadata.name;
      }
    }

    return FormatUtils.formatAddress(avsIdOrAddress);
  }

  private getAVSLogo(avsIdOrAddress: string): string {
    if (!avsIdOrAddress) return "";

    // Check AVS metadata cache by ID first
    const lowerId = avsIdOrAddress.toLowerCase();
    const cachedById = this.avsMetadataCache.get(lowerId);
    if (cachedById?.logo) return cachedById.logo;

    // Check if any cached metadata matches by address
    for (const [, metadata] of this.avsMetadataCache) {
      if (metadata?.avs_address?.toLowerCase() === lowerId && metadata?.logo) {
        return metadata.logo;
      }
    }

    return "";
  }

  // ============================================================================
  // COMMISSION MAPPERS (Endpoints 10-11)
  // ============================================================================

  mapToCommissionOverview(data: {
    rates: any[];
    stats: {
      max_historical_bips: number;
      changes_last_12m: number;
      last_change_date: Date | null;
    };
    network_benchmarks: {
      mean_pi_commission_bips: number;
      median_pi_commission_bips: number;
      p25_pi_commission_bips: number;
      p75_pi_commission_bips: number;
      p90_pi_commission_bips: number;
    } | null;
    allocations?: any[];
  }): CommissionOverviewResponseDto {
    const { rates, stats, network_benchmarks, allocations = [] } = data;

    // Filter by commission type (case-insensitive to handle DB uppercase values)
    const piCommission = rates.find(
      (c) => c.commission_type?.toLowerCase() === "pi",
    );
    const avsCommissions = rates.filter(
      (c) => c.commission_type?.toLowerCase() === "avs",
    );
    const operatorSetCommissions = rates.filter(
      (c) => c.commission_type?.toLowerCase() === "operator_set",
    );

    // Calculate days since last change
    let daysSinceLastChange = 0;
    if (stats.last_change_date) {
      const diffTime = Math.abs(
        new Date().getTime() - stats.last_change_date.getTime(),
      );
      daysSinceLastChange = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    } else {
      daysSinceLastChange = 0;
    }

    // Check for pending changes
    const isChangePending = rates.some(
      (c) => c.upcoming_bips !== null || c.upcoming_activated_at !== null,
    );

    // Calculate max historical bips
    const currentMaxBips = Math.max(...rates.map((c) => c.current_bips), 0);
    const maxHistoricalBips = Math.max(
      stats.max_historical_bips,
      currentMaxBips,
    );

    // Calculate impact analysis
    const impactAnalysis = this.calculateCommissionImpactAnalysis(
      allocations,
      rates,
      piCommission?.current_bips || 0,
      network_benchmarks,
    );

    return {
      pi_commission: piCommission
        ? {
            current_bips: piCommission.current_bips,
            activated_at: piCommission.current_activated_at.toISOString(),
            total_changes: piCommission.total_changes || 0,
          }
        : null,
      avs_commissions: avsCommissions.map((c) => ({
        avs_id: c.avs_id,
        avs_name: this.getAVSName(c.avs?.address),
        current_bips: c.current_bips,
        activated_at: c.current_activated_at.toISOString(),
        upcoming_bips: c.upcoming_bips,
        upcoming_activated_at: c.upcoming_activated_at?.toISOString() || null,
        total_changes: c.total_changes || 0,
        first_set_at: c.first_set_at?.toISOString() || null,
      })),
      operator_set_commissions: operatorSetCommissions.map((c) => ({
        operator_set_id: c.operator_set_id,
        avs_name: this.getAVSName(c.operator_sets?.avs?.address),
        operator_set_number: c.operator_sets?.operator_set_id || 0,
        current_bips: c.current_bips,
        activated_at: c.current_activated_at.toISOString(),
      })),
      behavior_profile: {
        days_since_last_change: daysSinceLastChange,
        changes_last_12m: stats.changes_last_12m,
        max_historical_bips: maxHistoricalBips,
        is_change_pending: isChangePending,
      },
      network_benchmarks: network_benchmarks || {
        mean_pi_commission_bips: 0,
        median_pi_commission_bips: 0,
        p25_pi_commission_bips: 0,
        p75_pi_commission_bips: 0,
        p90_pi_commission_bips: 0,
      },
      impact_analysis: impactAnalysis,
    };
  }

  /**
   * Calculate commission impact analysis based on allocations
   */
  private calculateCommissionImpactAnalysis(
    allocations: any[],
    rates: any[],
    piCommissionBips: number,
    networkBenchmarks: any,
  ): any {
    // Build maps for quick lookup
    const avsCommissionMap = new Map<string, number>();
    const osCommissionMap = new Map<string, number>();

    for (const rate of rates) {
      const type = rate.commission_type?.toLowerCase();
      if (type === "avs" && rate.avs_id) {
        avsCommissionMap.set(rate.avs_id, rate.current_bips);
      } else if (type === "operator_set" && rate.operator_set_id) {
        osCommissionMap.set(rate.operator_set_id, rate.current_bips);
      }
    }

    // Calculate weighted average and breakdown
    let totalUsd = 0;
    let weightedSum = 0;
    const sourceBreakdown = {
      pi: { usd: 0 },
      avs: { usd: 0 },
      operator_set: { usd: 0 },
    };

    for (const alloc of allocations) {
      const usd = parseFloat(alloc.magnitude_usd?.toString() || "0");
      if (usd <= 0) continue;

      totalUsd += usd;

      // Determine which commission applies (operator_set > avs > pi)
      let applicableBips = piCommissionBips;
      let source: "pi" | "avs" | "operator_set" = "pi";

      if (osCommissionMap.has(alloc.operator_set_id)) {
        applicableBips = osCommissionMap.get(alloc.operator_set_id)!;
        source = "operator_set";
      } else if (avsCommissionMap.has(alloc.operator_sets?.avs_id)) {
        applicableBips = avsCommissionMap.get(alloc.operator_sets.avs_id)!;
        source = "avs";
      }

      weightedSum += usd * applicableBips;
      sourceBreakdown[source].usd += usd;
    }

    const weightedAvgBips =
      totalUsd > 0 ? weightedSum / totalUsd : piCommissionBips;

    // Determine comparison to network average
    let vsNetworkAverage: "lower" | "similar" | "higher" = "similar";
    if (networkBenchmarks) {
      const median = networkBenchmarks.median_pi_commission_bips || 0;
      const tolerance = median * 0.1;
      if (weightedAvgBips < median - tolerance) {
        vsNetworkAverage = "lower";
      } else if (weightedAvgBips > median + tolerance) {
        vsNetworkAverage = "higher";
      }
    }

    // Calculate percentile rank (lower commission = higher rank)
    let percentileRank = 50;
    if (networkBenchmarks) {
      const {
        p25_pi_commission_bips,
        median_pi_commission_bips,
        p75_pi_commission_bips,
        p90_pi_commission_bips,
      } = networkBenchmarks;
      if (weightedAvgBips <= p25_pi_commission_bips) {
        percentileRank = 75;
      } else if (weightedAvgBips <= median_pi_commission_bips) {
        percentileRank = 50;
      } else if (weightedAvgBips <= p75_pi_commission_bips) {
        percentileRank = 25;
      } else if (weightedAvgBips <= p90_pi_commission_bips) {
        percentileRank = 10;
      } else {
        percentileRank = 5;
      }
    }

    return {
      weighted_average_commission_bips: Math.round(weightedAvgBips),
      weighted_average_commission_pct: (weightedAvgBips / 100).toFixed(2),
      allocation_by_commission_source: {
        pi: {
          usd_amount: sourceBreakdown.pi.usd.toFixed(2),
          pct_of_total:
            totalUsd > 0
              ? ((sourceBreakdown.pi.usd / totalUsd) * 100).toFixed(2)
              : "100.00",
        },
        avs: {
          usd_amount: sourceBreakdown.avs.usd.toFixed(2),
          pct_of_total:
            totalUsd > 0
              ? ((sourceBreakdown.avs.usd / totalUsd) * 100).toFixed(2)
              : "0.00",
        },
        operator_set: {
          usd_amount: sourceBreakdown.operator_set.usd.toFixed(2),
          pct_of_total:
            totalUsd > 0
              ? ((sourceBreakdown.operator_set.usd / totalUsd) * 100).toFixed(2)
              : "0.00",
        },
      },
      vs_network_average: vsNetworkAverage,
      percentile_rank: percentileRank,
    };
  }

  mapToCommissionHistory(history: any[]): CommissionHistoryResponseDto {
    return {
      changes: history.map((item) => ({
        commission_type: item.commission_type,
        avs_id: item.avs_id,
        avs_name: item.avs ? this.getAVSName(item.avs.address) : null,
        operator_set_id: item.operator_set_id,
        old_bips: item.old_bips,
        new_bips: item.new_bips,
        change_delta: item.change_delta,
        changed_at: item.changed_at.toISOString(),
        activated_at: item.activated_at.toISOString(),
        activation_delay_seconds: item.activation_delay_seconds,
        block_number: item.block_number,
      })),
    };
  }

  // ============================================================================
  // DELEGATOR MAPPERS (Endpoints 12-14)
  // ============================================================================

  async mapToDelegatorListItem(
    delegator: any,
    totalShares: string,
    totalTVS: number = 0,
  ): Promise<any> {
    // Collect all strategy addresses to preload metadata if possible
    const strategiesData =
      delegator.stakers?.operator_delegator_shares ||
      delegator.strategies ||
      [];
    const strategyAddresses = strategiesData
      .map((s: any) => s.strategies?.address)
      .filter(Boolean);

    // Ideally we would preload here, but let's just use the async getters for each
    // This might be slightly slower but correct. Batching should happen at service level if needed.

    const strategies = await Promise.all(
      strategiesData.map(async (share: any) => {
        const address = share.strategies?.address || "";
        const metadata =
          await this.tokenMetadataService.getStrategyMetadata(address);

        return {
          strategy_id: share.strategy_id,
          strategy_name: metadata?.name || this.getStrategyName(address),
          strategy_symbol: metadata?.symbol || "UNKNOWN",
          strategy_logo: metadata?.logo_url || "",
          shares: share.shares.toString(),
          tvs: share.tvs?.toString() || (share.tvs_usd?.toString() ?? "0"),
        };
      }),
    );

    return {
      staker_id: delegator.staker_id,
      staker_address: delegator.stakers?.address || "",
      is_delegated: delegator.is_delegated,
      delegated_at: delegator.delegated_at?.toISOString() || null,
      undelegated_at: delegator.undelegated_at?.toISOString() || null,
      total_shares: totalShares,
      total_tvs: totalTVS.toString(),
      shares_percentage: "0", // Would need to calculate against total operator shares
      strategies,
    };
  }

  mapToDelegatorDetail(delegator: any): any {
    const totalShares = (delegator.operator_delegator_shares || []).reduce(
      (sum: number, share: any) => sum + parseFloat(share.shares.toString()),
      0,
    );

    let delegationDurationDays = null;
    if (delegator.delegated_at) {
      const start = new Date(delegator.delegated_at);
      const end = delegator.undelegated_at
        ? new Date(delegator.undelegated_at)
        : new Date();
      delegationDurationDays = Math.floor(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
      );
    }

    const sharesByStrategy = (delegator.operator_delegator_shares || []).map(
      (share: any) => {
        const percentage =
          totalShares > 0
            ? (
                (parseFloat(share.shares.toString()) / totalShares) *
                100
              ).toFixed(2)
            : "0";

        return {
          strategy_id: share.strategy_id,
          strategy_address: share.strategies?.address || "",
          strategy_name: this.getStrategyName(share.strategies?.address),
          shares: share.shares.toString(),
          shares_percentage: percentage,
          last_updated_at: share.updated_at?.toISOString() || "",
        };
      },
    );

    return {
      staker: {
        staker_id: delegator.staker_id,
        staker_address: delegator.stakers?.address || "",
      },
      delegation: {
        is_delegated: delegator.is_delegated,
        delegated_at: delegator.delegated_at?.toISOString() || null,
        undelegated_at: delegator.undelegated_at?.toISOString() || null,
        delegation_duration_days: delegationDurationDays,
      },
      shares_by_strategy: sharesByStrategy,
      total_shares: totalShares.toString(),
    };
  }

  /**
   * Map delegator data with operator allocations to exposure analysis
   * Shows delegator's risk exposure across AVS and strategies
   */
  async mapToDelegatorExposure(
    delegator: any,
    allocationsData: {
      allocations: any[];
      strategyState: any[];
      avsSummary: any[];
      commissionRates: any[];
    },
    operatorMetadata: any,
  ): Promise<DelegatorExposureResponse> {
    const { allocations, strategyState, avsSummary } = allocationsData;

    // Calculate total delegated USD from delegator's shares
    const delegatorStrategies = delegator.strategies || [];
    let totalDelegatedUsd = 0;

    // Preload strategy metadata
    const strategyAddresses = [
      ...new Set([
        ...delegatorStrategies
          .map((s: any) => s.strategy?.address)
          .filter(Boolean),
        ...strategyState.map((s: any) => s.strategies?.address).filter(Boolean),
      ]),
    ];
    await this.preloadStrategyMetadata(strategyAddresses);

    // Preload AVS metadata
    const avsIds = [
      ...new Set(
        allocations.map((a: any) => a.operator_sets?.avs_id).filter(Boolean),
      ),
    ];
    await this.preloadAVSMetadata(avsIds);

    // Build a map of strategy_id -> delegator's TVS in that strategy
    const delegatorTvsByStrategy = new Map<string, number>();
    for (const s of delegatorStrategies) {
      const tvs = parseFloat(s.tvs?.toString() || "0");
      delegatorTvsByStrategy.set(s.strategy?.id || s.strategy_id, tvs);
      totalDelegatedUsd += tvs;
    }

    // Build strategy state map for utilization rates
    const strategyStateMap = new Map<string, any>();
    for (const state of strategyState) {
      strategyStateMap.set(state.strategy_id, state);
    }

    // Calculate exposure by AVS
    // For each AVS, sum up the delegator's proportional exposure based on allocations
    const avsExposureMap = new Map<
      string,
      {
        avs_id: string;
        avs_name: string;
        avs_logo: string | null;
        exposed_usd: number;
      }
    >();

    // For each allocation, calculate delegator's exposure
    for (const alloc of allocations) {
      const avsId = alloc.operator_sets?.avs_id;
      const avsName = this.getAVSName(avsId);
      const avsLogo = this.getAVSLogo(avsId) || null;
      const strategyId = alloc.strategy_id;

      // Get delegator's TVS in this strategy
      const delegatorTvs = delegatorTvsByStrategy.get(strategyId) || 0;
      if (delegatorTvs === 0) continue;

      // Get operator's strategy state for this strategy
      const state = strategyStateMap.get(strategyId);
      if (!state) continue;

      // Calculate what portion of delegator's TVS is allocated to this AVS
      // using the magnitude ratio from the allocation
      const magnitude = parseFloat(alloc.magnitude?.toString() || "0");
      const maxMagnitude = parseFloat(
        state.max_magnitude?.toString() || "1000000000000000000",
      );
      const magnitudeRatio = maxMagnitude > 0 ? magnitude / maxMagnitude : 0;

      // Delegator's exposure to this allocation = their TVS × allocation ratio
      const exposedUsd = delegatorTvs * magnitudeRatio;

      // Aggregate by AVS
      const existing = avsExposureMap.get(avsId);
      if (existing) {
        existing.exposed_usd += exposedUsd;
      } else {
        avsExposureMap.set(avsId, {
          avs_id: avsId,
          avs_name: avsName,
          avs_logo: avsLogo,
          exposed_usd: exposedUsd,
        });
      }
    }

    // Convert AVS exposure map to array with percentages and slashing risk
    const exposureByAvs: AVSExposure[] = Array.from(avsExposureMap.values())
      .map((avs) => {
        const exposurePct =
          totalDelegatedUsd > 0
            ? (avs.exposed_usd / totalDelegatedUsd) * 100
            : 0;
        // Assuming max slashing is 100% of exposed amount (conservative estimate)
        // In reality, this would come from AVS slashing parameters
        const maxSlashingPct = 100;
        const maxSlashingUsd = avs.exposed_usd;

        return {
          avs_id: avs.avs_id,
          avs_name: avs.avs_name,
          avs_logo: avs.avs_logo,
          exposed_usd: avs.exposed_usd.toFixed(2),
          exposure_pct: exposurePct.toFixed(2),
          max_slashing_pct: maxSlashingPct.toFixed(2),
          max_slashing_usd: maxSlashingUsd.toFixed(2),
        };
      })
      .sort((a, b) => parseFloat(b.exposed_usd) - parseFloat(a.exposed_usd));

    // Calculate exposure by strategy
    const exposureByStrategy: StrategyExposure[] = await Promise.all(
      delegatorStrategies.map(async (s: any) => {
        const strategyId = s.strategy?.id || s.strategy_id;
        const strategyAddress = s.strategy?.address;
        const metadata = await this.getStrategyMetadataAsync(strategyAddress);

        const delegatorShares = s.shares?.toString() || "0";
        const delegatorTvs = parseFloat(s.tvs?.toString() || "0");

        // Get utilization from operator's strategy state
        const state = strategyStateMap.get(strategyId);
        const utilization = parseFloat(
          state?.utilization_rate?.toString() || "0",
        );

        // At-risk USD = delegator's TVS × utilization rate (allocated portion)
        const atRiskUsd = delegatorTvs * (utilization / 100);

        return {
          strategy_id: strategyId,
          strategy_symbol: metadata?.symbol || "UNKNOWN",
          strategy_logo: metadata?.logo_url || null,
          delegator_shares: delegatorShares,
          delegator_tvs_usd: delegatorTvs.toFixed(2),
          utilization_pct: utilization.toFixed(2),
          at_risk_usd: atRiskUsd.toFixed(2),
        };
      }),
    );

    // Calculate risk summary
    const totalAtRiskUsd = exposureByStrategy.reduce(
      (sum, s) => sum + parseFloat(s.at_risk_usd),
      0,
    );
    const atRiskPct =
      totalDelegatedUsd > 0 ? (totalAtRiskUsd / totalDelegatedUsd) * 100 : 0;

    // Find highest AVS exposure
    const highestAvs = exposureByAvs[0] || {
      avs_name: "N/A",
      exposed_usd: "0.00",
    };

    // Calculate diversification score (inverse of HHI, normalized 0-100)
    // HHI = sum of squared market shares; lower HHI = more diversified
    const avsShares = exposureByAvs.map((a) =>
      totalDelegatedUsd > 0 ? parseFloat(a.exposed_usd) / totalDelegatedUsd : 0,
    );
    const hhi = avsShares.reduce((sum, share) => sum + share * share, 0);
    // Diversification score: 100 when perfectly diversified, lower when concentrated
    // HHI ranges from 1/n (perfectly diversified) to 1 (fully concentrated)
    const diversificationScore = Math.round((1 - hhi) * 100);

    return {
      delegator: {
        staker_id: delegator.staker_id,
        staker_address: delegator.stakers?.address || "",
        total_delegated_usd: totalDelegatedUsd.toFixed(2),
      },
      operator: {
        operator_id: operatorMetadata?.id || "",
        operator_name: operatorMetadata?.metadata?.name || null,
      },
      exposure_by_avs: exposureByAvs,
      exposure_by_strategy: exposureByStrategy,
      risk_summary: {
        total_at_risk_usd: totalAtRiskUsd.toFixed(2),
        at_risk_pct: atRiskPct.toFixed(2),
        highest_avs_exposure_name: highestAvs.avs_name,
        highest_avs_exposure_usd: highestAvs.exposed_usd,
        diversification_score: diversificationScore,
      },
    };
  }

  mapToDelegationHistory(events: any[]): any {
    return {
      events: events.map((event) => ({
        staker_address: event.stakers?.address || "",
        event_type: event.delegation_type,
        timestamp: event.event_timestamp.toISOString(),
        block_number: event.event_block,
        transaction_hash: event.transaction_hash,
      })),
    };
  }

  // ============================================================================
  // ALLOCATION MAPPERS (Endpoints 15-16)
  // ============================================================================

  /**
   * Map allocation data to enhanced overview response
   * Uses USD values instead of summing magnitudes
   */
  async mapToAllocationsOverview(data: {
    allocations: any[];
    strategyState: any[];
    avsSummary: any[];
    commissionRates: any[];
  }): Promise<OperatorAllocationsOverview> {
    const { allocations, strategyState, avsSummary } = data;

    // Preload strategy metadata for all strategies
    const strategyAddresses = [
      ...new Set(
        allocations.map((a: any) => a.strategies?.address).filter(Boolean),
      ),
    ];
    await this.preloadStrategyMetadata(strategyAddresses);

    // Preload AVS metadata for all AVS
    const avsIds = [
      ...new Set(
        allocations.map((a: any) => a.operator_sets?.avs_id).filter(Boolean),
      ),
    ];
    await this.preloadAVSMetadata(avsIds);

    // Build strategy breakdown from operator_strategy_state (has TVS)
    const byStrategy: StrategyAllocationBreakdown[] = await Promise.all(
      strategyState.map(async (state: any) => {
        const metadata = await this.getStrategyMetadataAsync(
          state.strategies?.address,
        );
        const tvs = parseFloat(state.tvs_usd?.toString() || "0");
        const utilization = parseFloat(
          state.utilization_rate?.toString() || "0",
        );

        // Calculate allocated USD based on utilization
        const allocatedUsd = tvs * (utilization / 100);
        const availableUsd = tvs - allocatedUsd;

        // Count how many AVS use this strategy
        const avsCount = new Set(
          allocations
            .filter((a: any) => a.strategy_id === state.strategy_id)
            .map((a: any) => a.operator_sets?.avs_id),
        ).size;

        return {
          strategy_id: state.strategy_id,
          strategy_address: state.strategies?.address || "",
          strategy_symbol: metadata?.symbol || "UNKNOWN",
          strategy_logo: metadata?.logo_url || null,
          tvs_usd: tvs.toFixed(2),
          allocated_usd: allocatedUsd.toFixed(2),
          available_usd: availableUsd.toFixed(2),
          utilization_pct: utilization.toFixed(2),
          utilization_status: getUtilizationStatus(utilization),
          avs_count: avsCount,
        };
      }),
    );

    // Build AVS breakdown from allocations + avsSummary
    const avsMap = new Map<string, any>();
    for (const alloc of allocations) {
      const avsId = alloc.operator_sets?.avs_id;
      if (!avsId) continue;

      if (!avsMap.has(avsId)) {
        avsMap.set(avsId, {
          avs_id: avsId,
          avs_address: alloc.operator_sets?.avs?.address || "",
          avs_name: this.getAVSName(alloc.operator_sets?.avs?.address),
          avs_logo: this.getAVSLogo(alloc.operator_sets?.avs?.address),
          total_allocated_usd: 0,
          operator_set_ids: new Set<string>(),
          strategies: new Map<string, { symbol: string; usd: number }>(),
        });
      }

      const avsData = avsMap.get(avsId);
      avsData.operator_set_ids.add(alloc.operator_set_id);

      // Get USD value from allocation or calculate from avsSummary
      const allocUsd = parseFloat(alloc.magnitude_usd?.toString() || "0");
      avsData.total_allocated_usd += allocUsd;

      const strategyId = alloc.strategy_id;
      const metadata = await this.getStrategyMetadataAsync(
        alloc.strategies?.address,
      );
      if (!avsData.strategies.has(strategyId)) {
        avsData.strategies.set(strategyId, {
          symbol: metadata?.symbol || "UNKNOWN",
          usd: 0,
        });
      }
      avsData.strategies.get(strategyId).usd += allocUsd;
    }

    // Enhance AVS data with avsSummary USD values if allocation.magnitude_usd is not populated
    for (const summary of avsSummary) {
      const avsId = summary.avs_id;
      if (avsMap.has(avsId)) {
        const avsData = avsMap.get(avsId);
        // Use summary USD if individual allocations don't have USD
        if (
          avsData.total_allocated_usd === 0 &&
          summary.total_allocated_magnitude_usd
        ) {
          avsData.total_allocated_usd = parseFloat(
            summary.total_allocated_magnitude_usd.toString(),
          );
        }
      }
    }

    // Calculate total allocated USD for percentage calculations
    const totalAllocatedUsd = Array.from(avsMap.values()).reduce(
      (sum, avs) => sum + avs.total_allocated_usd,
      0,
    );

    const byAVS: AVSAllocationBreakdown[] = Array.from(avsMap.values()).map(
      (avs) => ({
        avs_id: avs.avs_id,
        avs_address: avs.avs_address,
        avs_name: avs.avs_name,
        avs_logo: avs.avs_logo,
        total_allocated_usd: avs.total_allocated_usd.toFixed(2),
        allocation_share_pct:
          totalAllocatedUsd > 0
            ? ((avs.total_allocated_usd / totalAllocatedUsd) * 100).toFixed(2)
            : "0.00",
        operator_set_count: avs.operator_set_ids.size,
        strategies_used: Array.from(avs.strategies.entries()).map(
          ([stratId, data]) => ({
            strategy_id: stratId,
            strategy_symbol: data.symbol,
            allocated_usd: data.usd.toFixed(2),
          }),
        ),
      }),
    );

    // Calculate summary
    const totalTvsUsd = strategyState.reduce(
      (sum: number, s: any) => sum + parseFloat(s.tvs_usd?.toString() || "0"),
      0,
    );

    // Calculate weighted average utilization
    const weightedUtilization =
      totalTvsUsd > 0
        ? strategyState.reduce((sum: number, s: any) => {
            const tvs = parseFloat(s.tvs_usd?.toString() || "0");
            const util = parseFloat(s.utilization_rate?.toString() || "0");
            return sum + tvs * util;
          }, 0) / totalTvsUsd
        : 0;

    // Calculate unique operator sets
    const uniqueOperatorSets = new Set(
      allocations.map((a: any) => a.operator_set_id),
    );

    // Calculate risk metrics
    const riskMetrics = this.calculateAllocationRiskMetrics(
      byAVS,
      byStrategy,
      weightedUtilization,
    );

    return {
      summary: {
        total_allocated_usd: totalAllocatedUsd.toFixed(2),
        total_tvs_usd: totalTvsUsd.toFixed(2),
        overall_utilization_pct: weightedUtilization.toFixed(2),
        total_avs_count: avsMap.size,
        total_operator_set_count: uniqueOperatorSets.size,
        total_allocation_count: allocations.length,
      },
      by_strategy: byStrategy.sort(
        (a, b) => parseFloat(b.tvs_usd) - parseFloat(a.tvs_usd),
      ),
      by_avs: byAVS.sort(
        (a, b) =>
          parseFloat(b.total_allocated_usd) - parseFloat(a.total_allocated_usd),
      ),
      risk_metrics: riskMetrics,
    };
  }

  /**
   * Calculate Herfindahl-Hirschman Index and other risk metrics
   */
  private calculateAllocationRiskMetrics(
    byAVS: AVSAllocationBreakdown[],
    byStrategy: StrategyAllocationBreakdown[],
    avgUtilization: number,
  ): AllocationRiskMetrics {
    // AVS concentration HHI (0-10000 scale)
    const totalAvsUsd = byAVS.reduce(
      (sum, a) => sum + parseFloat(a.total_allocated_usd),
      0,
    );
    const avsHHI =
      totalAvsUsd > 0
        ? byAVS.reduce((sum, a) => {
            const share =
              (parseFloat(a.total_allocated_usd) / totalAvsUsd) * 100;
            return sum + share * share;
          }, 0)
        : 0;

    // Strategy concentration HHI
    const totalStrategyTvs = byStrategy.reduce(
      (sum, s) => sum + parseFloat(s.tvs_usd),
      0,
    );
    const strategyHHI =
      totalStrategyTvs > 0
        ? byStrategy.reduce((sum, s) => {
            const share = (parseFloat(s.tvs_usd) / totalStrategyTvs) * 100;
            return sum + share * share;
          }, 0)
        : 0;

    // Highest single AVS exposure
    const highestAvsExposure =
      byAVS.length > 0
        ? Math.max(...byAVS.map((a) => parseFloat(a.allocation_share_pct)))
        : 0;

    return {
      avs_concentration_hhi: Math.round(avsHHI),
      strategy_concentration_hhi: Math.round(strategyHHI),
      highest_single_avs_exposure_pct: highestAvsExposure.toFixed(2),
      utilization_risk_level: getUtilizationRiskLevel(avgUtilization),
    };
  }

  /**
   * Map individual allocation to detailed item
   */
  async mapToDetailedAllocation(
    allocation: any,
    commissionRates: any[],
  ): Promise<DetailedAllocationItem> {
    const metadata = await this.getStrategyMetadataAsync(
      allocation.strategies?.address,
    );

    // Find applicable commission
    const commission = this.findApplicableCommission(
      allocation,
      commissionRates,
    );

    // Calculate magnitude percentage (if we have max_magnitude context)
    const magnitudeRaw = allocation.magnitude?.toString() || "0";
    const magnitudePct = allocation.allocation_percent
      ? parseFloat(allocation.allocation_percent.toString()).toFixed(2)
      : "0.00";

    return {
      allocation_id: allocation.id,
      avs_id: allocation.operator_sets?.avs_id || "",
      avs_name: this.getAVSName(allocation.operator_sets?.avs?.address),
      avs_logo: this.getAVSLogo(allocation.operator_sets?.avs?.address),
      operator_set_id: allocation.operator_set_id,
      operator_set_number: allocation.operator_sets?.operator_set_id || 0,
      strategy_id: allocation.strategy_id,
      strategy_symbol: metadata?.symbol || "UNKNOWN",
      strategy_logo: metadata?.logo_url || null,
      magnitude_raw: magnitudeRaw,
      magnitude_pct: magnitudePct,
      allocated_usd: allocation.magnitude_usd?.toString() || "0.00",
      commission: commission,
      allocated_at: allocation.allocated_at?.toISOString() || "",
      effect_block: allocation.effect_block || 0,
    };
  }

  /**
   * Find the applicable commission for an allocation
   * Priority: operator_set > avs > pi
   */
  private findApplicableCommission(
    allocation: any,
    commissionRates: any[],
  ): {
    effective_bips: number;
    source: "pi" | "avs" | "operator_set";
    display_pct: string;
  } | null {
    if (!commissionRates || commissionRates.length === 0) return null;

    // Check for operator_set specific commission
    const osCommission = commissionRates.find(
      (c) =>
        c.commission_type?.toLowerCase() === "operator_set" &&
        c.operator_set_id === allocation.operator_set_id,
    );
    if (osCommission) {
      return {
        effective_bips: osCommission.current_bips,
        source: "operator_set",
        display_pct: (osCommission.current_bips / 100).toFixed(2),
      };
    }

    // Check for AVS specific commission
    const avsCommission = commissionRates.find(
      (c) =>
        c.commission_type?.toLowerCase() === "avs" &&
        c.avs_id === allocation.operator_sets?.avs_id,
    );
    if (avsCommission) {
      return {
        effective_bips: avsCommission.current_bips,
        source: "avs",
        display_pct: (avsCommission.current_bips / 100).toFixed(2),
      };
    }

    // Fall back to PI commission
    const piCommission = commissionRates.find(
      (c) => c.commission_type?.toLowerCase() === "pi",
    );
    if (piCommission) {
      return {
        effective_bips: piCommission.current_bips,
        source: "pi",
        display_pct: (piCommission.current_bips / 100).toFixed(2),
      };
    }

    return null;
  }

  /**
   * Get strategy metadata asynchronously with caching
   */
  private async getStrategyMetadataAsync(
    address: string,
  ): Promise<StrategyMetadata | null> {
    if (!address) return null;
    const lowerAddress = address.toLowerCase();
    if (this.strategyMetadataCache.has(lowerAddress)) {
      return this.strategyMetadataCache.get(lowerAddress) || null;
    }
    const metadata =
      await this.tokenMetadataService.getStrategyMetadata(lowerAddress);
    this.strategyMetadataCache.set(lowerAddress, metadata);
    return metadata;
  }

  /**
   * Preload AVS metadata for multiple AVS IDs
   */
  async preloadAVSMetadata(avsIds: string[]): Promise<void> {
    const uniqueIds = [...new Set(avsIds.filter(Boolean))];
    const uncached = uniqueIds.filter(
      (id) => !this.avsMetadataCache.has(id.toLowerCase()),
    );

    if (uncached.length === 0) return;

    const metadataMap =
      await this.avsMetadataService.getAVSMetadataBatch(uncached);
    for (const [avsId, metadata] of metadataMap) {
      this.avsMetadataCache.set(avsId.toLowerCase(), metadata);
    }
  }

  /**
   * Get AVS metadata asynchronously with caching
   */
  private async getAVSMetadataAsync(
    avsId: string,
  ): Promise<AVSMetadata | null> {
    if (!avsId) return null;
    const lowerId = avsId.toLowerCase();
    if (this.avsMetadataCache.has(lowerId)) {
      return this.avsMetadataCache.get(lowerId) || null;
    }
    const metadata = await this.avsMetadataService.getAVSMetadata(avsId);
    this.avsMetadataCache.set(lowerId, metadata);
    return metadata;
  }

  /**
   * Clear the local AVS metadata cache
   */
  clearAVSMetadataCache(): void {
    this.avsMetadataCache.clear();
  }

  // ============================================================================
  // RISK & ANALYTICS MAPPERS (Endpoints 17-19)
  // ============================================================================

  mapToRiskAssessment(analytics: any): any {
    return {
      assessment_date: analytics.date.toISOString().split("T")[0],
      risk_score: analytics.risk_score.toString(),
      risk_level: analytics.risk_level,
      confidence_score: analytics.confidence_score.toString(),
      component_scores: {
        performance_score: analytics.performance_score?.toString() || null,
        economic_score: analytics.economic_score?.toString() || null,
        network_position_score:
          analytics.network_position_score?.toString() || null,
      },
      key_metrics: {
        delegation_hhi: analytics.delegation_hhi?.toString() || null,
        delegation_volatility_30d:
          analytics.delegation_volatility_30d?.toString() || null,
        growth_rate_30d: analytics.growth_rate_30d?.toString() || null,
        size_percentile: analytics.size_percentile?.toString() || null,
        slashing_event_count: analytics.slashing_event_count || 0,
        operational_days: analytics.operational_days || 0,
      },
      flags: {
        is_active: analytics.is_active || false,
        has_been_slashed: (analytics.slashing_event_count || 0) > 0,
        has_sufficient_data: analytics.has_sufficient_data || false,
      },
    };
  }

  mapToConcentrationMetrics(metrics: any[]): any {
    return {
      metrics: metrics.map((m) => ({
        concentration_type: m.concentration_type,
        date: m.date.toISOString().split("T")[0],
        hhi_value: m.hhi_value?.toString() || "0",
        gini_coefficient: m.gini_coefficient?.toString() || null,
        top_1_percentage: m.top_1_percentage?.toString() || null,
        top_5_percentage: m.top_5_percentage?.toString() || null,
        top_10_percentage: m.top_10_percentage?.toString() || null,
        total_entities: m.total_entities || 0,
        effective_entities: m.effective_entities?.toString() || null,
      })),
    };
  }

  mapToVolatilityMetrics(metrics: any[]): any {
    return {
      metrics: metrics.map((m) => this.mapToVolatilityMetric(m)),
    };
  }

  mapToRiskProfile(profile: any): OperatorRiskProfile {
    const { analytics, concentration, volatility } = profile;

    if (!analytics) {
      return null;
    }

    return {
      operator_id: analytics.operator_id,
      assessment_date: analytics.date.toISOString().split("T")[0],
      scores: {
        risk: parseFloat(analytics.risk_score.toString()),
        confidence: parseFloat(analytics.confidence_score.toString()),
        performance: analytics.performance_score
          ? parseFloat(analytics.performance_score.toString())
          : 0,
        economic: analytics.economic_score
          ? parseFloat(analytics.economic_score.toString())
          : 0,
        network_position: analytics.network_position_score
          ? parseFloat(analytics.network_position_score.toString())
          : 0,
      },
      risk_level: analytics.risk_level,
      flags: {
        is_active: analytics.is_active || false,
        has_been_slashed: (analytics.slashing_event_count || 0) > 0,
        has_sufficient_data: analytics.has_sufficient_data || false,
      },
      metrics: {
        delegation: {
          hhi: analytics.delegation_hhi
            ? parseFloat(analytics.delegation_hhi.toString())
            : 0,
          volatility_30d: analytics.delegation_volatility_30d
            ? parseFloat(analytics.delegation_volatility_30d.toString())
            : 0,
          growth_rate_30d: analytics.growth_rate_30d
            ? parseFloat(analytics.growth_rate_30d.toString())
            : 0,
          distribution_cv: analytics.delegator_distribution_cv
            ? parseFloat(analytics.delegator_distribution_cv.toString())
            : 0,
          size_percentile: analytics.size_percentile
            ? parseFloat(analytics.size_percentile.toString())
            : 0,
        },
        slashing: {
          count: analytics.slashing_event_count || 0,
          lifetime_amount:
            analytics.lifetime_slashing_amount?.toString() || "0",
        },
        activity: {
          operational_days: analytics.operational_days || 0,
        },
      },
      concentration: {
        delegation: concentration.delegation
          ? this.mapToConcentrationMetric(concentration.delegation)
          : null,
        allocation_by_avs: concentration.allocation_by_avs
          ? this.mapToConcentrationMetric(concentration.allocation_by_avs)
          : null,
        allocation_by_strategy: concentration.allocation_by_strategy
          ? this.mapToConcentrationMetric(concentration.allocation_by_strategy)
          : null,
      },
      volatility: {
        tvs: volatility.tvs ? this.mapToVolatilityMetric(volatility.tvs) : null,
        delegators: volatility.delegators
          ? this.mapToVolatilityMetric(volatility.delegators)
          : null,
      },
    };
  }

  private mapToConcentrationMetric(m: any): any {
    return {
      concentration_type: m.concentration_type,
      date: m.date.toISOString().split("T")[0],
      hhi_value: m.hhi_value?.toString() || "0",
      gini_coefficient: m.gini_coefficient?.toString() || null,
      top_1_percentage: m.top_1_percentage?.toString() || null,
      top_5_percentage: m.top_5_percentage?.toString() || null,
      top_10_percentage: m.top_10_percentage?.toString() || null,
      total_entities: m.total_entities || 0,
      effective_entities: m.effective_entities?.toString() || null,
    };
  }

  private mapToVolatilityMetric(m: any): any {
    return {
      metric_type: m.metric_type,
      date: m.date.toISOString().split("T")[0],
      volatility_7d: m.volatility_7d?.toString() || null,
      volatility_30d: m.volatility_30d?.toString() || null,
      volatility_90d: m.volatility_90d?.toString() || null,
      mean_value: m.mean_value?.toString() || null,
      coefficient_of_variation: m.coefficient_of_variation?.toString() || null,
      trend_direction: m.trend_direction?.toString() || null,
      trend_strength: m.trend_strength?.toString() || null,
      confidence_score: m.confidence_score?.toString() || null,
    };
  }

  // ============================================================================
  // TIME SERIES MAPPERS (Endpoints 20-25)
  // ============================================================================

  mapToDailySnapshots(snapshots: any[]): any {
    return {
      snapshots: snapshots.map((s) => ({
        date: s.snapshot_date.toISOString().split("T")[0],
        block_number: s.snapshot_block,
        delegator_count: s.delegator_count,
        active_avs_count: s.active_avs_count,
        active_operator_set_count: s.active_operator_set_count,
        pi_split_bips: s.pi_split_bips,
        slash_event_count_to_date: s.slash_event_count_to_date,
        operational_days: s.operational_days,
        is_active: s.is_active,
      })),
    };
  }

  mapToStrategyTVSHistory(snapshots: any[], strategyInfo: any): any {
    return {
      history: snapshots.map((s) => {
        const maxMag = parseFloat(s.max_magnitude.toString());
        const encumbered = parseFloat(
          s.encumbered_magnitude?.toString() || "0",
        );
        const utilization = maxMag > 0 ? encumbered / maxMag : 0;

        return {
          date: s.snapshot_date.toISOString().split("T")[0],
          max_magnitude: s.max_magnitude.toString(),
          encumbered_magnitude: (s.encumbered_magnitude || 0).toString(),
          utilization_rate: utilization.toFixed(4),
        };
      }),
      strategy: {
        strategy_id: strategyInfo.strategy_id,
        strategy_name: this.getStrategyName(strategyInfo.strategies?.address),
      },
    };
  }

  mapToDelegatorSharesHistory(snapshots: any[]): any {
    return {
      history: snapshots.map((s) => ({
        date: s.snapshot_date.toISOString().split("T")[0],
        strategy_id: s.strategy_id,
        strategy_name: this.getStrategyName(s.strategies?.address),
        shares: s.shares.toString(),
        is_delegated: s.is_delegated,
      })),
    };
  }

  mapToAVSRelationshipTimeline(snapshots: any[]): any {
    return {
      timeline: snapshots.map((s) => ({
        date: s.snapshot_date.toISOString().split("T")[0],
        current_status: s.current_status,
        days_registered_to_date: s.days_registered_to_date,
        current_period_days: s.current_period_days,
        active_operator_set_count: s.active_operator_set_count,
        avs_commission_bips: s.avs_commission_bips,
      })),
    };
  }

  mapToAllocationHistory(snapshots: any[]): any {
    return {
      history: snapshots.map((s) => ({
        date: s.snapshot_date.toISOString().split("T")[0],
        operator_set_id: s.operator_set_id,
        avs_name: this.getAVSName(s.operator_sets?.avs?.address),
        strategy_id: s.strategy_id,
        strategy_name: this.getStrategyName(s.strategies?.address),
        magnitude: s.magnitude.toString(),
      })),
    };
  }

  mapToSlashingIncidents(incidents: any[]): any {
    const mapped = incidents.map((incident) => {
      const amounts = incident.operator_slashing_amounts.map((amt: any) => ({
        strategy_id: amt.strategy_id,
        strategy_name: this.getStrategyName(amt.strategies?.address),
        wad_slashed: amt.wad_slashed.toString(),
      }));

      return {
        incident_id: incident.id,
        operator_set_id: incident.operator_set_id,
        avs_name: this.getAVSName(incident.operator_sets?.avs?.address),
        slashed_at: incident.slashed_at.toISOString(),
        block_number: incident.slashed_at_block,
        description: incident.description,
        transaction_hash: incident.transaction_hash,
        amounts,
      };
    });

    const totalAmount = incidents.reduce((sum, inc) => {
      const incidentTotal = inc.operator_slashing_amounts.reduce(
        (iSum: number, amt: any) =>
          iSum + parseFloat(amt.wad_slashed.toString()),
        0,
      );
      return sum + incidentTotal;
    }, 0);

    return {
      incidents: mapped,
      summary: {
        total_incidents: incidents.length,
        total_amount_slashed: totalAmount.toString(),
        first_slashed_at:
          incidents.length > 0
            ? incidents[incidents.length - 1].slashed_at.toISOString()
            : null,
        last_slashed_at:
          incidents.length > 0 ? incidents[0].slashed_at.toISOString() : null,
      },
    };
  }

  // ============================================================================
  // COMPARISON MAPPERS (Endpoints 26-28)
  // ============================================================================

  mapToOperatorsComparison(operators: any[], requestedMetrics?: string[]): any {
    const defaultMetrics = [
      "tvs",
      "delegators",
      "avs_count",
      "commission",
      "risk_score",
    ];
    const metrics = requestedMetrics || defaultMetrics;

    const comparisonDate = new Date().toISOString();

    const mapped = operators.map((op) => {
      const state = op.operator_state;
      const analytics = op.operator_analytics?.[0];
      const metadata = op.operator_metadata;

      // Calculate TVS
      const totalTVS = this.calculateTotalTVS(op.operator_strategy_state);

      const operatorMetrics: any = {};

      if (metrics.includes("tvs")) {
        operatorMetrics.tvs = totalTVS;
      }
      if (
        metrics.includes("delegators") ||
        metrics.includes("delegator_count")
      ) {
        operatorMetrics.delegator_count = state?.active_delegators || 0;
      }
      if (metrics.includes("avs_count")) {
        operatorMetrics.active_avs_count = state?.active_avs_count || 0;
      }
      if (metrics.includes("commission")) {
        operatorMetrics.pi_commission_bips = state?.current_pi_split_bips || 0;
      }
      if (metrics.includes("risk_score")) {
        operatorMetrics.risk_score = analytics?.risk_score?.toString() || "0";
      }
      if (metrics.includes("operational_days")) {
        operatorMetrics.operational_days = state?.operational_days || 0;
      }

      return {
        operator_id: op.id,
        operator_address: op.address,
        operator_name: metadata?.metadata_json?.name || null,
        metrics: operatorMetrics,
      };
    });

    return {
      operators: mapped,
      comparison_date: comparisonDate,
    };
  }

  mapToOperatorRankings(data: any): any {
    const { operator, allOperators } = data;

    // Calculate TVS for operator
    const operatorTVS = this.calculateTotalTVS(
      operator.operator_strategy_state,
    );
    const operatorDelegators = operator.operator_state?.active_delegators || 0;
    const operatorAVS = operator.operator_state?.active_avs_count || 0;
    const operatorDays = operator.operator_state?.operational_days || 0;
    const operatorRisk = parseFloat(
      operator.operator_analytics[0]?.risk_score?.toString() || "0",
    );

    // Calculate percentiles
    const allTVS = allOperators.map((op: any) =>
      parseFloat(this.calculateTotalTVS(op.operator_strategy_state)),
    );
    const allDelegators = allOperators.map(
      (op: any) => op.operator_state?.active_delegators || 0,
    );
    const allAVS = allOperators.map(
      (op: any) => op.operator_state?.active_avs_count || 0,
    );
    const allDays = allOperators.map(
      (op: any) => op.operator_state?.operational_days || 0,
    );
    const allRisk = allOperators.map((op: any) =>
      parseFloat(op.operator_analytics[0]?.risk_score?.toString() || "0"),
    );

    return {
      rankings: {
        tvs_percentile: this.calculatePercentile(
          allTVS,
          parseFloat(operatorTVS),
        ).toFixed(2),
        delegator_count_percentile: this.calculatePercentile(
          allDelegators,
          operatorDelegators,
        ).toFixed(2),
        avs_count_percentile: this.calculatePercentile(
          allAVS,
          operatorAVS,
        ).toFixed(2),
        operational_days_percentile: this.calculatePercentile(
          allDays,
          operatorDays,
        ).toFixed(2),
        risk_score_percentile: this.calculatePercentile(
          allRisk,
          operatorRisk,
        ).toFixed(2),
      },
      absolute_values: {
        tvs: operatorTVS,
        delegator_count: operatorDelegators,
        avs_count: operatorAVS,
        operational_days: operatorDays,
        risk_score: operatorRisk.toString(),
      },
      network_stats: {
        total_operators: allOperators.length,
        active_operators: allOperators.filter(
          (op: any) => op.operator_state?.is_active,
        ).length,
      },
      date:
        operator.operator_analytics[0]?.date.toISOString().split("T")[0] ||
        new Date().toISOString().split("T")[0],
    };
  }

  private calculatePercentile(values: number[], target: number): number {
    const sorted = values.slice().sort((a, b) => a - b);
    const index = sorted.findIndex((v) => v >= target);
    if (index === -1) return 100;
    return (index / sorted.length) * 100;
  }

  mapToNetworkComparison(operator: any, networkAvg: any): any {
    const state = operator.operator_state;
    const operatorTVS = this.calculateTotalTVS(
      operator.operator_strategy_state,
    );
    const operatorDelegators = state?.active_delegators || 0;
    const operatorAVS = state?.active_avs_count || 0;
    const operatorCommission = state?.current_pi_split_bips || 0;

    const meanTVS = parseFloat(networkAvg.mean_tvs?.toString() || "0");
    const medianTVS = parseFloat(networkAvg.median_tvs?.toString() || "0");
    const meanDelegators = parseFloat(
      networkAvg.mean_delegators_per_operator?.toString() || "0",
    );
    const medianDelegators = parseFloat(
      networkAvg.median_delegators_per_operator?.toString() || "0",
    );
    const meanAVS = parseFloat(
      networkAvg.mean_avs_per_operator?.toString() || "0",
    );
    const meanCommission = parseFloat(
      networkAvg.mean_pi_commission_bips?.toString() || "0",
    );

    return {
      operator_metrics: {
        tvs: operatorTVS,
        delegator_count: operatorDelegators,
        avs_count: operatorAVS,
        pi_commission_bips: operatorCommission,
      },
      network_averages: {
        mean_tvs: meanTVS.toString(),
        median_tvs: medianTVS.toString(),
        mean_delegators: meanDelegators.toString(),
        median_delegators: medianDelegators.toString(),
        mean_avs: meanAVS.toString(),
        mean_pi_commission: meanCommission.toString(),
      },
      differences: {
        tvs_vs_mean: (parseFloat(operatorTVS) - meanTVS).toString(),
        tvs_vs_median: (parseFloat(operatorTVS) - medianTVS).toString(),
        delegators_vs_mean: (operatorDelegators - meanDelegators).toString(),
        avs_vs_mean: (operatorAVS - meanAVS).toString(),
      },
      date: networkAvg.snapshot_date.toISOString().split("T")[0],
    };
  }
}
