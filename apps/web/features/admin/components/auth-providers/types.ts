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
