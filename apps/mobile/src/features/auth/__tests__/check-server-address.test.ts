import { describe, expect, it, vi } from "vitest";

vi.mock("expo-secure-store", () => ({}));
vi.mock("@/lib/auth/auth-client", () => ({}));

const { checkServerAddress } = await import("@/features/auth/utils/check-server-address");

const norish = (version: string) => ({ status: "ok", version, parser: { status: "ok" } });

function answering(body: unknown, status = 200) {
  return vi.fn<typeof fetch>(() => Promise.resolve(new Response(JSON.stringify(body), { status })));
}

describe("checkServerAddress", () => {
  it("connects to a Norish new enough, at the normalised address", async () => {
    const fetcher = answering(norish("99.0.0"));

    await expect(checkServerAddress(" norish.example.com/ ", fetcher)).resolves.toEqual({
      outcome: "ok",
      address: "https://norish.example.com",
    });
    expect(fetcher.mock.calls[0]?.[0]).toBe("https://norish.example.com/api/v1/health");
  });

  it("sends a Norish too old to Update your server", async () => {
    await expect(
      checkServerAddress("https://old.example", answering(norish("0.1.0")))
    ).resolves.toEqual({ outcome: "too-old", address: "https://old.example", version: "0.1.0" });
  });

  it("asks for a valid URL without asking the network", async () => {
    const fetcher = answering(norish("99.0.0"));

    await expect(checkServerAddress("   ", fetcher)).resolves.toEqual({
      outcome: "error",
      messageId: "auth.connect.errors.invalidUrl",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("says no Norish server answered for anything else", async () => {
    const unreachable = { outcome: "error", messageId: "auth.connect.errors.unreachable" };
    const refused = vi.fn<typeof fetch>(() => Promise.reject(new TypeError("Network failed")));
    const timedOut = vi.fn<typeof fetch>(() =>
      Promise.reject(new DOMException("Aborted", "AbortError"))
    );

    await expect(checkServerAddress("a.example", refused)).resolves.toEqual(unreachable);
    await expect(checkServerAddress("a.example", timedOut)).resolves.toEqual(unreachable);
    await expect(checkServerAddress("a.example", answering({}, 404))).resolves.toEqual(unreachable);
    await expect(checkServerAddress("a.example", answering("<html>"))).resolves.toEqual(
      unreachable
    );
  });
});
