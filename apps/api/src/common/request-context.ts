import type { Request, Response, NextFunction } from "express";
import { ulid } from "ulid";

export interface RequestContext {
  requestId: string;
  correlationId: string;
}

export type RequestWithContext = Request & {
  requestContext?: RequestContext;
};

export function requestContextMiddleware(
  request: RequestWithContext,
  response: Response,
  next: NextFunction
): void {
  const requestId = readHeader(request, "x-request-id") ?? `req_${ulid()}`;
  const correlationId = readHeader(request, "x-correlation-id") ?? `corr_${ulid()}`;

  request.requestContext = {
    requestId,
    correlationId
  };
  response.setHeader("x-request-id", requestId);
  response.setHeader("x-correlation-id", correlationId);
  next();
}

export function getRequestContext(request: RequestWithContext): RequestContext {
  return (
    request.requestContext ?? {
      requestId: `req_${ulid()}`,
      correlationId: `corr_${ulid()}`
    }
  );
}

function readHeader(request: Request, headerName: string): string | undefined {
  const value = request.headers[headerName];
  return Array.isArray(value) ? value[0] : value;
}
