import { serverImage } from "@/lib/network/server-url";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/auth-headers", () => ({ authHeaders: () => ({ Cookie: "session=1" }) }));
vi.mock("@/lib/network/server-address", async () => ({
  ServerAddressContext: (await import("react")).createContext(null),
}));

const SERVER = "https://norish.example.com";

describe("serverImage", () => {
  it("sends the session cookie for a path on the Server Address", () => {
    expect(serverImage(SERVER, "/recipes/1/image.jpg")).toEqual({
      uri: `${SERVER}/recipes/1/image.jpg`,
      headers: { Cookie: "session=1" },
    });
  });

  it("sends the session cookie for an absolute URL on the Server Address", () => {
    expect(serverImage(SERVER, `${SERVER}/avatars/1.png`).headers).toEqual({ Cookie: "session=1" });
  });

  it("sends no cookie to another host", () => {
    const image = serverImage(SERVER, "https://idp.example.org/picture.png");

    expect(image).toEqual({ uri: "https://idp.example.org/picture.png" });
  });

  it("sends no cookie for a host that only starts like the Server Address", () => {
    expect(serverImage(SERVER, `${SERVER}.evil.test/a.png`).headers).toBeUndefined();
  });

  it("sends no cookie without a Server Address", () => {
    expect(serverImage(null, "/recipes/1/image.jpg")).toEqual({ uri: "/recipes/1/image.jpg" });
  });
});
