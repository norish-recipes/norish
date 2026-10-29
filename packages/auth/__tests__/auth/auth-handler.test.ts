// @vitest-environment node
/**
 * The real auth config through Better Auth's HTTP handler: OIDC sign-in
 * against a fake identity provider that signs RS256 ID tokens, sign-out, API
 * keys, account deletion and rate limits, with a real Valkey for state, sessions
 * and counters. Better Auth's memory adapter stands in for Postgres, so the
 * encrypted-email adapter runs as shipped.
 */
import type { StartedValkeyContainer } from "@testcontainers/valkey";
import { ValkeyContainer } from "@testcontainers/valkey";
import Valkey from "ioredis";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { getValkeyConnectionOptions } from "@norish/shared-server/valkey/client";

import type { Identity } from "../helpers/identity-provider";
import { VALKEY_IMAGE, valkeyUrl } from "../../../shared-server/__tests__/helpers/valkey";
import { createIdentityProvider, IDP_CLIENT_ID } from "../helpers/identity-provider";

const { store, client, registration, serverConfig, admins } = vi.hoisted(() => ({
  store: { user: [], session: [], account: [], verification: [], apikey: [] } as Record<
    string,
    unknown[]
  >,
  client: { valkey: null as unknown },
  registration: { enabled: true },
  // What the sign-in page reads to offer a method.
  serverConfig: {} as Record<string, unknown>,
  admins: new Set<string>(),
}));

vi.mock("better-auth/adapters/drizzle", async () => {
  const { memoryAdapter } = await import("better-auth/adapters/memory");

  return { drizzleAdapter: () => memoryAdapter(store) };
});

vi.mock("@norish/db/drizzle", () => ({ db: {} }));
vi.mock("@norish/db/repositories/api-keys", () => ({ setApiKeyAuthService: vi.fn() }));
vi.mock("@norish/db/repositories/server-config", () => ({
  setConfig: vi.fn(),
  getConfig: async (key: string) => serverConfig[key] ?? null,
}));
vi.mock("@norish/db/repositories/users", () => ({
  countUsers: vi.fn().mockResolvedValue(2),
  deleteUser: vi.fn(),
  isUserServerOwner: async () => false,
  setUserAdminStatus: async (userId: string, isAdmin: boolean) => {
    if (isAdmin) admins.add(userId);
    else admins.delete(userId);
  },
}));
vi.mock("@norish/db/repositories/households", () => ({ getHouseholdForUser: vi.fn() }));
vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  isRegistrationEnabled: async () => registration.enabled,
}));
vi.mock("@norish/shared-server/media/avatar-cleanup", () => ({ sweepUserAvatars: vi.fn() }));
vi.mock("@norish/shared-server/realtime/connection", () => ({
  emitConnectionInvalidation: vi.fn(),
}));
vi.mock("@norish/shared-server/logger", () => {
  const logger = { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() };

  return { authLogger: logger, trpcLogger: logger, createLogger: () => logger };
});
vi.mock("@norish/shared-server/valkey/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/shared-server/valkey/client")>()),
  getPublisherClient: async () => client.valkey,
}));

const AUTH_URL = "http://localhost:3000";
const CALLBACK = `${AUTH_URL}/api/auth/callback/oidc`;
const idp = createIdentityProvider();
let container: StartedValkeyContainer;
let valkey: Valkey;
let issuer: string;

type AuthModule = typeof import("@norish/auth/auth");
let authModule: AuthModule;

