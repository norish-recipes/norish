// @vitest-environment jsdom
/** The no-results card's icon: the warning tone's own ink by default, the board's ink where Search asks. */
import type { ReactNode } from "react";
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

type Props = { children?: ReactNode; testID?: string; color?: string };

vi.mock("react-native", () => ({
  Text: ({ children }: Props) => <span>{children}</span>,
  View: ({ children, testID }: Props) => <div data-testid={testID}>{children}</div>,
  Pressable: ({ children }: Props) => <button>{children}</button>,
}));
vi.mock("@/hooks/use-token-color", () => ({ useTokenColor: (name: string) => name }));
vi.mock("@/hooks/use-warning-ink-color", () => ({ useWarningInkColor: () => "warning-ink" }));
vi.mock("@expo/vector-icons/Ionicons", () => ({
  default: ({ color }: Props) => <i data-testid="icon" data-color={color} />,
}));
vi.mock("react-intl", () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

const { NoResultsCard } = await import("@/components/no-results-card");
const { SearchNoResults } = await import("@/features/search/components/no-results");

const iconColor = () => screen.getAllByTestId("icon")[0]!.getAttribute("data-color");

describe("the no-results card", () => {
  it("draws the warning tone's icon in its warning colour, as the Recipes tab shows it", () => {
    render(<NoResultsCard icon="funnel-outline" testID="library-no-results" />);

    expect(iconColor()).toBe("warning");
  });

  it("draws Search's icon in the warning ink", () => {
    render(
      <SearchNoResults
        text="soup"
        variant="plain"
        onClearFilters={() => {}}
        onSearchAllFields={() => {}}
      />
    );

    expect(iconColor()).toBe("warning-ink");
  });
});
