import type { ToastSeverity } from "../platform/platform";

export type { ToastAdapter, ToastSeverity } from "../platform/platform";

export type ProcessingToastPayload = {
  titleKey?: string;
  severity?: ToastSeverity;
};

function isToastSeverity(value: unknown): value is ToastSeverity {
  return value === "default" || value === "success" || value === "warning" || value === "danger";
}

export function readToastMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const candidate = payload as Record<string, unknown>;

  if (typeof candidate.message === "string") return candidate.message;
  if (typeof candidate.description === "string") return candidate.description;

  return undefined;
}

export function readProcessingToastPayload(payload: unknown): ProcessingToastPayload | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Record<string, unknown>;

  return {
    titleKey: typeof candidate.titleKey === "string" ? candidate.titleKey : undefined,
    severity: isToastSeverity(candidate.severity) ? candidate.severity : undefined,
  };
}
