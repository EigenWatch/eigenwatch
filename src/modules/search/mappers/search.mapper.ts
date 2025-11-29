/* eslint-disable @typescript-eslint/no-explicit-any */
// ============================================================================
// NEW FILE: SRC/MODULES/SEARCH/MAPPERS/SEARCH.MAPPER.TS
// ============================================================================
import { FormatUtils } from "@/core/utils/format.utils";
import { Injectable } from "@nestjs/common";

@Injectable()
export class SearchMapper {
  // ============================================================================
  // ENDPOINT 32: Global Search
  // ============================================================================
  mapToGlobalSearchResults(results: any, query: string): any {
    const operators = results.operators.map((op: any) => {
      const name = op.operator_metadata?.metadata_json?.name;

      // Determine match type
      let matchType: "address" | "name" | "metadata" = "address";
      if (name && name.toLowerCase().includes(query.toLowerCase())) {
        matchType = "name";
      } else if (op.address.toLowerCase().includes(query.toLowerCase())) {
        matchType = "address";
      }

      return {
        operator_id: op.id,
        operator_address: op.address,
        operator_name: name || null,
        match_type: matchType,
      };
    });

    const avs = results.avs.map((a: any) => ({
      avs_id: a.id,
      avs_address: a.address,
      avs_name: this.getAVSName(a.address),
    }));

    const stakers = results.stakers.map((s: any) => ({
      staker_id: s.id,
      staker_address: s.address,
    }));

    return {
      results: {
        operators,
        avs,
        stakers,
      },
      total_results: operators.length + avs.length + stakers.length,
    };
  }

  // ============================================================================
  // ENDPOINT 33: Get Leaderboard
  // ============================================================================
  mapToLeaderboard(data: any, metric: string): any {
    const { operators, targetDate } = data;

    // Extract metric values and calculate rankings
    const operatorsWithMetric = operators
      .map((op: any) => {
        const state = op.operator_state;
        const analytics = op.operator_analytics?.[0];
        const name = op.operator_metadata?.metadata_json?.name;

        let metricValue = 0;
        switch (metric) {
          case "tvs":
            metricValue = parseFloat(
              this.calculateTotalTVS(op.operator_strategy_state)
            );
            break;
          case "delegators":
            metricValue = state?.active_delegators || 0;
            break;
          case "avs_count":
            metricValue = state?.active_avs_count || 0;
            break;
          case "operational_days":
            metricValue = state?.operational_days || 0;
            break;
          case "risk_score":
            metricValue = parseFloat(analytics?.risk_score?.toString() || "0");
            break;
          default:
            metricValue = 0;
        }

        return {
          operator_id: op.id,
          operator_address: op.address,
          operator_name: name || null,
          metric_value: metricValue,
        };
      })
      .filter((op: any) => op.metric_value > 0);

    // Sort based on metric (risk_score is ascending, others descending)
    const sortedOperators =
      metric === "risk_score"
        ? operatorsWithMetric.sort(
            (a: any, b: any) => a.metric_value - b.metric_value
          )
        : operatorsWithMetric.sort(
            (a: any, b: any) => b.metric_value - a.metric_value
          );

    // Create leaderboard with rankings
    const leaderboard = sortedOperators.map((op: any, index: number) => {
      const percentile = ((index + 1) / sortedOperators.length) * 100;

      return {
        rank: index + 1,
        operator_id: op.operator_id,
        operator_address: op.operator_address,
        operator_name: op.operator_name,
        metric_value: op.metric_value.toString(),
        percentile: percentile.toFixed(2),
      };
    });

    return {
      leaderboard,
      metric,
      date: targetDate.toISOString().split("T")[0],
      total_operators: operators.length,
    };
  }

  // ============================================================================
  // ENDPOINT 34: Get Trending Operators
  // ============================================================================
  mapToTrendingOperators(data: any, metric: string, timeframe: string): any {
    const { operators } = data;

    const trending = operators
      .map((op: any) => {
        const name = op.operator_metadata?.metadata_json?.name;
        const snapshots = op.operator_daily_snapshots;

        if (snapshots.length < 2) return null;

        const startSnapshot = snapshots[0];
        const endSnapshot = snapshots[snapshots.length - 1];

        let startValue = 0;
        let endValue = 0;

        switch (metric) {
          case "tvs_growth":
            startValue = parseFloat(
              this.calculateTotalTVS(op.operator_strategy_state)
            );
            endValue = startValue; // Would need historical strategy state
            break;
          case "delegator_growth":
            startValue = startSnapshot.delegator_count || 0;
            endValue = endSnapshot.delegator_count || 0;
            break;
          case "avs_growth":
            startValue = startSnapshot.active_avs_count || 0;
            endValue = endSnapshot.active_avs_count || 0;
            break;
        }

        if (startValue === 0) return null;

        const growthRate = endValue - startValue;
        const growthPercentage = ((endValue - startValue) / startValue) * 100;
        const trendScore = Math.abs(growthPercentage); // Simple scoring

        return {
          operator_id: op.id,
          operator_address: op.address,
          operator_name: name || null,
          current_value: endValue.toString(),
          previous_value: startValue.toString(),
          growth_rate: growthRate.toString(),
          growth_percentage: growthPercentage.toFixed(2),
          trend_score: trendScore.toFixed(2),
        };
      })
      .filter((op: any) => op !== null)
      .sort(
        (a: any, b: any) =>
          parseFloat(b.trend_score) - parseFloat(a.trend_score)
      );

    return {
      trending,
      timeframe,
      metric,
    };
  }

  // ============================================================================
  // ENDPOINT 35: Get Recently Active Operators
  // ============================================================================
  mapToRecentActivity(activities: any[], hours: number): any {
    const operators = activities.map((activity) => {
      const name = activity.operator.operator_metadata?.metadata_json?.name;

      return {
        operator_id: activity.operator.id,
        operator_address: activity.operator.address,
        operator_name: name || null,
        last_activity: {
          activity_type: activity.activity_type,
          timestamp: activity.timestamp.toISOString(),
          description: activity.description,
        },
      };
    });

    return {
      operators,
      timeframe_hours: hours,
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================
  private calculateTotalTVS(strategies: any[]): string {
    if (!strategies || strategies.length === 0) return "0";

    const total = strategies.reduce(
      (sum, s) => sum + parseFloat(s.max_magnitude.toString()),
      0
    );

    return total.toString();
  }

  private getAVSName(address: string): string | null {
    // Would fetch from metadata or config
    return FormatUtils.formatAddress(address);
  }
}
