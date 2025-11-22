/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from "@nestjs/common";

@Injectable()
export class AVSService {
  async findById(id: string): Promise<any> {
    return null;
  }

  async findMany(): Promise<any[]> {
    return [];
  }
}