function cookiesFrom(response: Response, previous = ""): string {
  const jar = new Map(
    previous
      .split("; ")
      .filter(Boolean)
      .map((pair) => pair.split("=") as [string, string])
  );

  for (const cookie of response.headers.getSetCookie()) {
    const [pair = ""] = cookie.split(";");
    const index = pair.indexOf("=");

    jar.set(pair.slice(0, index), pair.slice(index + 1));
  }

  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

function post(path: string, body: unknown, cookie = "", forwardedFor = "203.0.113.7"): Request {
  return new Request(`${AUTH_URL}/api/auth${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: AUTH_URL,
      "x-forwarded-for": forwardedFor,
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

/** Clicks the provider button, signs in at the provider and lands back on Norish. */
async function signInWithOIDC(identity: Identity, options?: { forged?: boolean }) {
  const { auth } = authModule;
  const start = await auth.handler(
    post("/sign-in/social", { provider: "oidc", callbackURL: "/", errorCallbackURL: "/auth-error" })
  );
  const { url } = (await start.json()) as { url: string };
  const authorizationUrl = new URL(url);
  const callback = idp.authorize(authorizationUrl, identity, options);
  const response = await auth.handler(
    new Request(callback, { headers: { cookie: cookiesFrom(start) } })
  );

  return { authorizationUrl, response, cookie: cookiesFrom(response) };
}

async function sessionFor(cookie: string) {
  return authModule.auth.api.getSession({ headers: new Headers({ cookie }) });
}

/** Signs up with a password, as the person who later adds other methods. */
async function signUpWithPassword(email = "ada@norish.test") {
  const response = await authModule.auth.handler(
    post("/sign-up/email", { email, password: "ada-password-1", name: "Ada" })
  );

  expect(response.status).toBe(200);

  const cookie = cookiesFrom(response);

  return { cookie, userId: (await sessionFor(cookie))?.user.id ?? "" };
}

/** Presses "Add" on the card for OIDC and signs in at the provider. */
async function addOIDC(cookie: string, identity: Identity) {
  const start = await authModule.auth.handler(
    post(
      "/link-social",
      { provider: "oidc", callbackURL: "/settings", errorCallbackURL: "/settings" },
      cookie
    )
  );

  if (!start.ok) return start;

  const { url } = (await start.json()) as { url: string };
  const callback = idp.authorize(new URL(url), identity);

  return authModule.auth.handler(
    new Request(callback, { headers: { cookie: cookiesFrom(start, cookie) } })
  );
}

async function providersOf(userId: string) {
  const ctx = await context();

  return (await ctx.internalAdapter.findAccounts(userId)).map((a) => a.providerId).sort();
}

async function removeMethod(cookie: string, providerId: string) {
  const ctx = await context();
  const session = await sessionFor(cookie);
  const accounts = await ctx.internalAdapter.findAccounts(session?.user.id ?? "");
  const account = accounts.find((a) => a.providerId === providerId);

  return authModule.auth.handler(post("/unlink-account", { accountId: account?.id }, cookie));
}

async function context() {
  return authModule.auth.$context;
}

async function importAuth(): Promise<AuthModule> {
  vi.resetModules();

  const { setAuthProviderCache } = await import("@norish/auth/provider-cache");

  setAuthProviderCache({
    github: { clientId: "github-id", clientSecret: "github-secret", isOverridden: false },
    google: { clientId: "google-id", clientSecret: "google-secret", isOverridden: false },
    oidc: {
      name: "Test IdP",
      issuer,
      clientId: IDP_CLIENT_ID,
      clientSecret: "secret",
      isOverridden: false,
      claimConfig: {
        enabled: true,
        scopes: [],
        groupsClaim: "groups",
        adminGroup: "norish_admin",
        householdPrefix: "norish_household_",
      },
    },
    passwordEnabled: true,
  });

  return import("@norish/auth/auth");
}

beforeAll(async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("AUTH_URL", AUTH_URL);
  vi.stubEnv("AUTH_RATE_LIMIT_ENABLED", "true");
  vi.stubEnv("TRUSTED_PROXIES", "10.0.0.0/24");
  container = await new ValkeyContainer(VALKEY_IMAGE).start();
  valkey = new Valkey(getValkeyConnectionOptions(valkeyUrl(container)));
  client.valkey = valkey;
  issuer = await idp.start();
  authModule = await importAuth();
}, 60_000);

afterAll(async () => {
  vi.unstubAllEnvs();
  await idp.stop();
  await valkey?.quit();
  await container?.stop();
});

beforeEach(async () => {
  for (const rows of Object.values(store)) rows.length = 0;
  await valkey.flushall();
  registration.enabled = true;
  admins.clear();
  Object.assign(serverConfig, {
    password_auth_enabled: true,
    auth_provider_github: { clientId: "github-id" },
    auth_provider_google: { clientId: "google-id" },
    auth_provider_oidc: { name: "Test IdP", issuer, clientId: IDP_CLIENT_ID },
  });
});

const ADA: Identity = {
  sub: "ada-sub",
  email: "ada@example.com",
  email_verified: true,
  name: "Ada",
};

describe("OIDC sign-in", () => {
  it("creates the user on first sign-in and keys the account on the subject", async () => {
    const { response, cookie } = await signInWithOIDC(ADA);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).not.toContain("error");

    const session = await sessionFor(cookie);

    expect(session?.user.email).toBe(ADA.email);
    expect(store.account).toEqual([
      expect.objectContaining({ providerId: "oidc", accountId: ADA.sub }),
    ]);
  });

  it("signs a returning user in to the same account", async () => {
    const first = await signInWithOIDC(ADA);
    const firstUser = (await sessionFor(first.cookie))?.user.id;
    const second = await signInWithOIDC(ADA);

    expect((await sessionFor(second.cookie))?.user.id).toBe(firstUser);
    expect(store.user).toHaveLength(1);
    expect(store.account).toHaveLength(1);
  });

  it("sends the callback URL the docs tell administrators to register", async () => {
    const { authorizationUrl } = await signInWithOIDC(ADA);

    expect(authorizationUrl.searchParams.get("redirect_uri")).toBe(CALLBACK);
    expect(idp.tokenRequests.at(-1)?.get("redirect_uri")).toBe(CALLBACK);
  });

  it("refuses an ID token the provider's key did not sign", async () => {
    const { response } = await signInWithOIDC(ADA, { forged: true });

    expect(response.headers.get("location")).toContain("error=unable_to_get_user_info");
    expect(store.user).toHaveLength(0);
  });

  it("sends a new user to the error page while registration is closed", async () => {
    registration.enabled = false;

    const { response } = await signInWithOIDC(ADA);

    expect(response.headers.get("location")).toContain(
      "/auth-error?error=REGISTRATION_IS_CURRENTLY_DISABLED"
    );
    expect(store.user).toHaveLength(0);
  });
});

describe("account linking", () => {
  it("refuses to link an OIDC sign-in to an existing user with the same verified email", async () => {
    const ctx = await context();
    const { user } = await ctx.internalAdapter.createOAuthUser(
      { email: ADA.email, name: "Ada", emailVerified: true },
      { providerId: "google", accountId: "google-1" }
    );

    const { response } = await signInWithOIDC(ADA);

    expect(response.headers.get("location")).toContain("/auth-error?error=account_not_linked");
    expect((await ctx.internalAdapter.findAccounts(user.id)).map((a) => a.providerId)).toEqual([
      "google",
    ]);
  });
});

describe("adding a sign-in method", () => {
  const HOME_LAN: Identity = { sub: "ada-home", email: "ada@home.lan", name: "Ada" };

  it("lets a password user add OIDC with another email and sign in with it", async () => {
    const { cookie, userId } = await signUpWithPassword();

    const response = await addOIDC(cookie, HOME_LAN);

    expect(response.headers.get("location")).toBe("/settings");
    expect(await providersOf(userId)).toEqual(["credential", "oidc"]);

    const { cookie: oidcCookie } = await signInWithOIDC(HOME_LAN);

    expect((await sessionFor(oidcCookie))?.user.id).toBe(userId);
    expect(store.user).toHaveLength(1);
  });

  it("applies the OIDC admin claim at once", async () => {
    const { cookie, userId } = await signUpWithPassword();

    await addOIDC(cookie, { ...HOME_LAN, groups: ["norish_admin"] });

    expect(admins.has(userId)).toBe(true);
  });

  it("refuses an identity that signs in to another account", async () => {
    await signInWithOIDC(ADA);
    const { cookie, userId } = await signUpWithPassword("someone@norish.test");

    const response = await addOIDC(cookie, ADA);

    expect(response.headers.get("location")).toBe(
      "/settings?error=account_already_linked_to_different_user"
    );
    expect(await providersOf(userId)).toEqual(["credential"]);
  });

  it("refuses a second identity for a provider the user already has", async () => {
    const { cookie, userId } = await signUpWithPassword();

    await addOIDC(cookie, HOME_LAN);
    const response = await addOIDC(cookie, ADA);

    expect(response.headers.get("location")).toBe("/settings?error=unable_to_link_account");
    expect(await providersOf(userId)).toEqual(["credential", "oidc"]);
  });
});

describe("choosing the account to add", () => {
  const startAdd = async (provider: string, cookie: string) => {
    const response = await authModule.auth.handler(
      post("/link-social", { provider, callbackURL: "/settings" }, cookie)
    );

    return new URL(((await response.json()) as { url: string }).url);
  };

  it("asks for a fresh sign-in at a provider that lists no account picker", async () => {
    const { cookie } = await signUpWithPassword();

    expect((await startAdd("oidc", cookie)).searchParams.get("prompt")).toBe("login");

    const { authorizationUrl } = await signInWithOIDC(ADA);

    expect(authorizationUrl.searchParams.get("prompt")).toBeNull();
  });

  it("shows the account picker of a provider that lists one", async () => {
    const { cookie } = await signUpWithPassword();

    idp.promptValues = ["none", "login", "consent", "select_account"];

    try {
      expect((await startAdd("oidc", cookie)).searchParams.get("prompt")).toBe("select_account");
    } finally {
      idp.promptValues = undefined;
    }
  });

  it("shows Google's and GitHub's account pickers when adding", async () => {
    const { cookie } = await signUpWithPassword();

    expect((await startAdd("google", cookie)).searchParams.get("prompt")).toBe("select_account");
    expect((await startAdd("github", cookie)).searchParams.get("prompt")).toBe("select_account");
  });
});

describe("adding a sign-in method twice at once", () => {
  it("keeps one identity per provider when two adds finish", async () => {
    const { cookie, userId } = await signUpWithPassword();
    const start = () =>
      authModule.auth.handler(
        post(
          "/link-social",
          { provider: "oidc", callbackURL: "/settings", errorCallbackURL: "/settings" },
          cookie
        )
      );
    const [first, second] = [await start(), await start()];
    const finish = async (started: Response, identity: Identity) => {
      const { url } = (await started.json()) as { url: string };
      const callback = idp.authorize(new URL(url), identity);

      return authModule.auth.handler(
        new Request(callback, { headers: { cookie: cookiesFrom(started, cookie) } })
      );
    };

    await finish(first, ADA);
    const response = await finish(second, { ...ADA, sub: "ada-other" });

    expect(response.headers.get("location")).toContain("/settings?error=");
    expect(await providersOf(userId)).toEqual(["credential", "oidc"]);
  });
});

describe("removing a sign-in method", () => {
  it("removes one while another offered method remains", async () => {
    const { cookie, userId } = await signUpWithPassword();

    await addOIDC(cookie, ADA);
    const response = await removeMethod(cookie, "oidc");

    expect(response.status).toBe(200);
    expect(await providersOf(userId)).toEqual(["credential"]);
  });

  it("refuses to remove the last method the server offers", async () => {
    const { cookie, userId } = await signUpWithPassword();

    await addOIDC(cookie, ADA);
    serverConfig.auth_provider_oidc = null;

    const response = await removeMethod(cookie, "credential");

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "LAST_SIGN_IN_METHOD" });
    expect(await providersOf(userId)).toEqual(["credential", "oidc"]);
  });

  it("does not count a password while password sign-in is off", async () => {
    const { cookie, userId } = await signUpWithPassword();

    await addOIDC(cookie, ADA);
    serverConfig.password_auth_enabled = false;

    expect((await removeMethod(cookie, "oidc")).status).toBe(400);
    expect((await removeMethod(cookie, "credential")).status).toBe(200);
    expect(await providersOf(userId)).toEqual(["oidc"]);
  });
});

describe("sign-out", () => {
  it("ends the session without sending the user to the provider's logout page", async () => {
    const { cookie } = await signInWithOIDC(ADA);

    const response = await authModule.auth.handler(post("/sign-out", {}, cookie));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(await response.json()).not.toHaveProperty("url");
    expect(await sessionFor(cookie)).toBeNull();
  });
});

describe("API keys", () => {
  it("signs a request in as the key's owner", async () => {
    const { cookie } = await signInWithOIDC(ADA);
    const userId = (await sessionFor(cookie))?.user.id ?? "";
    const { key } = await authModule.auth.api.createApiKey({ body: { userId, name: "Scripts" } });

    const session = await authModule.auth.api.getSession({
      headers: new Headers({ "x-api-key": key }),
    });

    expect(session?.user.id).toBe(userId);
  });
});

describe("account deletion", () => {
  it("ends every session of the deleted user at once", async () => {
    const first = await signInWithOIDC(ADA);
    const second = await signInWithOIDC(ADA);
    const userId = (await sessionFor(first.cookie))?.user.id ?? "";
    const { deleteUserAccount } = await import("@norish/auth/account-deletion");

    await deleteUserAccount(userId);

    expect(await sessionFor(first.cookie)).toBeNull();
    expect(await sessionFor(second.cookie)).toBeNull();
  });
});

describe("rate limiting", () => {
  it("answers the fourth sign-in attempt within ten seconds with 429", async () => {
    const attempt = () =>
      authModule.auth.handler(post("/sign-in/email", { email: ADA.email, password: "wrong-pass" }));
    const statuses = [];

    for (let i = 0; i < 4; i++) statuses.push((await attempt()).status);

    expect(statuses.slice(0, 3)).not.toContain(429);
    expect(statuses[3]).toBe(429);
  });

  it("limits each visitor on their own behind two trusted proxies", async () => {
    // A second proxy appends the first one's address, so the header holds two hops.
    const attempt = (visitor: string) =>
      authModule.auth.handler(
        post(
          "/sign-in/email",
          { email: ADA.email, password: "wrong-pass" },
          "",
          `${visitor}, 10.0.0.2`
        )
      );

    for (let i = 0; i < 3; i++) await attempt("198.51.100.1");

    expect((await attempt("198.51.100.1")).status).toBe(429);
    expect((await attempt("198.51.100.2")).status).not.toBe(429);
  });
});

describe("an identity provider that is down when Norish starts", () => {
  it("turns OIDC sign-in on once the provider can be reached again", async () => {
    const port = Number(new URL(issuer).port);

    await idp.stop();

    try {
      authModule = await importAuth();

      // Held the way the auth route holds it.
      const handler = authModule.auth.handler;
      const startSignIn = () =>
        handler(post("/sign-in/social", { provider: "oidc", callbackURL: "/" }));

      expect((await startSignIn()).status).toBe(404);

      // Better Auth asks a provider it skipped at startup again on the next sign-in with it.
      await idp.start(port);
      expect((await startSignIn()).status).toBe(200);
    } finally {
      if (!idp.listening) await idp.start(port);
    }
  });

  it("keeps answering session checks while a provider that never responds is retried", async () => {
    const port = Number(new URL(issuer).port);

    await idp.stop();
    vi.useFakeTimers({ toFake: ["Date"] });

    try {
      authModule = await importAuth();
      expect(
        (
          await authModule.auth.handler(
            post("/sign-in/social", { provider: "oidc", callbackURL: "/" })
          )
        ).status
      ).toBe(404);

      idp.hanging = true;
      await idp.start(port);
      vi.setSystemTime(Date.now() + 30_000);

      // The replacement's discovery request never gets an answer.
      await expect(authModule.auth.api.getSession({ headers: new Headers() })).resolves.toBeNull();
    } finally {
      vi.useRealTimers();
      idp.hanging = false;
      if (!idp.listening) await idp.start(port);
    }
  });
});
