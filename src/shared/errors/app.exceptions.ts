import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../constants/error-codes.constants';

export class AppException extends HttpException {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    statusCode: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
    public readonly details?: any,
  ) {
    super({ code, message, details }, statusCode);
  }
}

// Specific exception types
export class OperatorNotFoundException extends AppException {
  constructor(operatorId: string) {
    super(
      'OPERATOR_NOT_FOUND',
      `Operator with ID ${operatorId} not found`,
      HttpStatus.NOT_FOUND,
      { operatorId },
    );
  }
}

export class InvalidDateRangeException extends AppException {
  constructor(message: string = 'Invalid date range provided') {
    super('INVALID_DATE_RANGE', message, HttpStatus.BAD_REQUEST);
  }
}

export class RateLimitExceededException extends AppException {
  constructor() {
    super(
      'RATE_LIMIT_EXCEEDED',
      'Rate limit exceeded. Please try again later.',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

export class UnauthorizedException extends AppException {
  constructor(message: string = 'Unauthorized') {
    super('UNAUTHORIZED', message, HttpStatus.UNAUTHORIZED);
  }
}

export class InvalidApiKeyException extends AppException {
  constructor() {
    super(
      'INVALID_API_KEY',
      'Invalid API key provided',
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class InsufficientDataException extends AppException {
  constructor(message: string = 'Insufficient data available') {
    super('INSUFFICIENT_DATA', message, HttpStatus.NOT_FOUND);
  }
}
