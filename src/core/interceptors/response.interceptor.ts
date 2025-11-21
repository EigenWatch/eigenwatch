import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { ApiResponse, ResponseMeta } from "src/shared/types/api-response.types";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest();
    const startTime = Date.now();
    const requestId = request.requestId || uuidv4();

    return next.handle().pipe(
      map((data) => {
        const executionTime = Date.now() - startTime;

        const meta: ResponseMeta = {
          request_id: requestId,
          timestamp: new Date().toISOString(),
          execution_time_ms: executionTime,
        };

        // If data is already an ApiResponse, return it with updated meta
        if (data && typeof data === "object" && "success" in data) {
          return {
            ...data,
            meta: { ...data.meta, ...meta },
          };
        }

        // Wrap raw data in ApiResponse format
        return {
          success: true,
          message: null,
          data,
          meta,
        };
      })
    );
  }
}
