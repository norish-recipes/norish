export interface ProviderInfo {
  id: string;
  name: string;
  icon: string;
  type?: "oauth" | "credential";
}
