import { HttpStatus } from "@nestjs/common";

import { ApiException } from "./api-error";

const ulidPattern = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const codePattern = /^[a-z0-9_-]{2,128}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function requireDataEnvelope(body: unknown): Record<string, unknown> {
  if (!isRecord(body) || !isRecord(body.data)) {
    throwValidation("Request body must include a data object.", "data");
  }
  return body.data;
}

export function requireString(data: Record<string, unknown>, field: string): string {
  const value = data[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    throwValidation(`${field} must be a non-empty string.`, field);
  }
  return value.trim();
}

export function optionalString(data: Record<string, unknown>, field: string): string | undefined {
  const value = data[field];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throwValidation(`${field} must be a string.`, field);
  }
  return value.trim();
}

export function requireBoolean(data: Record<string, unknown>, field: string): boolean {
  const value = data[field];
  if (typeof value !== "boolean") {
    throwValidation(`${field} must be a boolean.`, field);
  }
  return value;
}

export function optionalBoolean(data: Record<string, unknown>, field: string, fallback: boolean): boolean {
  const value = data[field];
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== "boolean") {
    throwValidation(`${field} must be a boolean.`, field);
  }
  return value;
}

export function validateUlid(value: string, field: string): string {
  if (!ulidPattern.test(value)) {
    throwValidation(`${field} must be a valid ULID.`, field);
  }
  return value;
}

export function validateCode(value: string, field: string): string {
  if (!codePattern.test(value)) {
    throwValidation(`${field} must be a valid code.`, field);
  }
  return value;
}

export function validateEmail(value: string, field: string): string {
  if (!emailPattern.test(value)) {
    throwValidation(`${field} must be a valid email address.`, field);
  }
  return value;
}

export function rejectFields(data: Record<string, unknown>, fields: string[]): void {
  for (const field of fields) {
    if (field in data) {
      throwValidation(`${field} is not accepted by this endpoint.`, field);
    }
  }
}

export function throwValidation(message: string, affectedField: string | null): never {
  throw new ApiException({
    errorCode: "validation_error",
    message,
    userMessage: "Please check the submitted information.",
    status: HttpStatus.BAD_REQUEST,
    affectedField
  });
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
