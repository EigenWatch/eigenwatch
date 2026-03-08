import { DateRangeDto } from "src/shared/dto/date-range.dto";
import { FilterDto } from "src/shared/dto/filter.dto";
import { PaginationDto } from "src/shared/dto/pagination.dto";
import { SortDto } from "src/shared/dto/sort.dto";
import { BaseService } from "./base.service";

export abstract class BaseController<T> {
  constructor(protected service: BaseService<T>) {}

  protected handlePagination(query: PaginationDto) {
    return {
      limit: Number(query.limit),
      offset: Number(query.offset),
    };
  }

  protected handleFiltering(query: FilterDto) {
    return {
      search: query.search,
    };
  }

  protected handleSorting(query: SortDto) {
    return {
      sortBy: query.sort_by,
      sortOrder: query.sort_order,
    };
  }

  protected handleDateRange(query: DateRangeDto) {
    return {
      from: query.date_from ? new Date(query.date_from) : undefined,
      to: query.date_to ? new Date(query.date_to) : undefined,
    };
  }
}
