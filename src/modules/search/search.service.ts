/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from "@nestjs/common";

@Injectable()
export class SearchService {
  async search(query: string): Promise<any[]> {
    return [];
  }
}
