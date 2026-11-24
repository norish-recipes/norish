// @vitest-environment node

import { initTRPC } from "@trpc/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server-package", () => {
  const t = initTRPC.create();
  const appRouter = t.router({ ping: t.procedure.query(() => "pong") });

  return { serverPackage: async () => ({ appRouter, createContext: () => ({}) }) };
});

describe("tRPC route", () => {
  it("lets no cache keep an answer, which can carry a share link", async () => {
    const { GET } = await import("@/app/api/trpc/[trpc]/route");

    const response = await GET(new Request("http://localhost/api/trpc/ping"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
