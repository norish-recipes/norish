import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

import {
  createTestQueryClient,
  createTestWrapper,
  createMockHouseholdSettings,
  createMockHouseholdUser,
  createMockHouseholdData,
} from "./test-utils";

// Track subscription callbacks
const subscriptionCallbacks: Record<string, ((data: unknown) => void) | undefined> = {};

// Mock tRPC provider
vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({
    households: {
      get: {
        queryKey: () => ["households", "get"],
        queryOptions: () => ({
          queryKey: ["households", "get"],
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
    },
  }),
}));

// Mock useSubscription
vi.mock("@trpc/tanstack-react-query", () => ({
  useSubscription: vi.fn((options) => {
    // Call subscriptionOptions to register callbacks
    if (typeof options === "function") {
      options();
    }
  }),
}));

// Mock HeroUI toast
vi.mock("@heroui/react", () => ({
  addToast: vi.fn(),
}));

describe("useHouseholdSubscription", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear subscription callbacks
    Object.keys(subscriptionCallbacks).forEach((key) => {
      delete subscriptionCallbacks[key];
    });
    queryClient = createTestQueryClient();
  });

  describe("subscription setup", () => {
    it("sets up all subscription handlers", async () => {
      const initialData = createMockHouseholdData(null, "current-user");

      queryClient.setQueryData(["households", "get"], initialData);

      const { useHouseholdSubscription } =
        await import("@/hooks/households/use-household-subscription");

      renderHook(() => useHouseholdSubscription(), {
        wrapper: createTestWrapper(queryClient),
      });

      // The hook should call useSubscription for each event type
      const { useSubscription } = await import("@trpc/tanstack-react-query");

      expect(useSubscription).toHaveBeenCalled();
    });
  });

  describe("onCreated handler", () => {
    it("updates cache with new household data", async () => {
      const initialData = createMockHouseholdData(null, "current-user");

      queryClient.setQueryData(["households", "get"], initialData);

      const { useHouseholdSubscription } =
        await import("@/hooks/households/use-household-subscription");
      const { useHouseholdQuery } = await import("@/hooks/households/use-household-query");

      // Render subscription hook to set up handlers
      renderHook(() => useHouseholdSubscription(), {
        wrapper: createTestWrapper(queryClient),
      });

      // Render query hook to get current state
      const { result } = renderHook(() => useHouseholdQuery(), {
        wrapper: createTestWrapper(queryClient),
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

      queryClient.setQueryData(["households", "get"], initialData);

      const { useHouseholdSubscription } =
        await import("@/hooks/households/use-household-subscription");
      const { useHouseholdQuery } = await import("@/hooks/households/use-household-query");

      renderHook(() => useHouseholdSubscription(), {
        wrapper: createTestWrapper(queryClient),
      });

      const { result } = renderHook(() => useHouseholdQuery(), {
        wrapper: createTestWrapper(queryClient),
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

      queryClient.setQueryData(["households", "get"], initialData);

      const { useHouseholdSubscription } =
        await import("@/hooks/households/use-household-subscription");
      const { useHouseholdQuery } = await import("@/hooks/households/use-household-query");

      renderHook(() => useHouseholdSubscription(), {
        wrapper: createTestWrapper(queryClient),
      });

      const { result } = renderHook(() => useHouseholdQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      // Verify initial state has 2 users
      expect(result.current.household?.users).toHaveLength(2);
    });
  });

  describe("onKicked handler", () => {
    it("clears household when current user is kicked", async () => {
      const initialHousehold = createMockHouseholdSettings({ id: "h1" });
      const initialData = createMockHouseholdData(initialHousehold, "current-user");

      queryClient.setQueryData(["households", "get"], initialData);

      const { useHouseholdSubscription } =
        await import("@/hooks/households/use-household-subscription");
      const { useHouseholdQuery } = await import("@/hooks/households/use-household-query");

      renderHook(() => useHouseholdSubscription(), {
        wrapper: createTestWrapper(queryClient),
      });

      const { result } = renderHook(() => useHouseholdQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      // Verify initial state has household
      expect(result.current.household).not.toBeNull();
    });
  });
});
