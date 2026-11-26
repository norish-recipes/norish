// @vitest-environment node
/**
 * The real auth config against Postgres: every response decrypts a user's email, name and image
 * from ciphertext, and the session store keeps only ciphertext.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { decrypt } from "@norish/config/crypto";
import { users } from "@norish/db/schema";

import { cleanDatabase, getTestDb } from "../../../db/__tests__/helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../db/__tests__/helpers/repository-test-base";

const { valkey } = vi.hoisted(() => ({ valkey: new Map<string, string>() }));

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  isRegistrationEnabled: vi.fn().mockResolvedValue(true),
}));
vi.mock("@norish/auth/claim-processor", () => ({
  getPendingOIDCProfile: vi.fn(),
  mergeOIDCTokenClaims: vi.fn(),
  processClaimsForUser: vi.fn(),
  storeOIDCProfile: vi.fn(),
}));
vi.mock("@norish/shared-server/logger", () => {
  const logger = { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() };

  return { authLogger: logger, dbLogger: logger, createLogger: () => logger };
});
vi.mock("@norish/shared-server/valkey/client", () => ({
  getPublisherClient: async () => ({
    get: async (key: string) => valkey.get(key) ?? null,
    set: async (key: string, value: string) => valkey.set(key, value),
    setex: async (key: string, _ttl: number, value: string) => valkey.set(key, value),
    del: async (key: string) => valkey.delete(key),
    // The API key's request counter: always the first request of its window.
    eval: async () => 1,
  }),
}));

type AuthModule = typeof import("@norish/auth/auth");

const testBase = new RepositoryTestBase("test_encrypted_user_fields");
let authModule: AuthModule;

const ADA = { email: "ada@norish.test", name: "Ada", image: "https://example.com/ada.png" };
const NOT_CIPHERTEXT = Buffer.from("not ciphertext at all, just bytes").toString("base64");

async function signUp() {
  const { headers, response } = await authModule.auth.api.signUpEmail({
    body: { email: ADA.email, password: "ada-password-1", name: ADA.name, image: ADA.image },
    returnHeaders: true,
  });
  const [cookie = ""] = (headers.get("set-cookie") ?? "").split(";");

  return { ...response, token: response.token!, cookie };
}

const getSession = (cookie: string) =>
  authModule.auth.api.getSession({ headers: new Headers({ cookie }) });

const signIn = () =>
  authModule.auth.api.signInEmail({ body: { email: ADA.email, password: "ada-password-1" } });

/** Signs in with Google on a phone: the app hands over the ID token Google gave it. */
async function signInWithGoogleIdToken() {
  const ctx = await authModule.auth.$context;
  const google = ctx.socialProviders.find((provider) => provider.id === "google");

  if (!google) throw new Error("Google is configured for this suite");

  // Google's signature check and profile, without Google.
  google.options = { ...google.options, verifyIdToken: async () => true };
  google.getUserInfo = async () => ({
    user: { id: "google-1", ...ADA, emailVerified: true },
    data: { sub: "google-1" },
  });

  return authModule.auth.api.signInSocial({
    body: { provider: "google", idToken: { token: "google-id-token" } },
  });
}

/** The user the session store keeps for `token`. */
function storedSessionUser(token: string) {
  const stored = valkey.get(token);

  if (!stored) throw new Error(`No session stored for ${token}`);

  return (JSON.parse(stored) as { user: typeof ADA }).user;
}

function expectPlaintext(user: { email: string; name: string; image?: string | null }) {
  expect({ email: user.email, name: user.name, image: user.image }).toEqual(ADA);
}

/** Ciphertext of the user's own values, as Postgres holds them. */
function expectCiphertext(user: typeof ADA) {
  for (const field of ["email", "name", "image"] as const) {
    expect(user[field]).not.toBe(ADA[field]);
    expect(decrypt(user[field])).toBe(ADA[field]);
  }
}

async function corruptStoredName() {
  await getTestDb().update(users).set({ name: NOT_CIPHERTEXT });
}

beforeAll(async () => {
  await testBase.setup();

  const { setAuthProviderCache } = await import("@norish/auth/provider-cache");

  setAuthProviderCache({
    github: null,
    google: { clientId: "google-id", clientSecret: "google-secret", isOverridden: false },
    oidc: null,
    passwordEnabled: true,
  });
  authModule = await import("@norish/auth/auth");
}, 180_000);

beforeEach(async () => {
  valkey.clear();
  await cleanDatabase();
});

afterAll(async () => {
  await testBase.teardown();
});

describe("a user's encrypted fields", () => {
  it("come back in plain text from a password sign-up, and stay encrypted in the session store", async () => {
    const { token, user } = await signUp();

    expectPlaintext(user);
    expectCiphertext(storedSessionUser(token));
  });

  it("come back in plain text from a password sign-in, and stay encrypted in the session store", async () => {
    await signUp();

    const { token, user } = await signIn();

    expectPlaintext(user);
    expectCiphertext(storedSessionUser(token));
  });

  it("come back in plain text from a session fetch, and stay encrypted in the session store", async () => {
    const { token, cookie } = await signUp();

    const session = await getSession(cookie);

    expect(session?.session.token).toBe(token);
    expectPlaintext(session!.user);
    expectCiphertext(storedSessionUser(token));
  });

  it("come back in plain text to the server for a session an API key opens", async () => {
    const { user } = await signUp();
    const { key } = await authModule.auth.api.createApiKey({ body: { userId: user.id } });
    const { getVerifiedSession } = await import("@norish/auth/session");

    const identity = await getVerifiedSession(new Headers({ "x-api-key": key }));

    expect(identity?.id).toBe(user.id);
    expectPlaintext({ ...identity!, image: identity!.image });
  });

  it("come back in plain text from a phone's Google sign-in for a new user", async () => {
    const { token, user } = await signInWithGoogleIdToken();

    expectPlaintext(user);
    expectCiphertext(storedSessionUser(token));
  });

  it("come back in plain text from a phone's Google sign-in for an existing user", async () => {
    const first = await signInWithGoogleIdToken();

    const { token, user } = await signInWithGoogleIdToken();

    expect(user.id).toBe(first.user.id);
    expectPlaintext(user);
    expectCiphertext(storedSessionUser(token));
  });

  it("make a sign-in fail rather than hand back a stored value that does not decrypt", async () => {
    await signUp();
    await corruptStoredName();

    await expect(signIn()).rejects.toThrow();
  });

  it("make a session fetch fail rather than hand back a stored value that does not decrypt", async () => {
    const { token, cookie } = await signUp();
    const stored = JSON.parse(valkey.get(token)!) as { user: typeof ADA };

    valkey.set(
      token,
      JSON.stringify({ ...stored, user: { ...stored.user, name: NOT_CIPHERTEXT } })
    );

    await expect(getSession(cookie)).rejects.toThrow();
  });
});
