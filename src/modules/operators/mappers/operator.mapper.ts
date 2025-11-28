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

@Injectable()
export class OperatorMapper {
  async mapToListItem(data: any): Promise<OperatorListItem> {
    const state = data.operator_state;
    const analytics = data.operator_analytics?.[0];
    const metadata = await this.getOperatorMetadataByUri(
      data.operator_state?.current_metadata_uri || ""
    );

    return {
      operator_id: data.id,
      operator_address: data.address,
      is_active: state?.is_active ?? false,
      total_tvs: this.calculateTotalTVS(data.operator_strategy_state),
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
      data.operator_state?.current_metadata_uri || ""
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

  mapToStatistics(data: any): OperatorStatistics {
    const state = data.operator_state;
    const strategies = data.operator_strategy_state || [];

    // Calculate total shares from delegators
    const totalShares =
      data.operator_delegator_shares?.reduce(
        (sum: number, share: any) => sum + parseFloat(share.shares.toString()),
        0
      ) ?? 0;

    return {
      tvs: {
        total: this.calculateTotalTVS(strategies),
        by_strategy: strategies.map((s: any) => this.mapStrategyBreakdown(s)),
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

  private mapStrategyBreakdown(strategyState: any): StrategyBreakdown {
    const maxMag = parseFloat(strategyState.max_magnitude.toString());
    const encumbered = parseFloat(
      strategyState.encumbered_magnitude.toString()
    );
    const utilization = maxMag > 0 ? encumbered / maxMag : 0;

    return {
      strategy_id: strategyState.strategy_id,
      strategy_address: strategyState.strategies?.address ?? "",
      strategy_name: this.getStrategyName(strategyState.strategies?.address),
      max_magnitude: strategyState.max_magnitude.toString(),
      encumbered_magnitude: strategyState.encumbered_magnitude.toString(),
      utilization_rate: utilization.toFixed(4),
    };
  }

  private calculateTotalTVS(strategies: any[]): string {
    if (!strategies || strategies.length === 0) return "0";

    const total = strategies.reduce(
      (sum, s) => sum + parseFloat(s.max_magnitude.toString()),
      0
    );

    return total.toString();
  }

  // TODO: Review this might have to fetch the data from eigenlayer strategy manager contract (What happens when we are indexing diffrent chains tho)
  private getStrategyName(address: string): string {
    // Strategy name mapping - would be fetched from metadata or config
    const names: Record<string, string> = {
      // Add known strategy addresses and names
    };
    return names[address?.toLowerCase()] || FormatUtils.formatAddress(address);
  }

  mapToStrategyListItem(
    strategyState: any,
    delegatorCount: number
  ): OperatorStrategyListItem {
    const maxMag = parseFloat(strategyState.max_magnitude.toString());
    const encumbered = parseFloat(
      strategyState.encumbered_magnitude.toString()
    );
    const available = maxMag - encumbered;
    const utilization = maxMag > 0 ? encumbered / maxMag : 0;

    return {
      strategy_id: strategyState.strategy_id,
      strategy_address: strategyState.strategies?.address ?? "",
      strategy_name: this.getStrategyName(strategyState.strategies?.address),
      strategy_symbol: this.getStrategySymbol(
        strategyState.strategies?.address
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
    totalShares: string
  ): OperatorStrategyDetail {
    const maxMag = parseFloat(strategyState.max_magnitude.toString());
    const encumbered = parseFloat(
      strategyState.encumbered_magnitude.toString()
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
          parseFloat(b.shares.toString()) - parseFloat(a.shares.toString())
      )
      .slice(0, 10);

    const totalSharesNum = parseFloat(totalShares);
    const topDelegators = sortedDelegators.map((d) => ({
      staker_address: d.stakers?.address ?? "",
      shares: d.shares.toString(),
      percentage:
        totalSharesNum > 0
          ? ((parseFloat(d.shares.toString()) / totalSharesNum) * 100).toFixed(
              2
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
    uri: string
  ): Promise<OperatorMetadata | null> {
    try {
      // Only fetch if it's a fully qualified HTTP(S) URL
      if (!uri.startsWith("http")) return null;

      const { data } = await axios.get(uri);

      // Validate and normalize the returned metadata structure
      const metadata: OperatorMetadata = {
        name: data.name ?? "",
        website: data.website ?? "",
        description: data.description ?? "",
        logo: data.logo ?? "",
        twitter: data.twitter ?? "",
      };

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

    console.log({ activity });

    switch (activity.type) {
      case "registration":
        return {
          ...baseActivity,
          description: "Operator registered",
          details: {
            delegation_approver: activity.data.delegation_approver,
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
        return {
          ...baseActivity,
          description: `Commission rate changed from ${activity.data.old_bips} to ${activity.data.new_bips} bips`,
          details: {
            commission_type: activity.data.commission_type,
            old_bips: activity.data.old_bips,
            new_bips: activity.data.new_bips,
            change_delta: activity.data.change_delta,
            avs_address: activity.data.avs?.address,
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
            0
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
              })
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
    commissions: any[]
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
          history[index - 1].status_changed_at
        ).getTime();
        durationSincePrevious = Math.floor(
          (currentTime - previousTime) / (1000 * 60 * 60 * 24)
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

  private getAVSName(address: string): string {
    // AVS name mapping - would be fetched from metadata or config
    const names: Record<string, string> = {
      // Add known AVS addresses and names
    };
    return names[address?.toLowerCase()] || FormatUtils.formatAddress(address);
  }

  private getAVSLogo(address: string): string {
    // AVS logo mapping
    const logos: Record<string, string> = {
      // Add known AVS addresses and logos
    };
    return logos[address?.toLowerCase()] || "";
  }

  // ============================================================================
  // COMMISSION MAPPERS (Endpoints 10-11)
  // ============================================================================

  mapToCommissionOverview(commissions: any[]): any {
    // Filter by commission type
    const piCommission = commissions.find((c) => c.commission_type === "pi");
    const avsCommissions = commissions.filter(
      (c) => c.commission_type === "avs"
    );
    const operatorSetCommissions = commissions.filter(
      (c) => c.commission_type === "operator_set"
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
      })),
      operator_set_commissions: operatorSetCommissions.map((c) => ({
        operator_set_id: c.operator_set_id,
        avs_name: this.getAVSName(c.operator_sets?.avs?.address),
        operator_set_number: c.operator_sets?.operator_set_id || 0,
        current_bips: c.current_bips,
        activated_at: c.current_activated_at.toISOString(),
      })),
    };
  }

  mapToCommissionHistory(history: any[]): any {
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

  mapToDelegatorListItem(delegator: any, totalShares: string): any {
    // Calculate shares percentage (would need total operator shares)
    const strategies = (delegator.operator_delegator_shares || []).map(
      (share: any) => ({
        strategy_id: share.strategy_id,
        strategy_name: this.getStrategyName(share.strategies?.address),
        shares: share.shares.toString(),
      })
    );

    return {
      staker_id: delegator.staker_id,
      staker_address: delegator.stakers?.address || "",
      is_delegated: delegator.is_delegated,
      delegated_at: delegator.delegated_at?.toISOString() || null,
      undelegated_at: delegator.undelegated_at?.toISOString() || null,
      total_shares: totalShares,
      shares_percentage: "0", // Would need to calculate against total operator shares
      strategies,
    };
  }

  mapToDelegatorDetail(delegator: any): any {
    const totalShares = (delegator.operator_delegator_shares || []).reduce(
      (sum: number, share: any) => sum + parseFloat(share.shares.toString()),
      0
    );

    let delegationDurationDays = null;
    if (delegator.delegated_at) {
      const start = new Date(delegator.delegated_at);
      const end = delegator.undelegated_at
        ? new Date(delegator.undelegated_at)
        : new Date();
      delegationDurationDays = Math.floor(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
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
      }
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

  mapToAllocationsOverview(data: any): any {
    const { allocations, strategyStates } = data;

    // Group by AVS
    const byAVSMap = new Map<string, any>();
    allocations.forEach((alloc: any) => {
      const avsId = alloc.operator_sets.avs_id;
      if (!byAVSMap.has(avsId)) {
        byAVSMap.set(avsId, {
          avs_id: avsId,
          avs_name: this.getAVSName(alloc.operator_sets.avs.address),
          total_allocated: 0,
          operator_set_count: new Set(),
          strategies: new Map(),
        });
      }

      const avsData = byAVSMap.get(avsId)!;
      avsData.total_allocated += parseFloat(alloc.magnitude.toString());
      avsData.operator_set_count.add(alloc.operator_set_id);

      const strategyId = alloc.strategy_id;
      if (!avsData.strategies.has(strategyId)) {
        avsData.strategies.set(strategyId, {
          strategy_id: strategyId,
          strategy_name: this.getStrategyName(alloc.strategies?.address),
          allocated_magnitude: 0,
        });
      }
      avsData.strategies.get(strategyId).allocated_magnitude += parseFloat(
        alloc.magnitude.toString()
      );
    });

    const byAVS = Array.from(byAVSMap.values()).map((avs) => ({
      avs_id: avs.avs_id,
      avs_name: avs.avs_name,
      total_allocated: avs.total_allocated.toString(),
      operator_set_count: avs.operator_set_count.size,
      strategies: Array.from(avs.strategies.values()).map((s: any) => ({
        ...s,
        allocated_magnitude: s.allocated_magnitude.toString(),
      })),
    }));

    // Group by strategy
    const byStrategyMap = new Map<string, any>();
    allocations.forEach((alloc: any) => {
      const strategyId = alloc.strategy_id;
      if (!byStrategyMap.has(strategyId)) {
        const state = strategyStates.find(
          (s: any) => s.strategy_id === strategyId
        );
        byStrategyMap.set(strategyId, {
          strategy_id: strategyId,
          strategy_name: this.getStrategyName(alloc.strategies?.address),
          total_allocated: 0,
          max_magnitude: state ? parseFloat(state.max_magnitude.toString()) : 0,
        });
      }

      const stratData = byStrategyMap.get(strategyId)!;
      stratData.total_allocated += parseFloat(alloc.magnitude.toString());
    });

    const byStrategy = Array.from(byStrategyMap.values()).map((strat) => {
      const available = strat.max_magnitude - strat.total_allocated;
      const utilization =
        strat.max_magnitude > 0
          ? strat.total_allocated / strat.max_magnitude
          : 0;

      return {
        strategy_id: strat.strategy_id,
        strategy_name: strat.strategy_name,
        total_allocated: strat.total_allocated.toString(),
        available_magnitude: available.toString(),
        utilization_rate: utilization.toFixed(4),
      };
    });

    const totalEncumbered = allocations.reduce(
      (sum: number, a: any) => sum + parseFloat(a.magnitude.toString()),
      0
    );

    return {
      total_allocations: allocations.length,
      total_encumbered_magnitude: totalEncumbered.toString(),
      by_avs: byAVS,
      by_strategy: byStrategy,
    };
  }

  mapToDetailedAllocation(allocation: any): any {
    return {
      allocation_id: allocation.id,
      operator_set_id: allocation.operator_set_id,
      avs_name: this.getAVSName(allocation.operator_sets?.avs?.address),
      operator_set_number: allocation.operator_sets?.operator_set_id || 0,
      strategy_id: allocation.strategy_id,
      strategy_name: this.getStrategyName(allocation.strategies?.address),
      magnitude: allocation.magnitude.toString(),
      allocated_at: allocation.allocated_at.toISOString(),
      effect_block: allocation.effect_block,
    };
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
      metrics: metrics.map((m) => ({
        metric_type: m.metric_type,
        date: m.date.toISOString().split("T")[0],
        volatility_7d: m.volatility_7d?.toString() || null,
        volatility_30d: m.volatility_30d?.toString() || null,
        volatility_90d: m.volatility_90d?.toString() || null,
        mean_value: m.mean_value?.toString() || null,
        coefficient_of_variation:
          m.coefficient_of_variation?.toString() || null,
        trend_direction: m.trend_direction?.toString() || null,
        trend_strength: m.trend_strength?.toString() || null,
        confidence_score: m.confidence_score?.toString() || null,
      })),
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
          s.encumbered_magnitude?.toString() || "0"
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
        0
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
      operator.operator_strategy_state
    );
    const operatorDelegators = operator.operator_state?.active_delegators || 0;
    const operatorAVS = operator.operator_state?.active_avs_count || 0;
    const operatorDays = operator.operator_state?.operational_days || 0;
    const operatorRisk = parseFloat(
      operator.operator_analytics[0]?.risk_score?.toString() || "0"
    );

    // Calculate percentiles
    const allTVS = allOperators.map((op: any) =>
      parseFloat(this.calculateTotalTVS(op.operator_strategy_state))
    );
    const allDelegators = allOperators.map(
      (op: any) => op.operator_state?.active_delegators || 0
    );
    const allAVS = allOperators.map(
      (op: any) => op.operator_state?.active_avs_count || 0
    );
    const allDays = allOperators.map(
      (op: any) => op.operator_state?.operational_days || 0
    );
    const allRisk = allOperators.map((op: any) =>
      parseFloat(op.operator_analytics[0]?.risk_score?.toString() || "0")
    );

    return {
      rankings: {
        tvs_percentile: this.calculatePercentile(
          allTVS,
          parseFloat(operatorTVS)
        ).toFixed(2),
        delegator_count_percentile: this.calculatePercentile(
          allDelegators,
          operatorDelegators
        ).toFixed(2),
        avs_count_percentile: this.calculatePercentile(
          allAVS,
          operatorAVS
        ).toFixed(2),
        operational_days_percentile: this.calculatePercentile(
          allDays,
          operatorDays
        ).toFixed(2),
        risk_score_percentile: this.calculatePercentile(
          allRisk,
          operatorRisk
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
          (op: any) => op.operator_state?.is_active
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
      operator.operator_strategy_state
    );
    const operatorDelegators = state?.active_delegators || 0;
    const operatorAVS = state?.active_avs_count || 0;
    const operatorCommission = state?.current_pi_split_bips || 0;

    const meanTVS = parseFloat(networkAvg.mean_tvs?.toString() || "0");
    const medianTVS = parseFloat(networkAvg.median_tvs?.toString() || "0");
    const meanDelegators = parseFloat(
      networkAvg.mean_delegators_per_operator?.toString() || "0"
    );
    const medianDelegators = parseFloat(
      networkAvg.median_delegators_per_operator?.toString() || "0"
    );
    const meanAVS = parseFloat(
      networkAvg.mean_avs_per_operator?.toString() || "0"
    );
    const meanCommission = parseFloat(
      networkAvg.mean_pi_commission_bips?.toString() || "0"
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
