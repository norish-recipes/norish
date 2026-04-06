// @vitest-environment node

import { GET as getDocs } from "@/app/api/docs/route";
import { GET as getOpenApiJson } from "@/app/api/openapi.json/route";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.hoisted(() => vi.fn());
const headersMock = vi.hoisted(() => vi.fn());
const getOpenApiDocumentMock = vi.hoisted(() => vi.fn());
const apiReferenceHandlerMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  headers: headersMock,
}));

vi.mock("@norish/auth/auth", () => ({
  auth: {
    api: {
      getSession: getSessionMock,
    },
  },
}));

vi.mock("@norish/trpc/server", () => ({
  getOpenApiDocument: getOpenApiDocumentMock,
}));

vi.mock("@scalar/nextjs-api-reference", () => ({
  ApiReference: vi.fn(() => apiReferenceHandlerMock),
}));

describe("API docs routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    headersMock.mockResolvedValue(new Headers());
    apiReferenceHandlerMock.mockResolvedValue(
      new Response("<html>Norish Recipe API</html>", {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      })
    );
  });

  it("redirects anonymous docs requests to login", async () => {
    getSessionMock.mockResolvedValue(null);

    const response = await getDocs(new Request("http://localhost/api/docs"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
    expect(response.headers.get("location")).toContain("callbackUrl=%2Fapi%2Fdocs");
  });

  it("rejects anonymous spec requests", async () => {
    getSessionMock.mockResolvedValue(null);

    const response = await getOpenApiJson(new Request("http://localhost/api/openapi.json"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("serves docs for authenticated users", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "user-1" } });

    const response = await getDocs(new Request("http://localhost/api/docs"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/html");
    expect(apiReferenceHandlerMock).toHaveBeenCalledOnce();
    await expect(response.text()).resolves.toContain("Norish Recipe API");
  });

  it("serves the OpenAPI spec for authenticated users", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    getOpenApiDocumentMock.mockReturnValue({ openapi: "3.1.0" });

    const response = await getOpenApiJson(new Request("http://localhost/api/openapi.json"));

    expect(response.status).toBe(200);
    expect(getOpenApiDocumentMock).toHaveBeenCalledWith("http://localhost");
    await expect(response.json()).resolves.toEqual({ openapi: "3.1.0" });
  });
});
