// @vitest-environment jsdom
import type { ReactNode } from "react";
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

type Props = { children?: ReactNode; className?: string; testID?: string };

vi.mock("react-native", () => ({
  View: ({ children, className }: Props) => <div className={className}>{children}</div>,
  ActivityIndicator: ({
    accessibilityLabel,
    color,
    size,
  }: {
    accessibilityLabel: string;
    color: string;
    size: string;
  }) => <i aria-label={accessibilityLabel} data-color={color} data-size={size} />,
}));
vi.mock("heroui-native", () => ({ useThemeColor: () => ["muted-colour"] }));
vi.mock("react-intl", () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

const { Loader } = await import("@/components/loader");

describe("Loader", () => {
  it("fills its parent and centres when asked, in the theme's muted tone", () => {
    const { container } = render(<Loader centred />);
    const indicator = screen.getByLabelText("common.loading");

    expect(container.firstElementChild?.className).toContain("flex-1 items-center justify-center");
    expect(indicator.dataset.color).toBe("muted-colour");
  });

  it("is the bare indicator by default, with the caller's colour and label", () => {
    const { container } = render(<Loader color="white" label="Saving" size="large" />);
    const indicator = screen.getByLabelText("Saving");

    expect(container.firstElementChild).toBe(indicator);
    expect(indicator.dataset.color).toBe("white");
    expect(indicator.dataset.size).toBe("large");
  });
});
