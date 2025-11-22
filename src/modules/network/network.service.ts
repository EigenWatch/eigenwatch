/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from "@nestjs/common";

@Injectable()
export class NetworkService {
  async getStats(): Promise<any> {
    return null;
  }

  async getTrends(): Promise<any[]> {
    return [];
  }
}
