"use client";

import { toast } from "@heroui/react";

import { createClientLogger } from "@norish/shared/lib/logger";
import { isQueuedDeliveryError } from "@norish/shared/lib/queued-delivery";

const log = createClientLogger("safe-error-toast");

type SafeErrorToastOptions = {
  title: string;
  description: string;
  error?: unknown;
  metadata?: Record<string, unknown>;
  context?: string;
  severity?: "danger" | "warning" | "success" | "default" | "primary" | "secondary";
  color?: "default" | "primary" | "secondary" | "success" | "warning" | "danger";
};

type SafeErrorDiagnostic = {
  name: string;
  message: string;
  code?: string | number;
  httpStatus?: number;
  cause?: SafeErrorDiagnostic;
};

function readStringOrNumber(value: unknown): string | number | undefined {
  return typeof value === "string" || typeof value === "number" ? value : undefined;
}

function readErrorCode(error: Record<string, unknown>): string | number | undefined {
  const data = error.data;
  const shape = error.shape;

  return (
    readStringOrNumber(error.code) ??
    (typeof data === "object" && data !== null
      ? readStringOrNumber((data as Record<string, unknown>).code)
      : undefined) ??
    (typeof shape === "object" && shape !== null
      ? readStringOrNumber(
          ((shape as Record<string, unknown>).data as Record<string, unknown> | undefined)?.code
        )
      : undefined)
  );
}

function readHttpStatus(error: Record<string, unknown>): number | undefined {
  const data = error.data;
  const shape = error.shape;
  const status =
    (typeof data === "object" && data !== null
      ? (data as Record<string, unknown>).httpStatus
      : undefined) ??
    (typeof shape === "object" && shape !== null
      ? ((shape as Record<string, unknown>).data as Record<string, unknown> | undefined)?.httpStatus
      : undefined);

  return typeof status === "number" ? status : undefined;
}

/**
 * Flatten an Error or tRPC error wrapper to non-sensitive diagnostics. Raw
 * objects are intentionally not logged because they may carry request or
 * response data.
 */
export function toSafeErrorDiagnostic(
  error: unknown,
  seen = new Set<object>()
): SafeErrorDiagnostic {
  if (typeof error === "string") {
    return { name: "Error", message: error };
  }

  if (typeof error !== "object" || error === null) {
    return { name: "Error", message: String(error) };
  }

  if (seen.has(error)) {
    return { name: "Error", message: "Circular error cause" };
  }

  seen.add(error);
  const value = error as Record<string, unknown>;
  const name = typeof value.name === "string" ? value.name : "Error";
  const message =
    typeof value.message === "string" && value.message.length > 0
      ? value.message
      : "Unknown client error";
  const cause = value.cause === undefined ? undefined : toSafeErrorDiagnostic(value.cause, seen);

  return {
    name,
    message,
    code: readErrorCode(value),
    httpStatus: readHttpStatus(value),
    cause,
  };
}

function toToastVariant(
  variant: NonNullable<SafeErrorToastOptions["severity"] | SafeErrorToastOptions["color"]>
) {
  if (variant === "primary" || variant === "secondary") return "accent";

  return variant;
}

export function showSafeErrorToast({
  title,
  description,
  error,
  metadata,
  context,
  severity = "danger",
  color,
}: SafeErrorToastOptions): void {
  if (isQueuedDeliveryError(error)) {
    return;
  }

  if (error !== undefined) {
    log.error({ error: toSafeErrorDiagnostic(error), metadata }, context ?? title);
  }

  toast(title, {
    description,
    variant: toToastVariant(color ?? severity),
  });
}
