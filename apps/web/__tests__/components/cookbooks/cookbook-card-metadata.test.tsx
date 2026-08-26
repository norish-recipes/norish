/**
 * What a cookbook card says about the set it stands for.
 *
 * A cookbook stores nothing but its title, so every one of these is derived
 * from its members — which makes "does the card actually say it" the only
 * place the derivation is observable.
 */
import type { ReactNode } from "react";
import { forwardRef } from "react";
import CookbookCard from "@/components/cookbooks/cookbook-card";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CookbookSummaryDTO } from "@norish/shared/contracts";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/",
}));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));
vi.mock("@/context/permissions-context", () => ({
  usePermissionsContext: () => ({ canEditRecipe: () => true, canDeleteRecipe: () => true }),
}));
vi.mock("@/components/cookbooks/cookbook-cover", () => ({ default: () => null }));
vi.mock("@/components/cookbooks/cookbook-panels", () => ({
  CookbookEditPanel: () => null,
  DeleteCookbookModal: () => null,
}));
vi.mock("@/hooks/use-mounted-once-opened", () => ({ useMountedOnceOpened: () => false }));
vi.mock("@/components/shared/swipable-row", () => ({
  default: forwardRef(function SwipeableRowMock(
    { children }: { children?: ReactNode },
    _ref: React.Ref<unknown>
  ) {
    return <div>{children}</div>;
  }),
}));

vi.mock("@heroui/react", () => {
  const Chip = ({ children, className, color }: any) => (
    <span className={className} data-color={color ?? ""} data-testid="chip">
      {children}
    </span>
  );

  Chip.Label = ({ children }: any) => <span>{children}</span>;

  const Card = ({ children }: any) => <div>{children}</div>;

  Card.Content = ({ children }: any) => <div>{children}</div>;

  const Tooltip = ({ children }: any) => <div>{children}</div>;

  Tooltip.Content = ({ children }: any) => <div>{children}</div>;

  return {
    Chip,
    Card,
    Tooltip,
    Button: ({ children, onPress, ...props }: any) => (
      <button type="button" onClick={onPress} {...props}>
        {children}
      </button>
    ),
  };
});

function cookbook(overrides: Partial<CookbookSummaryDTO> = {}): CookbookSummaryDTO {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    userId: "reader",
    title: "Weeknights",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    version: 1,
    memberCount: 3,
    coverImages: [],
    memberTitles: ["Soup", "Cake", "Stew"],
    memberTags: ["Nuts", "Vegetarian"],
    totalMinutes: 105,
    minServings: 2,
    ...overrides,
  };
}

function renderCard(overrides: Partial<CookbookSummaryDTO> = {}, allergies: string[] = ["nuts"]) {
  return render(
    <CookbookCard
      allergies={allergies}
      cookbook={cookbook(overrides)}
      variant="list"
      onDelete={vi.fn()}
    />
  );
}

describe("CookbookCard", () => {
  it("describes a cookbook by what is inside it", () => {
    renderCard();

    expect(screen.getByText("Soup, Cake, Stew")).toBeInTheDocument();
  });

  it("adds the members' cooking times up and names the smallest serving", () => {
    renderCard();

    const chips = screen.getAllByTestId("chip").map((chip) => chip.textContent);

    expect(chips).toContain("1:45h");
    expect(chips).toContain("2");
  });

  it("names the reader's own allergens and no other member tag", () => {
    renderCard();

    const warnings = screen
      .getAllByTestId("chip")
      .filter((chip) => chip.dataset.color === "warning")
      .map((chip) => chip.textContent);

    expect(warnings).toEqual(["Nuts"]);
  });

  it("paints a row cached before the derived fields existed", () => {
    // A cache restored from an older build carries cookbook rows without them,
    // because the cache buster keys on the app version and that does not move
    // while a release is being built. An emptier card, never a crash.
    const legacy = cookbook();

    delete (legacy as Partial<CookbookSummaryDTO>).memberTitles;
    delete (legacy as Partial<CookbookSummaryDTO>).memberTags;
    delete (legacy as Partial<CookbookSummaryDTO>).totalMinutes;
    delete (legacy as Partial<CookbookSummaryDTO>).minServings;

    render(
      <CookbookCard allergies={["nuts"]} cookbook={legacy} variant="list" onDelete={vi.fn()} />
    );

    expect(screen.getByText("Weeknights")).toBeInTheDocument();
    expect(screen.getAllByTestId("chip").map((chip) => chip.textContent)).toEqual([
      'recipeCount:{"count":3}',
    ]);
  });

  it("says nothing about time when no member states one", () => {
    renderCard({ totalMinutes: null });

    const chips = screen.getAllByTestId("chip").map((chip) => chip.textContent);

    expect(chips).not.toContain("0m");
  });
});
