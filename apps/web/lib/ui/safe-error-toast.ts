"use client";

import { toast } from "@heroui/react";

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
  if (error !== undefined) {
    log.error({ error, metadata }, context ?? title);
  }

  toast(title, {
    description,
    variant: toToastVariant(color ?? severity),
  });
}
