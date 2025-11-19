export interface ApiResponse<T> {
  success: boolean;
  message: string | null;
  data: T | null;
  meta?: ResponseMeta;
  pagination?: PaginationMeta;
  error?: ErrorDetails;
}

export interface ResponseMeta {
  request_id: string;
  timestamp: string;
  execution_time_ms: number;
  data_freshness?: DataFreshness;
}

export interface DataFreshness {
  last_indexed_block: number;
  last_indexed_timestamp: string;
  blocks_behind: number;
}

export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
  next_offset?: number;
}

export interface ErrorDetails {
  code: string;
  message: string;
  details?: any;
}
