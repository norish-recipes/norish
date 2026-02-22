"use client";

import { addToast } from "@heroui/react";

import { createClientLogger } from "@norish/shared/lib/logger";

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

export function showSafeErrorToast({
  title,
  description,
  error,
  metadata,
  context,
  severity = "danger",
  color,
}: SafeErrorToastOptions): void {
  if (error !== undefined) {
    log.error({ error, metadata }, context ?? title);
  }

  addToast({
    title,
    description,
    severity,
    ...(color ? { color } : {}),
    shouldShowTimeoutProgress: true,
    radius: "full",
  });
}
