import { PAGINATION_CONSTANTS } from "src/shared/constants/pagination.constants";
import { PaginationDto } from "src/shared/dto/pagination.dto";
import { PaginationMeta } from "src/shared/types/api-response.types";

export class PaginationHelper {
  static DEFAULT_LIMIT = PAGINATION_CONSTANTS.DEFAULT_LIMIT;
  static MAX_LIMIT = PAGINATION_CONSTANTS.MAX_LIMIT;

  static validate(limit: number, offset: number): void {
    if (limit < PAGINATION_CONSTANTS.MIN_LIMIT) {
      throw new Error(
        `Limit must be at least ${PAGINATION_CONSTANTS.MIN_LIMIT}`
      );
    }

    if (limit > PAGINATION_CONSTANTS.MAX_LIMIT) {
      throw new Error(`Limit cannot exceed ${PAGINATION_CONSTANTS.MAX_LIMIT}`);
    }

    if (offset < 0) {
      throw new Error("Offset must be non-negative");
    }
  }

  static buildMeta(
    total: number,
    limit: number,
    offset: number
  ): PaginationMeta {
    const hasMore = offset + limit < total;
    const nextOffset = hasMore ? offset + limit : undefined;

    return {
      total,
      limit,
      offset,
      has_more: hasMore,
      next_offset: nextOffset,
    };
  }

  static toPrisma(pagination: PaginationDto): { take: number; skip: number } {
    return {
      take: pagination.limit || PAGINATION_CONSTANTS.DEFAULT_LIMIT,
      skip: pagination.offset || PAGINATION_CONSTANTS.DEFAULT_OFFSET,
    };
  }
}
