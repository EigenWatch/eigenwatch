import { AppException } from "src/shared/errors/app.exceptions";
import {
  ResponseMeta,
  ApiResponse,
  PaginationMeta,
} from "src/shared/types/api-response.types";

export class ResponseHelper {
  static ok<T>(
    data: T,
    message: string | null = null,
    meta?: Partial<ResponseMeta>
  ): ApiResponse<T> {
    return {
      success: true,
      message,
      data,
      meta: meta as ResponseMeta,
    };
  }

  static created<T>(
    data: T,
    message: string | null = "Resource created successfully",
    meta?: Partial<ResponseMeta>
  ): ApiResponse<T> {
    return {
      success: true,
      message,
      data,
      meta: meta as ResponseMeta,
    };
  }

  static fail(error: AppException): ApiResponse<null> {
    return {
      success: false,
      message: error.message,
      data: null,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    };
  }

  static paginated<T>(
    data: T[],
    pagination: PaginationMeta,
    message: string | null = null,
    meta?: Partial<ResponseMeta>
  ): ApiResponse<T[]> {
    return {
      success: true,
      message,
      data,
      pagination,
      meta: meta as ResponseMeta,
    };
  }
}
