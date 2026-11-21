// @vitest-environment jsdom
import React from "react";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const setView = vi.hoisted(() => vi.fn());

vi.mock("react-native", () => ({ View: () => null }));
vi.mock("@/components/glass", () => ({ GlassIconButton: () => null }));
vi.mock("@/components/rolling-text", () => ({ RollingText: () => null }));
vi.mock("@/lib/haptics", () => ({ lightImpact: () => {} }));
vi.mock("@expo/vector-icons/Ionicons", () => ({ default: () => null }));
vi.mock("expo-router", () => ({ useRouter: () => ({}) }));
vi.mock("react-intl", () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
vi.mock("@norish/shared-react/reader", () => ({
  useDevicePreference: () => ["grid", setView],
}));
vi.mock("@norish/shared-react/recipes", () => ({ useLibraryFilters: () => ({}) }));
// One button per segment that picks it.
vi.mock("@/components/segmented", () => ({
  Segmented: ({
    segments,
    onChange,
  }: {
    segments: { value: string; testID: string }[];
    onChange: (value: string) => void;
  }) =>
    segments.map(({ value, testID }) => (
      <button key={value} data-testid={testID} onClick={() => onChange(value)} />
    )),
}));

const { ViewToggle } = await import("@/features/recipes/components/library-header");

describe("ViewToggle", () => {
  it("sets the device's view to the other one when pressed", () => {
    const { getByTestId } = render(<ViewToggle />);

    fireEvent.click(getByTestId("library-view-list"));
    expect(setView).toHaveBeenCalledWith("list");
  });
});
