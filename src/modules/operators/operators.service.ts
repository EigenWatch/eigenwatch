/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, Inject } from "@nestjs/common";
import { BaseService } from "src/core/common/base.service";

@Injectable()
export class OperatorService extends BaseService<any> {
  constructor(@Inject("OperatorRepository") repository: any) {
    super(repository);
  }

  async findById(id: string): Promise<any> {
    // TODO: Implement
    return null;
  }

  async findMany(query: any): Promise<any[]> {
    // TODO: Implement
    return [];
  }

  async getStats(operatorId: string): Promise<any> {
    // TODO: Implement
    return null;
  }

  async getSnapshots(operatorId: string, dateRange: any): Promise<any[]> {
    // TODO: Implement
    return [];
  }
}
