import type { ServerConfigKey } from "@norish/config/zod/server-config";

export type ProviderKey = "oidc" | "github" | "google";

export interface FieldDef {
  key: string;
  label: string;
  placeholder?: string;
  secret?: boolean;
  optional?: boolean;
}

export interface TestResult {
  success: boolean;
  error?: string;
}

export interface ProviderActionsProps {
  hasConfig: boolean;
  testing: boolean;
  saving: boolean;
  onTest: () => void;
  onSave: () => void;
  onDelete: () => void;
}

export interface DeleteProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  providerName: string;
}

export interface TestResultDisplayProps {
  result: TestResult | null;
}

export { ServerConfigKey };
