import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile
} from "@nestjs/common";
import { map, type Observable } from "rxjs";

import { getRequestContext, type RequestWithContext } from "./request-context";

export interface ApiEnvelope<T> {
  request_id: string;
  correlation_id: string;
  success: boolean;
  data: T | null;
  error: null;
}

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Observable<ApiEnvelope<unknown> | StreamableFile> {
    const request = context.switchToHttp().getRequest<RequestWithContext>();

    return next.handle().pipe(
      map((data: unknown) => {
        if (data instanceof StreamableFile) {
          return data;
        }
        const requestContext = getRequestContext(request);
        return {
          request_id: requestContext.requestId,
          correlation_id: requestContext.correlationId,
          success: true,
          data,
          error: null
        };
      })
    );
  }
}
