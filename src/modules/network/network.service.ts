/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from "@nestjs/common";
import { NetworkRepository } from "./repositories/network.repository";
import { NetworkMapper } from "./mappers/network.mapper";
import { InvalidDateRangeException } from "@/shared/errors/app.exceptions";

@Injectable()
export class NetworkService {
  constructor(
    private networkRepository: NetworkRepository,
    private networkMapper: NetworkMapper
  ) {}

  async getNetworkStatistics(): Promise<any> {
    const data = await this.networkRepository.getNetworkStatistics();

    if (!data || !data.latest) {
      throw new Error("Network statistics not available");
    }

    return this.networkMapper.mapToNetworkStatistics(data);
  }

  async getNetworkDistribution(metric: string, date?: string): Promise<any> {
    const parsedDate = date ? new Date(date) : undefined;

    const data = await this.networkRepository.getNetworkDistribution(
      metric,
      parsedDate
    );

    if (!data || !data.snapshots || data.snapshots.length === 0) {
      throw new Error("Distribution data not available");
    }

    return this.networkMapper.mapToNetworkDistribution(data, metric);
  }

  async getNetworkHistory(dateFrom: string, dateTo: string): Promise<any> {
    const parsedDateFrom = new Date(dateFrom);
    const parsedDateTo = new Date(dateTo);

    // Validate date range
    if (parsedDateFrom > parsedDateTo) {
      throw new InvalidDateRangeException("Start date must be before end date");
    }

    const maxRange = 365 * 24 * 60 * 60 * 1000; // 1 year
    if (parsedDateTo.getTime() - parsedDateFrom.getTime() > maxRange) {
      throw new InvalidDateRangeException("Date range cannot exceed 1 year");
    }

    const history = await this.networkRepository.getNetworkHistory(
      parsedDateFrom,
      parsedDateTo
    );

    return this.networkMapper.mapToNetworkHistory(history);
  }
}
