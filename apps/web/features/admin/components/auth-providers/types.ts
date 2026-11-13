import type { AuthProviderGitHubInput } from "@norish/config/zod/server-config";

export interface FieldDef {
  key: keyof AuthProviderGitHubInput;
  label: string;
  placeholder?: string;
  secret?: boolean;
  optional?: boolean;
}
