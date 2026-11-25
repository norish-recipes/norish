import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { HouseholdData } from "@norish/shared-react/reader";
import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";
import { useActiveAllergies, useHouseholdMutations } from "@norish/shared-react/reader";
import { JOIN_REFUSALS } from "@norish/shared/lib/join-refusals";

import { keyOf, resetTRPCFake, trpcCalls } from "../../trpc/testing";
import {
  createMockHouseholdData,
  createMockHouseholdSettings,
  createMockHouseholdUser,
  READER,
} from "./test-utils";

vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());

const KEY = keyOf("households.get");

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
      const call = trpcCalls[`households.${name}`]?.[index];

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
    resetTRPCFake();
    queryClient = createTestQueryClient();
    adapter = fakePlatformAdapter("phone", READER);
  });

  describe("pending", () => {
    it("is true for an action while its request is in flight", async () => {
      const result = render(household());

      expect(result.current.pending.kick).toBe(false);
      await act(async () => void result.current.kickUser("h1", "a"));
      await waitFor(() => expect(result.current.pending.kick).toBe(true));
      expect(result.current.pending.leave).toBe(false);
      await settle("kick", 0, "resolve", {});
      await waitFor(() => expect(result.current.pending.kick).toBe(false));
    });
  });

  describe("a second call while the first is in flight", () => {
    it("is sent too, and each call resolves whether its request went through", async () => {
      const result = render(household());
      const sent: Promise<boolean>[] = [];

      await act(async () => {
        sent.push(result.current.kickUser("h1", "a"), result.current.kickUser("h1", "b"));
      });
      await settle("kick", 0, "reject");
      await settle("kick", 1, "resolve", {});
      await act(async () => void result.current.kickUser("h1", "a"));
      expect(trpcCalls["households.kick"]).toHaveLength(3);
      await expect(Promise.all(sent)).resolves.toEqual([false, true]);
    });
  });

  describe("joinHousehold", () => {
    it("rejects an empty code", () => {
      const result = render(createMockHouseholdData(null, "current-user"));

      expect(() => result.current.joinHousehold("   ")).toThrow("Join code cannot be empty");
    });

    it("refetches the household when it fails", async () => {
      const result = render(createMockHouseholdData(null, "current-user"));

      await act(async () => void result.current.joinHousehold(" 123456 "));
      expect(trpcCalls["households.join"]?.[0]?.input).toEqual({ code: "123456" });
      await settle("join", 0, "reject");

      await waitFor(() => expect(isInvalidated()).toBe(true));
    });

    it("tells the reader why a join failed", async () => {
      const result = render(createMockHouseholdData(null, "current-user"));

      await act(async () => void result.current.joinHousehold("123456"));
      await settle("join", 0, "reject");

      await waitFor(() =>
        expect(adapter.showError).toHaveBeenCalledExactlyOnceWith(
          expect.objectContaining({ message: "failed" }),
          "household:join"
        )
      );
    });
  });

  describe("a refused join", () => {
    it.each([
      ["gone", "invalidCode"],
      ["expired", "expired"],
      ["already-member", "alreadyMember"],
      ["shared", "shared"],
      ["holds-things", "holdsThings"],
    ] as const)("tells the reader the %s refusal in their language", async (refusal, copy) => {
      const result = render(createMockHouseholdData(null, "current-user"));

      await act(async () => void result.current.joinHousehold("123456"));
      await act(async () =>
        trpcCalls["households.join"]![0]!.deferred.reject(new Error(JOIN_REFUSALS[refusal]))
      );

      await waitFor(() =>
        expect(adapter.toast.show).toHaveBeenCalledExactlyOnceWith({
          severity: "danger",
          title: "common.errors.operationFailed",
          description: `settings.household.join.refused.${copy}`,
        })
      );
      expect(adapter.showError).not.toHaveBeenCalled();
    });
  });

  describe("leaveHousehold", () => {
    it("sends the membership version and waits for the new household to arrive", async () => {
      const result = render(household());

      await act(async () => void result.current.leaveHousehold("h1"));
      expect(trpcCalls["households.leave"]?.[0]?.input).toEqual({ householdId: "h1", version: 4 });
      await settle("leave", 0, "resolve", { success: true });

      expect(cached()).toEqual(household());
    });
  });

  describe("kickUser", () => {
    it("removes each member when two kicks overlap", async () => {
      const result = render(household());

      await act(async () => {
        result.current.kickUser("h1", "a");
        result.current.kickUser("h1", "b");
      });
      expect(trpcCalls["households.kick"]?.map((call) => call.input)).toEqual([
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

      await act(async () => void result.current.regenerateJoinCode("h1"));
      expect(trpcCalls["households.regenerateCode"]?.[0]?.input).toEqual({
        householdId: "h1",
        version: 6,
      });
      await settle("regenerateCode", 0, "reject");

      await waitFor(() => expect(isInvalidated()).toBe(true));
    });
  });

  describe("transferAdmin", () => {
    it("makes the new admin the only admin", async () => {
      const result = render(household());

      await act(async () => void result.current.transferAdmin("h1", "a"));
      expect(trpcCalls["households.transferAdmin"]?.[0]?.input).toEqual({
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

    it("raises no success toast on the answer alone, which precedes the transfer", async () => {
      const result = render(household());

      await act(async () => void result.current.transferAdmin("h1", "a"));
      await settle("transferAdmin", 0, "resolve", { success: true });

      expect(adapter.toast.show).not.toHaveBeenCalled();
    });
  });
});
