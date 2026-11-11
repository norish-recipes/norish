import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { HouseholdData } from "@norish/shared-react/reader";
import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";
import { useHouseholdMutations } from "@norish/shared-react/reader";

import {
  createMockHouseholdData,
  createMockHouseholdSettings,
  createMockHouseholdUser,
  READER,
} from "./test-utils";

type Deferred = { resolve: (value: unknown) => void; reject: (error: unknown) => void };

// Each call to a stubbed procedure waits until the test settles it.
const calls: Record<string, { input: unknown; deferred: Deferred }[]> = {};

function stubProcedure(name: string) {
  return {
    mutationOptions: (options: object = {}) => ({
      ...options,
      mutationFn: (input: unknown) =>
        new Promise((resolve, reject) => {
          (calls[name] ??= []).push({ input, deferred: { resolve, reject } });
        }),
    }),
  };
}

vi.mock("../../trpc", () => ({
  useTRPC: () => ({
    households: {
      get: {
        queryKey: () => ["households", "get"],
        queryOptions: () => ({
          queryKey: ["households", "get"],
          queryFn: () => new Promise(() => {}),
        }),
      },
      create: stubProcedure("create"),
      join: stubProcedure("join"),
      leave: stubProcedure("leave"),
      kick: stubProcedure("kick"),
      regenerateCode: stubProcedure("regenerateCode"),
      transferAdmin: stubProcedure("transferAdmin"),
    },
    // The Reader's profile never answers: the session's name stands.
    user: {
      get: {
        queryOptions: () => ({ queryKey: ["user", "get"], queryFn: () => new Promise(() => {}) }),
      },
    },
  }),
}));

const KEY = ["households", "get"];

