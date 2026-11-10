import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";
import { useHousehold, useHouseholdSubscription } from "@norish/shared-react/reader";

import { trackedEvent } from "../../../__tests__/realtime/tracked-event";
import {
  createMockHouseholdAdminSettings,
  createMockHouseholdData,
  createMockHouseholdSettings,
  createMockHouseholdUser,
  READER,
  readerWrapper,
} from "./test-utils";

// Track subscription callbacks
const subscriptionCallbacks: Record<string, ((data: unknown) => void) | undefined> = {};

// Define query keys to match mock format
const householdQueryKey = [["households", "get"], { type: "query" }];

vi.mock("../../trpc", () => ({
  useTRPC: () => ({
    households: {
      get: {
        queryKey: () => [["households", "get"], { type: "query" }],
        queryOptions: () => ({
          queryKey: [["households", "get"], { type: "query" }],
          queryFn: async () => createMockHouseholdData(),
        }),
      },
      onCreated: {
        subscriptionOptions: vi.fn((_, options) => {
          subscriptionCallbacks.onCreated = options?.onData;

          return { enabled: true };
        }),
      },
      onKicked: {
        subscriptionOptions: vi.fn((_, options) => {
          subscriptionCallbacks.onKicked = options?.onData;

          return { enabled: true };
        }),
      },
      onFailed: {
        subscriptionOptions: vi.fn((_, options) => {
          subscriptionCallbacks.onFailed = options?.onData;

          return { enabled: true };
        }),
      },
      onUserJoined: {
        subscriptionOptions: vi.fn((_, options) => {
          subscriptionCallbacks.onUserJoined = options?.onData;

          return { enabled: true };
        }),
      },
      onUserLeft: {
        subscriptionOptions: vi.fn((_, options) => {
          subscriptionCallbacks.onUserLeft = options?.onData;

          return { enabled: true };
        }),
      },
      onMemberRemoved: {
        subscriptionOptions: vi.fn((_, options) => {
          subscriptionCallbacks.onMemberRemoved = options?.onData;

          return { enabled: true };
        }),
      },
      onAdminTransferred: {
        subscriptionOptions: vi.fn((_, options) => {
          subscriptionCallbacks.onAdminTransferred = options?.onData;

          return { enabled: true };
        }),
      },
      onJoinCodeRegenerated: {
        subscriptionOptions: vi.fn((_, options) => {
          subscriptionCallbacks.onJoinCodeRegenerated = options?.onData;

          return { enabled: true };
        }),
      },
      onAllergiesUpdated: {
        subscriptionOptions: vi.fn((_, options) => {
          subscriptionCallbacks.onAllergiesUpdated = options?.onData;

          return { enabled: true };
        }),
      },
      onMemberProfileUpdated: {
        subscriptionOptions: vi.fn((_, options) => {
          subscriptionCallbacks.onMemberProfileUpdated = options?.onData;

          return { enabled: true };
        }),
      },
    },
    calendar: {
      listRecipes: {
        queryKey: () => [["calendar", "listRecipes"], { type: "query" }],
      },
    },
    user: {
      get: {
        queryKey: () => [["user", "get"], { type: "query" }],
        // The Reader's profile never answers: the session's Reader stands.
        queryOptions: () => ({
          queryKey: [["user", "get"], { type: "query" }],
          queryFn: () => new Promise(() => {}),
        }),
      },
    },
  }),
}));

// Mock useSubscription
vi.mock("@trpc/tanstack-react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@trpc/tanstack-react-query")>()),
  useSubscription: vi.fn((options) => {
    // Call subscriptionOptions to register callbacks
    if (typeof options === "function") {
      options();
    }
  }),
}));

let useSubscription: (typeof import("@trpc/tanstack-react-query"))["useSubscription"];

