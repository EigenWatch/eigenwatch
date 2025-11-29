/* eslint-disable @typescript-eslint/no-explicit-any */
// ============================================================================
// NEW FILE: SRC/MODULES/SEARCH/SEARCH.SERVICE.TS
// ============================================================================
import { Injectable } from "@nestjs/common";
import { SearchRepository } from "./repositories/search.repository";
import { SearchMapper } from "./mappers/search.mapper";

@Injectable()
export class SearchService {
  constructor(
    private searchRepository: SearchRepository,
    private searchMapper: SearchMapper
  ) {}

  // ============================================================================
  // ENDPOINT 32: Global Search
  // ============================================================================
  async globalSearch(
    query: string,
    entityTypes?: string[],
    limit: number = 20
  ): Promise<any> {
    if (!query || query.trim().length === 0) {
      throw new Error("Search query cannot be empty");
    }

    const results = await this.searchRepository.globalSearch(
      query.trim(),
      entityTypes || [],
      limit
    );

    return this.searchMapper.mapToGlobalSearchResults(results, query);
  }

  // ============================================================================
  // ENDPOINT 33: Get Leaderboard
  // ============================================================================
  async getLeaderboard(
    metric: string,
    limit: number = 50,
    date?: string
  ): Promise<any> {
    const parsedDate = date ? new Date(date) : undefined;

    const data = await this.searchRepository.getLeaderboard(
      metric,
      limit,
      parsedDate
    );

    if (!data.targetDate) {
      throw new Error("No leaderboard data available");
    }

    return this.searchMapper.mapToLeaderboard(data, metric);
  }

  // ============================================================================
  // ENDPOINT 34: Get Trending Operators
  // ============================================================================
  async getTrendingOperators(
    timeframe: string = "30d",
    metric: string = "tvs_growth",
    limit: number = 20
  ): Promise<any> {
    // Parse timeframe
    const timeframeDays = this.parseTimeframe(timeframe);

    const data = await this.searchRepository.getTrendingOperators(
      metric,
      timeframeDays,
      limit
    );

    return this.searchMapper.mapToTrendingOperators(data, metric, timeframe);
  }

  // ============================================================================
  // ENDPOINT 35: Get Recently Active Operators
  // ============================================================================
  async getRecentlyActiveOperators(
    activityTypes?: string[],
    hours: number = 24,
    limit: number = 50
  ): Promise<any> {
    // Validate hours
    if (hours < 1 || hours > 168) {
      throw new Error("Hours must be between 1 and 168 (1 week)");
    }

    const activities = await this.searchRepository.getRecentlyActiveOperators(
      activityTypes || [],
      hours,
      limit
    );

    return this.searchMapper.mapToRecentActivity(activities, hours);
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================
  private parseTimeframe(timeframe: string): number {
    switch (timeframe) {
      case "7d":
        return 7;
      case "30d":
        return 30;
      case "90d":
        return 90;
      default:
        return 30;
    }
  }
}
