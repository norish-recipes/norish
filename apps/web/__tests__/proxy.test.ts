// @vitest-environment node

import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.hoisted(() => vi.fn());

vi.mock("@norish/auth/auth", () => ({
  auth: {
    api: {
      getSession: getSessionMock,
    },
  },
}));

describe("proxy share access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows share pages without an authenticated session", async () => {
    const response = await proxy(new NextRequest("http://localhost/share/public-token"));

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(getSessionMock).not.toHaveBeenCalled();
  });

  it("allows shared media routes without an authenticated session", async () => {
    const response = await proxy(
      new NextRequest("http://localhost/share/public-token/media/cover.jpg")
    );

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(getSessionMock).not.toHaveBeenCalled();
  });

  it("redirects anonymous private recipe media requests", async () => {
    getSessionMock.mockResolvedValue(null);

    const response = await proxy(
      new NextRequest("http://localhost/recipes/123e4567-e89b-12d3-a456-426614174000/cover.jpg")
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  });
});
