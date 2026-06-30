import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus
} from "@nestjs/common";
import type { Response } from "express";

import { ApiException, createErrorContract } from "./api-error";
import { getRequestContext, type RequestWithContext } from "./request-context";

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestWithContext>();
    const response = context.getResponse<Response>();
    const requestContext = getRequestContext(request);
    const error =
      exception instanceof Error ? exception : new Error("Unexpected non-error exception.");
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    response.status(status).json({
      request_id: requestContext.requestId,
      correlation_id: requestContext.correlationId,
      success: false,
      data: null,
      error: createErrorContract(error instanceof ApiException ? error : error)
    });
  }
}
