// @vitest-environment jsdom
import { useSyncExternalStore } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  const state = {
    items: [] as { id: string; ingredientId: string; name: string; localeNames: object }[],
  };

  return {
    state,
    back: vi.fn(),
    subscribe: (listener: () => void) => {
      listeners.add(listener);

      return () => void listeners.delete(listener);
    },
    remove: (id: string) => {
      state.items = state.items.filter((item) => item.id !== id);
      listeners.forEach((listener) => listener());
    },
  };
});

vi.mock("react-native", async () => {
  const { createElement } = await import("react");
  const box = ({ children }: { children?: React.ReactNode }) =>
    createElement("div", null, children);

  return { Text: box, View: box };
});
vi.mock("@/components/sheet", () => ({
  Sheet: ({
    children,
    name,
    confirm,
  }: {
    children: React.ReactNode;
    name: string;
    confirm?: { onPress: () => void };
  }) => (
    <div>
      {children}
      {confirm ? (
        <button data-testid={`${name}-confirm`} type="button" onClick={confirm.onPress} />
      ) : null}
    </div>
  ),
  SheetBody: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("expo-router", () => {
  const router = { back: store.back };

  return { useRouter: () => router, useLocalSearchParams: () => ({ id: "p1" }) };
});
vi.mock("@/components/switch", () => ({
  Switch: ({ onSelectedChange }: { onSelectedChange: (value: boolean) => void }) => (
    <button data-testid="switch" onClick={() => onSelectedChange(false)} />
  ),
}));
vi.mock("heroui-native", () => ({
  Skeleton: () => null,
  Button: Object.assign(
    ({ onPress, testID }: { onPress: () => void; testID: string }) => (
      <button data-testid={testID} onClick={onPress} />
    ),
    { Label: () => null }
  ),
}));
vi.mock("react-intl", () => ({
  useIntl: () => ({ locale: "en", formatMessage: ({ id }: { id: string }) => id }),
}));
vi.mock("@/components/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => children,
  CardRow: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("../components/pantry-rows", () => ({ OnTheListChip: () => null }));
vi.mock("@norish/shared-react/groceries", () => ({
  useOnTheList: () => [],
  usePantryMutations: () => ({ removePantryIngredient: store.remove }),
  usePantryQuery: () => ({
    items: useSyncExternalStore(store.subscribe, () => store.state.items),
    isRead: true,
  }),
}));

const { FoodScreen } = await import("../screens/food-screen");

describe("the food sheet", () => {
  beforeEach(() => {
    store.back.mockClear();
    store.state.items = [{ id: "p1", ingredientId: "i1", name: "Salt", localeNames: {} }];
  });

  it("closes once, not twice, when Save takes the food out", () => {
    render(<FoodScreen />);
    fireEvent.click(screen.getByTestId("switch"));
    fireEvent.click(screen.getByTestId("pantry-food-confirm"));

    expect(store.state.items).toHaveLength(0);
    expect(store.back).toHaveBeenCalledTimes(1);
  });

  it("closes once when Save keeps the food", () => {
    render(<FoodScreen />);
    fireEvent.click(screen.getByTestId("pantry-food-confirm"));

    expect(store.back).toHaveBeenCalledTimes(1);
  });

  it("closes when a housemate takes the food out", () => {
    render(<FoodScreen />);
    act(() => store.remove("p1"));

    expect(store.back).toHaveBeenCalledTimes(1);
  });
});
