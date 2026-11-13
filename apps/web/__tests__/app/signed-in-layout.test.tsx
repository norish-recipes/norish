// @vitest-environment node
/**
 * The signed-in app's layout is the page gate: the proxy only saw a cookie.
 * A session whose account no longer exists is revoked here, and the reader
 * goes to sign in and back to the page they asked for.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const requestHeaders = vi.hoisted(() => ({ current: new Headers() }));
const deleteSession = vi.hoisted(() => vi.fn());
const getSession = vi.hoisted(() => vi.fn());
const users = vi.hoisted(() => ({
  getUserSessionIdentity: vi.fn(),
  getUserPreferences: vi.fn(async () => ({})),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => requestHeaders.current,
  // No time-zone cookie: the reader's day falls back to the server's.
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));
vi.mock("@norish/auth/auth", () => ({
  auth: {
    api: { getSession },
    $context: Promise.resolve({ internalAdapter: { deleteSession } }),
  },
}));
vi.mock("@norish/db/repositories/users", () => users);
vi.mock("@/app/(app)/app-shell", () => ({ AppShell: () => null }));

const { default: AppLayout } = await import("@/app/(app)/layout");

beforeEach(() => {
  requestHeaders.current = new Headers({
    cookie: "better-auth.session_token=token-1",
    "x-norish-destination": "/recipes/abc?tab=steps",
  });
});

describe("the signed-in layout", () => {
  it("revokes a session whose account no longer exists and sends the reader to sign in and back", async () => {
    getSession.mockResolvedValue({ user: { id: "gone" }, session: { token: "token-1" } });
    users.getUserSessionIdentity.mockResolvedValue(null);

    await expect(AppLayout({ children: null })).rejects.toThrow(
      "redirect:/login?callbackUrl=%2Frecipes%2Fabc%3Ftab%3Dsteps"
    );
    expect(deleteSession).toHaveBeenCalledWith("token-1");
  });

  it("sends a request without a session to sign in", async () => {
    getSession.mockResolvedValue(null);

    await expect(AppLayout({ children: null })).rejects.toThrow("redirect:/login?callbackUrl=");
    expect(users.getUserSessionIdentity).not.toHaveBeenCalled();
  });

  it("renders the app for a session whose account exists", async () => {
    getSession.mockResolvedValue({ user: { id: "user-1" }, session: { token: "token-1" } });
    users.getUserSessionIdentity.mockResolvedValue({ id: "user-1", isServerAdmin: false });

    await expect(AppLayout({ children: null })).resolves.toBeTruthy();
    expect(deleteSession).not.toHaveBeenCalled();
  });
});