describe("useHouseholdMutations", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;
  let adapter: ReturnType<typeof fakePlatformAdapter>;

  const render = (data: HouseholdData) => {
    queryClient.setQueryData(KEY, data);

    return renderHook(() => useHouseholdMutations(), {
      wrapper: createTestWrapper(queryClient, adapter),
    }).result;
  };
  const cached = () => queryClient.getQueryData<HouseholdData>(KEY);
  const isInvalidated = () => queryClient.getQueryState(KEY)?.isInvalidated;
  const settle = async (
    name: string,
    index: number,
    outcome: "resolve" | "reject",
    value?: unknown
  ) => {
    await act(async () => {
      const call = calls[name]?.[index];

      if (!call) throw new Error(`no call ${index} to ${name}`);
      if (outcome === "resolve") call.deferred.resolve(value);
      else call.deferred.reject(new Error("failed"));
    });
  };

  const household = () =>
    createMockHouseholdData(
      createMockHouseholdSettings({
        id: "h1",
        version: 6,
        users: [
          createMockHouseholdUser({ id: "current-user", isAdmin: true, version: 4 }),
          createMockHouseholdUser({ id: "a", version: 2 }),
          createMockHouseholdUser({ id: "b", version: 3 }),
        ],
      }),
      "current-user"
    );

  beforeEach(() => {
    for (const name of Object.keys(calls)) delete calls[name];
    queryClient = createTestQueryClient();
    adapter = fakePlatformAdapter("phone", READER);
  });

  describe("createHousehold", () => {
    it("rejects an empty name or a missing Reader", () => {
      const result = render(createMockHouseholdData(null, "current-user"));

      expect(() => result.current.createHousehold("   ")).toThrow("Household name cannot be empty");

      const noReader = render({ household: null, currentUserId: "" });

      expect(() => noReader.current.createHousehold("Home")).toThrow("User ID not available");
    });

    it("caches the new household with the Reader as admin", async () => {
      const result = render(createMockHouseholdData(null, "current-user"));

      await act(async () => result.current.createHousehold("  Home  "));
      expect(calls.create?.[0]?.input).toEqual({ name: "Home" });
      await settle("create", 0, "resolve", { id: "h9" });

      expect(cached()?.household).toMatchObject({
        id: "h9",
        name: "Home",
        users: [{ id: "current-user", name: "Test User", isAdmin: true }],
      });
    });

    it("refetches the household when it fails", async () => {
      const result = render(createMockHouseholdData(null, "current-user"));

      await act(async () => result.current.createHousehold("Home"));
      await settle("create", 0, "reject");

      await waitFor(() => expect(isInvalidated()).toBe(true));
    });
  });

  describe("joinHousehold", () => {
    it("rejects an empty code", () => {
      const result = render(createMockHouseholdData(null, "current-user"));

      expect(() => result.current.joinHousehold("   ")).toThrow("Join code cannot be empty");
    });

    it("refetches the household when it fails", async () => {
      const result = render(createMockHouseholdData(null, "current-user"));

      await act(async () => result.current.joinHousehold(" 123456 "));
      expect(calls.join?.[0]?.input).toEqual({ code: "123456" });
      await settle("join", 0, "reject");

      await waitFor(() => expect(isInvalidated()).toBe(true));
    });
  });

  describe("leaveHousehold", () => {
    it("sends the membership version and clears the household", async () => {
      const result = render(household());

      await act(async () => result.current.leaveHousehold("h1"));
      expect(calls.leave?.[0]?.input).toEqual({ householdId: "h1", version: 4 });
      await settle("leave", 0, "resolve", { success: true });

      expect(cached()).toEqual({ household: null, currentUserId: "current-user" });
    });
  });

  describe("kickUser", () => {
    it("removes each member when two kicks overlap", async () => {
      const result = render(household());

      await act(async () => {
        result.current.kickUser("h1", "a");
        result.current.kickUser("h1", "b");
      });
      expect(calls.kick?.map((call) => call.input)).toEqual([
        { householdId: "h1", userId: "a", version: 2 },
        { householdId: "h1", userId: "b", version: 3 },
      ]);
      await settle("kick", 0, "resolve", { success: true });
      await settle("kick", 1, "resolve", { success: true });

      expect(cached()?.household?.users.map((user) => user.id)).toEqual(["current-user"]);
    });

    it("refetches the household when the first of two overlapped kicks fails", async () => {
      const result = render(household());

      await act(async () => {
        result.current.kickUser("h1", "a");
        result.current.kickUser("h1", "b");
      });
      await settle("kick", 0, "reject");

      await waitFor(() => expect(isInvalidated()).toBe(true));
    });
  });

  describe("regenerateJoinCode", () => {
    it("sends the household version and refetches when it fails", async () => {
      const result = render(household());

      await act(async () => result.current.regenerateJoinCode("h1"));
      expect(calls.regenerateCode?.[0]?.input).toEqual({ householdId: "h1", version: 6 });
      await settle("regenerateCode", 0, "reject");

      await waitFor(() => expect(isInvalidated()).toBe(true));
    });
  });

  describe("transferAdmin", () => {
    it("makes the new admin the only admin", async () => {
      const result = render(household());

      await act(async () => result.current.transferAdmin("h1", "a"));
      expect(calls.transferAdmin?.[0]?.input).toEqual({
        householdId: "h1",
        newAdminId: "a",
        version: 6,
      });
      await settle("transferAdmin", 0, "resolve", { success: true });

      expect(cached()?.household?.users.map((user) => [user.id, user.isAdmin])).toEqual([
        ["current-user", false],
        ["a", true],
        ["b", false],
      ]);
    });

    it("announces the new admin only once the transfer succeeds", async () => {
      const result = render(household());
      const successes = () =>
        vi.mocked(adapter.toast.show).mock.calls.filter(([toast]) => toast.severity === "success");

      await act(async () => result.current.transferAdmin("h1", "a"));
      await settle("transferAdmin", 0, "reject");
      expect(successes()).toHaveLength(0);

      await act(async () => result.current.transferAdmin("h1", "a"));
      await settle("transferAdmin", 1, "resolve", { success: true });
      expect(successes()).toEqual([
        [
          {
            severity: "success",
            title: "settings.household.members.toasts.transferSuccess",
          },
        ],
      ]);
    });
  });
});
