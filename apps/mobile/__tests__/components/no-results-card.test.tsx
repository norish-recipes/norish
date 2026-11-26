// @vitest-environment jsdom
/** The empty-state template: the icon in muted ink, the title, no description, one action under them. */
import type { ReactNode } from "react";
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

type Props = { children?: ReactNode; testID?: string; color?: string };

vi.mock("react-native", () => ({
  Text: ({ children }: Props) => <span>{children}</span>,
  View: ({ children, testID }: Props) => <div data-testid={testID}>{children}</div>,
  Pressable: ({ children, testID }: Props) => <button data-testid={testID}>{children}</button>,
}));
vi.mock("@/hooks/use-token-color", () => ({ useTokenColor: (name: string) => name }));
vi.mock("@expo/vector-icons/Ionicons", () => ({
  default: ({ color }: Props) => <i data-testid="icon" data-color={color} />,
}));
vi.mock("react-intl", () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

const { NoResultsCard } = await import("@/components/no-results-card");

describe("the empty-state template", () => {
  it("is a muted icon and the title, with no description line", () => {
    render(
      <NoResultsCard icon="funnel-outline" testID="library-no-results" title="Nothing here" />
    );

    const card = screen.getByTestId("library-no-results");

    expect(screen.getAllByTestId("icon")[0]!.getAttribute("data-color")).toBe("muted");
    expect(card.textContent).toBe("Nothing here");
  });

  it("puts its one action under the icon and title row", () => {
    render(
      <NoResultsCard
        action={{ label: "Clear", icon: "refresh", testID: "clear", onPress: () => {} }}
        icon="funnel-outline"
        testID="library-no-results"
        title="Nothing here"
      />
    );

    const card = screen.getByTestId("library-no-results");

    expect(card.lastElementChild).toBe(screen.getByTestId("clear"));
    expect(card.textContent).toBe("Nothing hereClear");
  });
});
