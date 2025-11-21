import { Injectable } from "@nestjs/common";

@Injectable()
export class CacheKeyBuilder {
  static forOperator(operatorId: string): string {
    return `operator:${operatorId}`;
  }

  static forOperatorStats(operatorId: string): string {
    return `operator:${operatorId}:stats`;
  }

  static forOperatorSnapshots(operatorId: string, dateRange: string): string {
    return `operator:${operatorId}:snapshots:${dateRange}`;
  }

  static forNetworkStats(): string {
    return "network:stats";
  }

  static forLeaderboard(metric: string, limit: number): string {
    return `leaderboard:${metric}:${limit}`;
  }

  static forStrategy(strategyAddress: string): string {
    return `strategy:${strategyAddress}`;
  }

  static forAVS(avsId: string): string {
    return `avs:${avsId}`;
  }

  static forSearchResults(query: string): string {
    return `search:${query}`;
  }
}
