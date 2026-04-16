import type { CompatibleMessageTranslator } from "@norish/i18n";

export type ToastSeverity = "default" | "success" | "warning" | "danger";

export type ProcessingToastPayload = {
  titleKey?: string;
  severity?: ToastSeverity;
};

export type ToastAdapter = {
  show: (toast: {
    severity: ToastSeverity;
    title: string;
    description?: string;
    actionLabel?: string;
    onActionPress?: () => void;
  }) => void;
  translate: CompatibleMessageTranslator;
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
