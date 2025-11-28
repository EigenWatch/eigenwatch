/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from "@nestjs/common";

@Injectable()
export class NetworkMapper {
  mapToNetworkStatistics(data: any): any {
    const {
      latest,
      totalOperators,
      activeOperators,
      totalAVS,
      totalDelegators,
    } = data;

    return {
      operators: {
        total_operators: totalOperators,
        active_operators: activeOperators,
        inactive_operators: totalOperators - activeOperators,
      },
      tvs: {
        total_tvs: latest.total_tvs?.toString() || "0",
        mean_tvs: latest.mean_tvs?.toString() || "0",
        median_tvs: latest.median_tvs?.toString() || "0",
      },
      delegation: {
        total_delegators: totalDelegators,
        mean_delegators_per_operator:
          latest.mean_delegators_per_operator?.toString() || "0",
        median_delegators_per_operator:
          latest.median_delegators_per_operator?.toString() || "0",
      },
      avs: {
        total_avs: totalAVS,
        mean_avs_per_operator: latest.mean_avs_per_operator?.toString() || "0",
      },
      commission: {
        mean_pi_commission: latest.mean_pi_commission_bips?.toString() || "0",
        median_pi_commission:
          latest.median_pi_commission_bips?.toString() || "0",
      },
      last_updated: latest.snapshot_date.toISOString(),
    };
  }

  mapToNetworkDistribution(data: any, metric: string): any {
    const { snapshots, targetDate } = data;

    // Extract values based on metric
    let values: number[] = [];
    switch (metric) {
      case "tvs":
        values = snapshots.map((s: any) => {
          const tvs = s.operators.operator_strategy_state.reduce(
            (sum: number, st: any) =>
              sum + parseFloat(st.max_magnitude.toString()),
            0
          );
          return tvs;
        });
        break;
      case "delegators":
        values = snapshots.map((s: any) => s.delegator_count || 0);
        break;
      case "avs_count":
        values = snapshots.map((s: any) => s.active_avs_count || 0);
        break;
    }

    // Calculate distribution statistics
    const sorted = values.slice().sort((a, b) => a - b);
    const min = sorted[0] || 0;
    const max = sorted[sorted.length - 1] || 0;
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length || 0;
    const median = sorted[Math.floor(sorted.length / 2)] || 0;
    const p25 = sorted[Math.floor(sorted.length * 0.25)] || 0;
    const p75 = sorted[Math.floor(sorted.length * 0.75)] || 0;
    const p90 = sorted[Math.floor(sorted.length * 0.9)] || 0;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
    const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;

    // Calculate standard deviation
    const variance =
      values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) /
        values.length || 0;
    const stdDev = Math.sqrt(variance);

    // Create histogram (10 buckets)
    const bucketCount = 10;
    const bucketSize = (max - min) / bucketCount || 1;
    const histogram = Array.from({ length: bucketCount }, (_, i) => {
      const bucketStart = min + i * bucketSize;
      const bucketEnd = min + (i + 1) * bucketSize;
      const count = values.filter(
        (v) =>
          v >= bucketStart &&
          (i === bucketCount - 1 ? v <= bucketEnd : v < bucketEnd)
      ).length;
      const percentage = ((count / values.length) * 100).toFixed(2);

      return {
        bucket_start: bucketStart.toString(),
        bucket_end: bucketEnd.toString(),
        count,
        percentage,
      };
    });

    return {
      metric,
      date: targetDate.toISOString().split("T")[0],
      distribution: {
        min: min.toString(),
        p25: p25.toString(),
        median: median.toString(),
        p75: p75.toString(),
        p90: p90.toString(),
        p95: p95.toString(),
        p99: p99.toString(),
        max: max.toString(),
        mean: mean.toString(),
        std_dev: stdDev.toString(),
      },
      histogram,
    };
  }

  mapToNetworkHistory(history: any[]): any {
    return {
      history: history.map((h) => ({
        date: h.snapshot_date.toISOString().split("T")[0],
        total_operators: h.total_operators,
        active_operators: h.active_operators,
        total_tvs: h.total_tvs?.toString() || null,
        mean_tvs: h.mean_tvs?.toString() || null,
        median_tvs: h.median_tvs?.toString() || null,
        total_delegators: h.total_delegators,
        mean_delegators_per_operator:
          h.mean_delegators_per_operator?.toString() || null,
        mean_avs_per_operator: h.mean_avs_per_operator?.toString() || null,
      })),
    };
  }
}
