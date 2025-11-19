export interface QueryParams {
  filters?: Record<string, any>;
  pagination?: PaginationParams;
  sorting?: SortingParams;
  dateRange?: DateRange;
}

export interface PaginationParams {
  limit: number;
  offset: number;
}

export interface SortingParams {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export interface DateRange {
  from: Date;
  to: Date;
}
