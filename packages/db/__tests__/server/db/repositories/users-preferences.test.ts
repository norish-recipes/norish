// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getUserPreferences, updateUserPreferences } from "@norish/db/repositories/users";

// Use hoisted factories so the mocks are available to the hoisted vi.mock call.
const mockFindFirst = vi.hoisted(() => vi.fn());
const mockReturning = vi.hoisted(() => vi.fn());
const mockWhere = vi.hoisted(() => vi.fn(() => ({ returning: mockReturning })));
const mockSet = vi.hoisted(() => vi.fn(() => ({ where: mockWhere })));
const mockUpdate = vi.hoisted(() => vi.fn(() => ({ set: mockSet })));

vi.mock("@norish/db/drizzle", () => ({
  db: {
    query: { users: { findFirst: mockFindFirst } },
    update: mockUpdate,
  },
}));

describe("user preferences repository", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockReturning.mockResolvedValue([{ id: "user-1" }]);
  });

  it("returns empty object when preferences row missing", async () => {
    mockFindFirst.mockResolvedValue(undefined);

    const prefs = await getUserPreferences("user-1");

    expect(prefs).toEqual({});
    expect(mockFindFirst).toHaveBeenCalled();
  });

  it("updates the user row to merge preferences", async () => {
    await expect(updateUserPreferences("user-1", { locale: "en" })).resolves.toEqual({
      applied: true,
      stale: false,
      value: undefined,
    });

    expect(mockUpdate).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalled();
    expect(mockWhere).toHaveBeenCalled();
    expect(mockReturning).toHaveBeenCalled();
  });

  it("rethrows if the update fails", async () => {
    mockReturning.mockRejectedValue(new Error("boom"));

    await expect(updateUserPreferences("user-1", { locale: "fr" })).rejects.toThrow(
      "boom"
    );
  });
});
