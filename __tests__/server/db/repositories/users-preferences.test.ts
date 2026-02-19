// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

// Use hoisted factories so the mocks are available to the hoisted vi.mock call.
const mockFindFirst = vi.hoisted(() => vi.fn());
const mockExecute = vi.hoisted(() => vi.fn());

vi.mock("@/server/db/drizzle", () => ({
  db: {
    query: { users: { findFirst: mockFindFirst } },
    execute: mockExecute,
  },
}));

import { getUserPreferences, updateUserPreferences } from "@/server/db/repositories/users";

describe("user preferences repository", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns empty object when preferences row missing", async () => {
    mockFindFirst.mockResolvedValue(undefined);

    const prefs = await getUserPreferences("user-1");

    expect(prefs).toEqual({});
    expect(mockFindFirst).toHaveBeenCalled();
  });

  it("calls db.execute to merge preferences", async () => {
    mockExecute.mockResolvedValue(undefined);

    await expect(
      updateUserPreferences("user-1", { timersEnabled: false })
    ).resolves.toBeUndefined();

    expect(mockExecute).toHaveBeenCalled();
  });

  it("rethrows if db.execute fails", async () => {
    mockExecute.mockRejectedValue(new Error("boom"));

    await expect(updateUserPreferences("user-1", { showConversionButton: true })).rejects.toThrow(
      "boom"
    );
  });
});
