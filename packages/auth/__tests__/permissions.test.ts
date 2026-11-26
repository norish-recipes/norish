import { beforeEach, describe, expect, it, vi } from "vitest";

import { canAccessResource } from "@norish/auth/permissions";

const stored = vi.hoisted(() => ({ policy: null as Record<string, string> | null }));

vi.mock("@norish/db/repositories/server-config", () => ({
  getConfig: vi.fn(async () => stored.policy),
}));

describe("canAccessResource", () => {
  beforeEach(() => {
    stored.policy = { view: "everyone", edit: "household", delete: "household" };
  });

  it.each(["view", "edit", "delete"] as const)(
    "lets the row's own household %s it under any policy",
    async (action) => {
      stored.policy = { view: "household", edit: "household", delete: "household" };
      expect(await canAccessResource(action, "household1", "household1")).toBe(true);
    }
  );

  it("lets another household do what the policy opens to everyone, and nothing else", async () => {
    expect(await canAccessResource("view", "household3", "household1")).toBe(true);
    expect(await canAccessResource("edit", "household3", "household1")).toBe(false);
    expect(await canAccessResource("delete", "household3", "household1")).toBe(false);
  });

  it("hides another household's row under view Household", async () => {
    stored.policy = { view: "household", edit: "household", delete: "household" };
    expect(await canAccessResource("view", "household3", "household1")).toBe(false);
  });

  it("falls back to the default policy when none is stored", async () => {
    stored.policy = null;
    expect(await canAccessResource("view", "household3", "household1")).toBe(true);
    expect(await canAccessResource("edit", "household3", "household1")).toBe(false);
  });
});
