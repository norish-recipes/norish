// @vitest-environment jsdom
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));
vi.mock("react-native-reanimated", () => import("../../../../__tests__/mocks/reanimated"));
vi.mock("react-intl", () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
vi.mock("@expo/vector-icons/MaterialCommunityIcons", () => ({ default: () => null }));
vi.mock("@/components/segmented", () => ({
  Segmented: ({ tabsLabel }: { tabsLabel?: string }) => (
    <i data-testid="seg" data-tabs={tabsLabel} />
  ),
}));

const { ListSwitch } = await import("../components/list-switch");

describe("ListSwitch", () => {
  it("is a tab list, as it switches between the list and the Pantry", () => {
    render(
      <ListSwitch
        offset={{ get: () => 0, set: () => {}, value: 0 } as never}
        section="list"
        top={0}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByTestId("seg").getAttribute("data-tabs")).toBe("groceries.page.title");
  });
});
