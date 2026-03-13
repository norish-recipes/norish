export interface ProviderInfo {
  id: string;
  name: string;
  icon: string;
  type?: "oauth" | "credential";
}

export interface AuthProvidersResponse {
  providers: ProviderInfo[];
  registrationEnabled: boolean;
  passwordAuthEnabled: boolean;
}

export type ApiKeyCreateInput = {
  body: {
    name: string;
    expiresIn: null;
    userId: string;
  };
};

export type ApiKeyCreateResult = {
  key: string;
  id: string;
  name: string | null;
  start: string | null;
  createdAt: Date;
  expiresAt: Date | null;
  enabled: boolean | null;
};

export type ApiKeyVerifyInput = {
  body: { key: string };
};

export type ApiKeyVerifyResult = {
  valid: boolean;
  key?: {
    userId: string;
  } | null;
};

export type ApiKeyAuthService = {
  createApiKey(input: ApiKeyCreateInput): Promise<ApiKeyCreateResult>;
  verifyApiKey(input: ApiKeyVerifyInput): Promise<ApiKeyVerifyResult>;
};
