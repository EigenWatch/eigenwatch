import { PAGINATION_CONSTANTS } from "src/shared/constants/pagination.constants";
import { InvalidDateRangeException } from "src/shared/errors/app.exceptions";
import { BaseRepository } from "./base.repository";

export abstract class BaseService<T> {
  constructor(protected repository: BaseRepository<T>) {}

  protected validateDateRange(from: Date, to: Date): void {
    if (from > to) {
      throw new InvalidDateRangeException("Start date must be before end date");
    }

    const maxRange = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
    if (to.getTime() - from.getTime() > maxRange) {
      throw new InvalidDateRangeException("Date range cannot exceed 1 year");
    }
  }

  protected validatePagination(limit: number, offset: number): void {
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

  protected async enrichWithMetadata(entity: T): Promise<T> {
    // Override in subclasses to add computed fields
    return entity;
  }
}
