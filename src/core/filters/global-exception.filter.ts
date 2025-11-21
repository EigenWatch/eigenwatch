/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Response } from "express";
import { ERROR_CODES } from "src/shared/constants/error-codes.constants";
import { AppException } from "src/shared/errors/app.exceptions";
import { ApiResponse } from "src/shared/types/api-response.types";

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorResponse: ApiResponse<null>;

    if (exception instanceof AppException) {
      status = exception.getStatus();
      errorResponse = {
        success: false,
        message: exception.message,
        data: null,
        error: {
          code: exception.code,
          message: exception.message,
          details: exception.details,
        },
        meta: {
          request_id: request.requestId,
          timestamp: new Date().toISOString(),
          execution_time_ms: 0,
        },
      };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const message =
        typeof exceptionResponse === "string"
          ? exceptionResponse
          : (exceptionResponse as any).message || "An error occurred";

      errorResponse = {
        success: false,
        message,
        data: null,
        error: {
          code: ERROR_CODES.INTERNAL_SERVER_ERROR,
          message,
        },
        meta: {
          request_id: request.requestId,
          timestamp: new Date().toISOString(),
          execution_time_ms: 0,
        },
      };
    } else {
      const error = exception as Error;
      this.logger.error("Unexpected error", error.stack);

      errorResponse = {
        success: false,
        message: "Internal server error",
        data: null,
        error: {
          code: ERROR_CODES.INTERNAL_SERVER_ERROR,
          message: "An unexpected error occurred",
        },
        meta: {
          request_id: request.requestId,
          timestamp: new Date().toISOString(),
          execution_time_ms: 0,
        },
      };
    }

    response.status(status).json(errorResponse);
  }
}
