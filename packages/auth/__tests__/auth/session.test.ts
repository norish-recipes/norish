/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getVerifiedSession,
  readSessionPrincipal,
  verifySessionPrincipal,
} from "@norish/auth/session";

const mockGetSession = vi.fn();
const mockDeleteSession = vi.fn();
const mockGetUserSessionIdentity = vi.fn();

vi.mock("@norish/auth/auth", () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
    $context: Promise.resolve({
      internalAdapter: {
        deleteSession: (...args: unknown[]) => mockDeleteSession(...args),
      },
    }),
  },
}));

vi.mock("@norish/db/repositories/users", () => ({
  getUserSessionIdentity: (...args: unknown[]) => mockGetUserSessionIdentity(...args),
}));

vi.mock("@norish/shared-server/logger", () => ({
  authLogger: { warn: vi.fn(), error: vi.fn(), debug: vi.fn(), info: vi.fn() },
}));

const identity = {
  id: "user-1",
  email: "a@example.com",
  name: "A",
  image: null,
  version: 3,
  isServerAdmin: false,
};

const headers = new Headers();

beforeEach(() => {
  vi.clearAllMocks();
});

describe("readSessionPrincipal", () => {
  it("returns null when there is no session", async () => {
    mockGetSession.mockResolvedValue(null);

    await expect(readSessionPrincipal(headers)).resolves.toBeNull();
  });

  it("carries the token alongside the claimed user", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1" },
      session: { token: "tok-1" },
    });

    await expect(readSessionPrincipal(headers)).resolves.toEqual({
      userId: "user-1",
      token: "tok-1",
    });
  });

  it("tolerates a session shape without a token, as API keys produce", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "user-1" } });

    await expect(readSessionPrincipal(headers)).resolves.toEqual({
      userId: "user-1",
      token: undefined,
    });
  });
});

describe("verifySessionPrincipal", () => {
  it("returns the identity the database holds, not the cached one", async () => {
    mockGetUserSessionIdentity.mockResolvedValue({ ...identity, isServerAdmin: true });

    const result = await verifySessionPrincipal({ userId: "user-1", token: "tok-1" });

    expect(result).toEqual({ ...identity, isServerAdmin: true });
    expect(mockDeleteSession).not.toHaveBeenCalled();
  });

  it("rejects and revokes a session whose user no longer exists", async () => {
    mockGetUserSessionIdentity.mockResolvedValue(null);

    const result = await verifySessionPrincipal({ userId: "gone", token: "tok-1" });

    expect(result).toBeNull();
    expect(mockDeleteSession).toHaveBeenCalledWith("tok-1");
  });

  it("rejects without revoking when there is no token to revoke", async () => {
    mockGetUserSessionIdentity.mockResolvedValue(null);

    const result = await verifySessionPrincipal({ userId: "gone", token: undefined });

    expect(result).toBeNull();
    expect(mockDeleteSession).not.toHaveBeenCalled();
  });

  it("still rejects when revoking the stale session fails", async () => {
    mockGetUserSessionIdentity.mockResolvedValue(null);
    mockDeleteSession.mockRejectedValue(new Error("redis down"));

    await expect(verifySessionPrincipal({ userId: "gone", token: "tok-1" })).resolves.toBeNull();
  });
});

describe("getVerifiedSession", () => {
  it("resolves an identity for a live user", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "user-1" }, session: { token: "tok-1" } });
    mockGetUserSessionIdentity.mockResolvedValue(identity);

    await expect(getVerifiedSession(headers)).resolves.toEqual(identity);
  });

  it("returns null for a session that outlived its user", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "gone" }, session: { token: "tok-1" } });
    mockGetUserSessionIdentity.mockResolvedValue(null);

    await expect(getVerifiedSession(headers)).resolves.toBeNull();
    expect(mockDeleteSession).toHaveBeenCalledWith("tok-1");
  });

  it("does not touch the database when there is no session at all", async () => {
    mockGetSession.mockResolvedValue(null);

    await expect(getVerifiedSession(headers)).resolves.toBeNull();
    expect(mockGetUserSessionIdentity).not.toHaveBeenCalled();
  });
});