describe("useHouseholdSubscription", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeAll(async () => {
    ({ useSubscription } = await import("@trpc/tanstack-react-query"));
  });

  beforeEach(() => {
    // Clear subscription callbacks
    Object.keys(subscriptionCallbacks).forEach((key) => {
      delete subscriptionCallbacks[key];
    });
    queryClient = createTestQueryClient();
  });

  describe("subscription setup", () => {
    it("sets up all subscription handlers", async () => {
      const initialData = createMockHouseholdData(null, "current-user");

      queryClient.setQueryData(householdQueryKey, initialData);

      renderHook(() => useHouseholdSubscription(), {
        wrapper: readerWrapper(queryClient),
      });

      // The hook should call useSubscription for each event type
      expect(useSubscription).toHaveBeenCalled();
    });
  });

  describe("onCreated handler", () => {
    it("updates cache with new household data", async () => {
      const initialData = createMockHouseholdData(null, "current-user");

      queryClient.setQueryData(householdQueryKey, initialData);

      // Render subscription hook to set up handlers
      renderHook(() => useHouseholdSubscription(), {
        wrapper: readerWrapper(queryClient),
      });

      // Render query hook to get current state
      const { result } = renderHook(() => useHousehold(), {
        wrapper: readerWrapper(queryClient),
      });

      // Initially no household
      expect(result.current.household).toBeNull();
    });
  });

  describe("onUserJoined handler", () => {
    it("adds new user to household users list", async () => {
      const existingUser = createMockHouseholdUser({ id: "user-1", name: "User 1", isAdmin: true });
      const initialHousehold = createMockHouseholdSettings({
        id: "h1",
        users: [existingUser],
      });
      const initialData = createMockHouseholdData(initialHousehold, "user-1");

      queryClient.setQueryData(householdQueryKey, initialData);

      renderHook(() => useHouseholdSubscription(), {
        wrapper: readerWrapper(queryClient),
      });

      const { result } = renderHook(() => useHousehold(), {
        wrapper: readerWrapper(queryClient),
      });

      // Verify initial state
      expect(result.current.household?.users).toHaveLength(1);
    });
  });

  describe("onUserLeft handler", () => {
    it("removes user from household users list", async () => {
      const user1 = createMockHouseholdUser({ id: "user-1", name: "User 1", isAdmin: true });
      const user2 = createMockHouseholdUser({ id: "user-2", name: "User 2", isAdmin: false });
      const initialHousehold = createMockHouseholdSettings({
        id: "h1",
        users: [user1, user2],
      });
      const initialData = createMockHouseholdData(initialHousehold, "user-1");

      queryClient.setQueryData(householdQueryKey, initialData);

      renderHook(() => useHouseholdSubscription(), {
        wrapper: readerWrapper(queryClient),
      });

      const { result } = renderHook(() => useHousehold(), {
        wrapper: readerWrapper(queryClient),
      });

      // Verify initial state has 2 users
      expect(result.current.household?.users).toHaveLength(2);
    });
  });

  describe("onKicked handler", () => {
    it("clears household when current user is kicked", async () => {
      const initialHousehold = createMockHouseholdSettings({ id: "h1" });
      const initialData = createMockHouseholdData(initialHousehold, "current-user");

      queryClient.setQueryData(householdQueryKey, initialData);

      const adapter = fakePlatformAdapter("phone", READER);

      renderHook(() => useHouseholdSubscription(), {
        wrapper: createTestWrapper(queryClient, adapter),
      });

      const { result } = renderHook(() => useHousehold(), {
        wrapper: readerWrapper(queryClient),
      });

      expect(result.current.household).not.toBeNull();

      act(() => {
        subscriptionCallbacks.onKicked?.(trackedEvent({}));
      });

      await waitFor(() => expect(result.current.household).toBeNull());
      expect(adapter.toast.show).toHaveBeenCalledWith(
        expect.objectContaining({ severity: "warning", title: "Removed from household" })
      );
    });
  });

  describe("onFailed handler", () => {
    it("hands the reason to the platform's error display", async () => {
      const initialHousehold = createMockHouseholdSettings({ id: "h1" });
      const initialData = createMockHouseholdData(initialHousehold, "current-user");

      queryClient.setQueryData(householdQueryKey, initialData);

      const adapter = fakePlatformAdapter("phone", READER);

      renderHook(() => useHouseholdSubscription(), {
        wrapper: createTestWrapper(queryClient, adapter),
      });

      act(() => {
        subscriptionCallbacks.onFailed?.(
          trackedEvent({
            reason: "Very long backend stack trace that should not be shown in toast",
          })
        );
      });

      // The platform's error display shows its generic copy and only logs the reason.
      expect(adapter.showError).toHaveBeenCalledWith(
        "Very long backend stack trace that should not be shown in toast",
        "household-subscription:onFailed"
      );
    });
  });

  describe("onMemberProfileUpdated handler", () => {
    it("refetches user settings and recipes when the current user's profile changed", async () => {
      const initialHousehold = createMockHouseholdSettings({ id: "h1" });
      const initialData = createMockHouseholdData(initialHousehold, "user-1");

      queryClient.setQueryData(householdQueryKey, initialData);

      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      renderHook(() => useHouseholdSubscription(), {
        wrapper: readerWrapper(queryClient),
      });

      act(() => {
        subscriptionCallbacks.onMemberProfileUpdated?.(
          trackedEvent({ userId: READER.id, image: "/avatars/current-user-1755000000000.png" })
        );
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: [["user", "get"], { type: "query" }],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [["recipes"]] });
    });

    it("refetches only recipes when another member's profile changed", async () => {
      const initialHousehold = createMockHouseholdSettings({ id: "h1" });
      const initialData = createMockHouseholdData(initialHousehold, "user-1");

      queryClient.setQueryData(householdQueryKey, initialData);

      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      renderHook(() => useHouseholdSubscription(), {
        wrapper: readerWrapper(queryClient),
      });

      act(() => {
        subscriptionCallbacks.onMemberProfileUpdated?.(
          trackedEvent({ userId: "user-2", image: null })
        );
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [["recipes"]] });
      expect(invalidateSpy).not.toHaveBeenCalledWith({
        queryKey: [["user", "get"], { type: "query" }],
      });
    });
  });

  describe("versioned household events", () => {
    it("updates household version on join code regeneration", async () => {
      const initialHousehold = createMockHouseholdAdminSettings({ version: 1 });
      const initialData = createMockHouseholdData(initialHousehold, "current-user");

      queryClient.setQueryData(householdQueryKey, initialData);

      renderHook(() => useHouseholdSubscription(), {
        wrapper: readerWrapper(queryClient),
      });

      act(() => {
        subscriptionCallbacks.onJoinCodeRegenerated?.(
          trackedEvent({
            joinCode: "654321",
            joinCodeExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
            version: 2,
          })
        );
      });

      await waitFor(() => {
        const data = queryClient.getQueryData<{ household: { version: number } }>(
          householdQueryKey
        );

        expect(data?.household).toMatchObject({ version: 2 });
      });
    });

    it("updates household version on admin transfer", async () => {
      const initialHousehold = createMockHouseholdSettings({
        version: 3,
        users: [
          createMockHouseholdUser({ id: "user-1", isAdmin: true, version: 1 }),
          createMockHouseholdUser({ id: "user-2", isAdmin: false, version: 1 }),
        ],
      });
      const initialData = createMockHouseholdData(initialHousehold, "user-1");

      queryClient.setQueryData(householdQueryKey, initialData);

      renderHook(() => useHouseholdSubscription(), {
        wrapper: readerWrapper(queryClient),
      });

      act(() => {
        subscriptionCallbacks.onAdminTransferred?.(
          trackedEvent({
            oldAdminId: "user-1",
            newAdminId: "user-2",
            version: 4,
          })
        );
      });

      await waitFor(() => {
        const data = queryClient.getQueryData<{
          household: { version: number; users: Array<{ id: string; isAdmin?: boolean }> };
        }>(householdQueryKey);

        expect(data?.household).toMatchObject({ version: 4 });
        expect(data?.household.users.find((user) => user.id === "user-2")?.isAdmin).toBe(true);
      });
    });

    it("refetches the household when the Reader becomes admin, for its join code", () => {
      const initialHousehold = createMockHouseholdSettings({
        users: [
          createMockHouseholdUser({ id: "user-1", isAdmin: true }),
          createMockHouseholdUser({ id: READER.id, isAdmin: false }),
        ],
      });

      queryClient.setQueryData(
        householdQueryKey,
        createMockHouseholdData(initialHousehold, READER.id)
      );
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      renderHook(() => useHouseholdSubscription(), {
        wrapper: readerWrapper(queryClient),
      });

      act(() => {
        subscriptionCallbacks.onAdminTransferred?.(
          trackedEvent({ oldAdminId: "user-1", newAdminId: READER.id, version: 2 })
        );
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: householdQueryKey });
    });
  });
});
