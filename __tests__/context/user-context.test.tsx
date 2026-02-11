import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { ReactNode } from "react";

const mockUseUser = vi.hoisted(() => vi.fn());
const mockUseTRPC = vi.hoisted(() => vi.fn());
const mockUseQuery = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-user", () => ({
  useUser: mockUseUser,
}));

vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: mockUseTRPC,
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: mockUseQuery,
}));

import { UserProvider, useUserContext } from "@/context/user-context";

function Wrapper({ children }: { children: ReactNode }) {
  return <UserProvider>{children}</UserProvider>;
}

describe("UserContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prefers fresh user profile data for avatar over stale session user", () => {
    mockUseUser.mockReturnValue({
      user: {
        id: "user-1",
        email: "stale@example.com",
        name: "Stale",
        image: null,
      },
      isLoading: false,
    });

    mockUseTRPC.mockReturnValue({
      user: {
        get: {
          queryOptions: () => ({ queryKey: ["user.get"], queryFn: vi.fn() }),
        },
      },
    });

    mockUseQuery.mockReturnValue({
      data: {
        id: "user-1",
        email: "fresh@example.com",
        name: "Fresh",
        image: "/avatars/user-1.png",
      },
    });

    const { result } = renderHook(() => useUserContext(), { wrapper: Wrapper });

    expect(result.current.user?.image).toBe("/avatars/user-1.png");
    expect(result.current.user?.email).toBe("fresh@example.com");
  });
});
