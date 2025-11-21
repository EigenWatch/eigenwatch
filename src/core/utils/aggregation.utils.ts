export class AggregationUtils {
  static calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  static calculateHHI(shares: number[]): number {
    const total = shares.reduce((sum, share) => sum + share, 0);
    if (total === 0) return 0;

    return shares.reduce((hhi, share) => {
      const marketShare = (share / total) * 100;
      return hhi + marketShare * marketShare;
    }, 0);
  }

  static calculateVolatility(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      values.length;

    return Math.sqrt(variance);
  }

  static calculateGrowthRate(current: number, previous: number): number {
    if (previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  }

  static calculateMovingAverage(values: number[], window: number): number[] {
    if (values.length < window) return values;

    const result: number[] = [];
    for (let i = 0; i <= values.length - window; i++) {
      const windowValues = values.slice(i, i + window);
      const avg = windowValues.reduce((sum, val) => sum + val, 0) / window;
      result.push(avg);
    }

    return result;
  }
}
