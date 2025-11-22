/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from "@nestjs/common";

@Injectable()
export class StrategyService {
  async findById(address: string): Promise<any> {
    return null;
  }

  async findMany(): Promise<any[]> {
    return [];
  }
}
