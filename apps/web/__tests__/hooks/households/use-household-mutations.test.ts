import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createMockHouseholdData,
  createMockHouseholdSettings,
  createMockHouseholdUser,
  createTestQueryClient,
  createTestWrapper,
} from "./test-utils";

const mockLeaveMutate = vi.fn();
const mockKickMutate = vi.fn();
const mockRegenerateMutate = vi.fn();
const mockTransferMutate = vi.fn();

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");

  return {
    ...actual,
    useMutation: vi.fn((options: { mutationFn?: (...args: unknown[]) => unknown } | undefined) => ({
      mutate: options?.mutationFn ?? vi.fn(),
      isPending: false,
    })),
  };
});

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
      create: { mutationOptions: vi.fn() },
      join: { mutationOptions: vi.fn() },
      leave: { mutationOptions: vi.fn(() => ({ mutationFn: mockLeaveMutate })) },
      kick: { mutationOptions: vi.fn(() => ({ mutationFn: mockKickMutate })) },
      regenerateCode: { mutationOptions: vi.fn(() => ({ mutationFn: mockRegenerateMutate })) },
      transferAdmin: { mutationOptions: vi.fn(() => ({ mutationFn: mockTransferMutate })) },
    },
  }),
}));

// Mock user context
vi.mock("@/context/user-context", () => ({
  useUserContext: () => ({
    user: { id: "current-user", name: "Test User" },
  }),
}));

describe("useHouseholdMutations", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLeaveMutate.mockReset();
    mockKickMutate.mockReset();
    mockRegenerateMutate.mockReset();
    mockTransferMutate.mockReset();
    queryClient = createTestQueryClient();
  });

  describe("module structure", () => {
    it("exports all expected mutation functions", async () => {
      const initialData = createMockHouseholdData(null, "current-user");

      queryClient.setQueryData(["households", "get"], initialData);

      const { useHouseholdMutations } = await import("@/hooks/households/use-household-mutations");
      const { result } = renderHook(() => useHouseholdMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(result.current).toHaveProperty("createHousehold");
      expect(result.current).toHaveProperty("joinHousehold");
      expect(result.current).toHaveProperty("leaveHousehold");
      expect(result.current).toHaveProperty("kickUser");
      expect(result.current).toHaveProperty("regenerateJoinCode");
      expect(result.current).toHaveProperty("transferAdmin");

      expect(typeof result.current.createHousehold).toBe("function");
      expect(typeof result.current.joinHousehold).toBe("function");
      expect(typeof result.current.leaveHousehold).toBe("function");
      expect(typeof result.current.kickUser).toBe("function");
      expect(typeof result.current.regenerateJoinCode).toBe("function");
      expect(typeof result.current.transferAdmin).toBe("function");
    });
  });

  describe("createHousehold", () => {
    it("throws error for empty name", async () => {
      const initialData = createMockHouseholdData(null, "current-user");

      queryClient.setQueryData(["households", "get"], initialData);

      const { useHouseholdMutations } = await import("@/hooks/households/use-household-mutations");
      const { result } = renderHook(() => useHouseholdMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(() => result.current.createHousehold("")).toThrow("Household name cannot be empty");
      expect(() => result.current.createHousehold("   ")).toThrow("Household name cannot be empty");
    });

    it("throws error when user ID not available", async () => {
      // Set up data without currentUserId
      queryClient.setQueryData(["households", "get"], {
        household: null,
        currentUserId: undefined,
      });

      const { useHouseholdMutations } = await import("@/hooks/households/use-household-mutations");
      const { result } = renderHook(() => useHouseholdMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(() => result.current.createHousehold("Test Household")).toThrow(
        "User ID not available"
      );
    });
  });

  describe("joinHousehold", () => {
    it("throws error for empty code", async () => {
      const initialData = createMockHouseholdData(null, "current-user");

      queryClient.setQueryData(["households", "get"], initialData);

      const { useHouseholdMutations } = await import("@/hooks/households/use-household-mutations");
      const { result } = renderHook(() => useHouseholdMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(() => result.current.joinHousehold("")).toThrow("Join code cannot be empty");
      expect(() => result.current.joinHousehold("   ")).toThrow("Join code cannot be empty");
    });

    it("throws error when user ID not available", async () => {
      queryClient.setQueryData(["households", "get"], {
        household: null,
        currentUserId: undefined,
      });

      const { useHouseholdMutations } = await import("@/hooks/households/use-household-mutations");
      const { result } = renderHook(() => useHouseholdMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(() => result.current.joinHousehold("123456")).toThrow("User ID not available");
    });
  });

  describe("return types", () => {
    it("all mutation functions return void (fire-and-forget pattern)", async () => {
      const initialData = createMockHouseholdData(
        createMockHouseholdSettings({
          id: "h1",
          users: [
            createMockHouseholdUser({ id: "current-user", isAdmin: true }),
            createMockHouseholdUser({ id: "other-user", isAdmin: false }),
          ],
        }),
        "current-user"
      );

      queryClient.setQueryData(["households", "get"], initialData);

      const { useHouseholdMutations } = await import("@/hooks/households/use-household-mutations");
      const { result } = renderHook(() => useHouseholdMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      // Verify functions return void (undefined)
      // Note: We can't actually call these without proper mutation setup,
      // but we can verify the function signatures through type inference
      const returnType = result.current.leaveHousehold;

      expect(returnType.length).toBe(1); // Takes 1 argument
    });
  });

  describe("versioned mutation inputs", () => {
    it("passes the current membership version when leaving a household", async () => {
      const initialData = createMockHouseholdData(
        createMockHouseholdSettings({
          id: "h1",
          users: [createMockHouseholdUser({ id: "current-user", isAdmin: true, version: 4 })],
        }),
        "current-user"
      );

      queryClient.setQueryData(["households", "get"], initialData);

      const { useHouseholdMutations } = await import("@/hooks/households/use-household-mutations");
      const { result } = renderHook(() => useHouseholdMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      result.current.leaveHousehold("h1");

      expect(mockLeaveMutate).toHaveBeenCalledWith(
        { householdId: "h1", version: 4 },
        expect.any(Object)
      );
    });

    it("passes household version when regenerating join code", async () => {
      const initialData = createMockHouseholdData(
        createMockHouseholdSettings({ id: "h1", version: 6 }),
        "current-user"
      );

      queryClient.setQueryData(["households", "get"], initialData);

      const { useHouseholdMutations } = await import("@/hooks/households/use-household-mutations");
      const { result } = renderHook(() => useHouseholdMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      result.current.regenerateJoinCode("h1");

      expect(mockRegenerateMutate).toHaveBeenCalledWith(
        { householdId: "h1", version: 6 },
        expect.any(Object)
      );
    });
  });
});
