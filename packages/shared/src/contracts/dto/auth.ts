export interface ProviderInfo {
  id: string;
  name: string;
  icon: string;
  type?: "oauth" | "credential";
}

/** How each Sign-in Method is shown; OIDC goes by the administrator's name for it when it has one. */
export const SIGN_IN_METHODS = {
  credential: { id: "credential", name: "Email", icon: "mdi:email-outline", type: "credential" },
  github: { id: "github", name: "GitHub", icon: "mdi:github", type: "oauth" },
  google: { id: "google", name: "Google", icon: "flat-color-icons:google", type: "oauth" },
  oidc: { id: "oidc", name: "SSO", icon: "mdi:shield-account-outline", type: "oauth" },
} as const satisfies Record<string, ProviderInfo>;

/** Better Auth's error code for removing the last method the server offers. */
export const LAST_SIGN_IN_METHOD = "LAST_SIGN_IN_METHOD";

/** The `settings.user.signInMethods.errors` keys a refused add or remove can say. */
export type SignInMethodError =
  "usedByAnotherAccount" | "lastMethod" | "signInAgain" | "addFailed" | "removeFailed";

const SIGN_IN_METHOD_ERRORS: Record<string, SignInMethodError> = {
  account_already_linked_to_different_user: "usedByAnotherAccount",
  [LAST_SIGN_IN_METHOD]: "lastMethod",
  SESSION_NOT_FRESH: "signInAgain",
};

/** What a refused add or remove says, by Better Auth's error code; any other code is `fallback`. */
export const signInMethodError = (
  code: string | undefined,
  fallback: SignInMethodError
): SignInMethodError => SIGN_IN_METHOD_ERRORS[code ?? ""] ?? fallback;

type SignInAccount = { id: string; providerId: string };

/** Whether the accounts left after removing one still hold a method the server offers. */
export function keepsOfferedSignInMethod(
  accounts: readonly SignInAccount[],
  removedId: string | undefined,
  offered: ReadonlySet<string>
): boolean {
  return accounts.some((account) => account.id !== removedId && offered.has(account.providerId));
}

/** Whether the password can be changed: the server offers passwords and the account has one. */
export const hasPassword = (accounts: readonly SignInAccount[], offered: ReadonlySet<string>) =>
  offered.has(SIGN_IN_METHODS.credential.id) &&
  accounts.some((account) => account.providerId === SIGN_IN_METHODS.credential.id);

/** With one method on the server there is nothing to add or remove, only a password to change. */
export const showsSignInMethods = (offeredCount: number, passwordOffered: boolean) =>
  offeredCount > 1 || passwordOffered;

/** The OAuth providers the server offers that the account has not linked yet. */
export const addableProviders = <Provider extends ProviderInfo>(
  offered: readonly Provider[],
  accounts: readonly SignInAccount[]
) =>
  offered.filter(
    (provider) =>
      provider.type === "oauth" && !accounts.some((account) => account.providerId === provider.id)
  );

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
    referenceId: string;
  } | null;
};

export type ApiKeyAuthService = {
  createApiKey(input: ApiKeyCreateInput): Promise<ApiKeyCreateResult>;
  verifyApiKey(input: ApiKeyVerifyInput): Promise<ApiKeyVerifyResult>;
};
