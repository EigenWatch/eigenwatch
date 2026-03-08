import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Prisma } from ".prisma/analytics-client";
import { Response } from "express";
import { ERROR_CODES } from "src/shared/constants/error-codes.constants";
import { ApiResponse } from "src/shared/types/api-response.types";

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Database error occurred";
    let code: string = ERROR_CODES.DATABASE_ERROR;

    switch (exception.code) {
      case "P2025":
        status = HttpStatus.NOT_FOUND;
        message = "Record not found";
        code = ERROR_CODES.NOT_FOUND;
        break;
      case "P2024":
        status = HttpStatus.GATEWAY_TIMEOUT;
        message = "Database connection timeout";
        code = ERROR_CODES.CONNECTION_ERROR;
        break;
      case "P2002":
        status = HttpStatus.CONFLICT;
        message = "Unique constraint violation";
        code = ERROR_CODES.DATABASE_ERROR;
        break;
      default:
        this.logger.error(
          `Unhandled Prisma error: ${exception.code}`,
          exception.message,
        );
    }

    const errorResponse: ApiResponse<null> = {
      success: false,
      message,
      data: null,
      error: {
        code,
        message,
        details: { prismaCode: exception.code },
      },
      meta: {
        request_id: request.requestId,
        timestamp: new Date().toISOString(),
        execution_time_ms: 0,
      },
    };

    response.status(status).json(errorResponse);
  }
}
