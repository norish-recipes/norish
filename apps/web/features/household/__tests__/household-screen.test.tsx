import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import { HouseholdScreen } from "@/features/household/household-screen";

const mocks = vi.hoisted(() => ({
  household: { isLoading: false, household: null as { id: string } | null },
}));

vi.mock("@norish/shared-react/reader", () => ({
  useHousehold: () => mocks.household,
}));
vi.mock("@/features/household/components/household-skeleton", () => ({
  default: ({ shape }: { shape: string }) => <div>skeleton:{shape}</div>,
}));
vi.mock("@/features/household/components/household-view", () => ({
  default: () => <div>household view</div>,
}));
vi.mock("@/features/household/components/no-household-view", () => ({
  default: () => <div>no household view</div>,
}));

describe("HouseholdScreen", () => {
  beforeEach(() => {
    mocks.household = { isLoading: false, household: null };
  });

  it("draws the page's skeleton while the household loads", () => {
    mocks.household = { isLoading: true, household: null };
    render(<HouseholdScreen shape="admin" />);

    expect(screen.getByText("skeleton:admin")).toBeInTheDocument();
  });

  it("draws the household when the reader has one", () => {
    mocks.household = { isLoading: false, household: { id: "h1" } };
    render(<HouseholdScreen shape="member" />);

    expect(screen.getByText("household view")).toBeInTheDocument();
  });

  it("offers to create or join one when the reader has none", () => {
    render(<HouseholdScreen shape="none" />);

    expect(screen.getByText("no household view")).toBeInTheDocument();
  });
});
