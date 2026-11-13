import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import { fakeProcedure } from "@/__tests__/helpers/trpc-fake";
import { HouseholdScreen } from "@/features/household/household-screen";

import type { HouseholdData } from "@norish/shared-react/reader";
import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

vi.mock("@norish/shared-react/trpc", async () =>
  (await import("@/__tests__/helpers/trpc-fake")).mockTRPC()
);
vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

const ADMIN = { id: "ada", name: "Ada", isAdmin: true, version: 1 };
const MEMBER = { id: "bob", name: "Bob", isAdmin: false, version: 1 };

let queryClient: ReturnType<typeof createTestQueryClient>;

/** The screen over a cache holding `data`, or over a household read still pending. */
function renderScreen(shape: "none" | "member" | "admin", data?: HouseholdData) {
  if (data) queryClient.setQueryData(fakeProcedure("households.get").queryKey(), data);

  return render(<HouseholdScreen shape={shape} />, {
    wrapper: createTestWrapper(queryClient, fakePlatformAdapter()),
  });
}

describe("HouseholdScreen", () => {
  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  it("offers to create or join a household when the reader has none", () => {
    renderScreen("none", { household: null, currentUserId: ADMIN.id });

    expect(screen.getByText("settings.household.create.title")).toBeInTheDocument();
    expect(screen.getByText("settings.household.join.title")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "settings.household.create.submitButton" })
    ).toBeInTheDocument();
  });

  it("shows an admin the household, its members and the join code", () => {
    renderScreen("admin", {
      household: {
        id: "h1",
        name: "The Burrow",
        version: 1,
        users: [ADMIN, MEMBER],
        allergies: [],
        joinCode: "424242",
        joinCodeExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
      currentUserId: ADMIN.id,
    });

    expect(screen.getByText("The Burrow")).toBeInTheDocument();
    expect(screen.getByText("Ada")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByDisplayValue("424242")).toBeInTheDocument();
  });

  it("shows a member the household and its members without a join code", () => {
    renderScreen("member", {
      household: {
        id: "h1",
        name: "The Burrow",
        version: 1,
        users: [ADMIN, MEMBER],
        allergies: [],
      },
      currentUserId: MEMBER.id,
    });

    expect(screen.getByText("The Burrow")).toBeInTheDocument();
    expect(screen.getByText("Ada")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.queryByText("settings.household.joinCode.title")).not.toBeInTheDocument();
  });

  it("draws the tab's skeleton while the household read is pending", () => {
    const { container } = renderScreen("admin");

    expect(screen.getByText("settings.household.members.title")).toBeInTheDocument();
    expect(screen.getByText("settings.household.joinCode.title")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(container.querySelector(".skeleton")).toBeInTheDocument();
  });
});
