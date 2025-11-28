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
}
