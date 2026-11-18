// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ProductRow as Row } from "@norish/shared-react/groceries";
import type { StoreDto } from "@norish/shared/contracts";

vi.mock("react-native", async () => {
  const { createElement } = await import("react");
  const tag =
    (name: string) =>
    ({
      children,
      testID,
      onPress,
    }: {
      children?: React.ReactNode;
      testID?: string;
      onPress?: () => void;
    }) =>
      createElement(name, { "data-testid": testID, onClick: onPress }, children);

  return { Pressable: tag("button"), Text: tag("span"), View: tag("div") };
});
vi.mock("@expo/vector-icons/Ionicons", () => ({ default: () => null }));
vi.mock("heroui-native", async () => {
  const { createElement } = await import("react");
  const Button = ({
    children,
    testID,
    onPress,
  }: {
    children?: React.ReactNode;
    testID?: string;
    onPress?: () => void;
  }) => createElement("button", { "data-testid": testID, onClick: onPress }, children);

  Button.Label = ({ children }: { children?: React.ReactNode }) => children;

  return {
    Button,
    Input: ({
      testID,
      value,
      onChangeText,
    }: {
      testID?: string;
      value?: string;
      onChangeText?: (v: string) => void;
    }) =>
      createElement("input", {
        "data-testid": testID,
        value,
        onChange: (e: { target: { value: string } }) => onChangeText?.(e.target.value),
      }),
    TextField: ({ children }: { children?: React.ReactNode }) => children,
    useThemeColor: () => ["#000", "#f00"],
  };
});
vi.mock("react-intl", () => ({
  useIntl: () => ({ locale: "en", formatMessage: ({ id }: { id: string }) => id }),
}));
vi.mock("@/components/sheet", async () => {
  const { createElement } = await import("react");
  const box = ({ children }: { children?: React.ReactNode }) =>
    createElement("div", null, children);

  return {
    Sheet: ({
      children,
      secondary = [],
      confirm,
    }: {
      children?: React.ReactNode;
      secondary?: { label: string; onPress: () => void }[];
      confirm?: { onPress?: () => void };
    }) =>
      createElement(
        "div",
        null,
        children,
        ...secondary.map((action, index) =>
          createElement("button", {
            key: index,
            "data-testid": action.label,
            onClick: action.onPress,
          })
        ),
        createElement("button", { "data-testid": "header-confirm", onClick: confirm?.onPress })
      ),
    SheetBody: box,
  };
});
vi.mock("../components/form-parts", () => ({
  FormCard: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

const { ProductStep } = await import("../components/product-step");
const { ProductRow } = await import("../components/product-row");

const store = { id: "s1", name: "AH" } as StoreDto;
const row = (key: string, name: string, price: number): Row =>
  ({
    key,
    name,
    price,
    currency: "EUR",
    packWords: "per piece",
    regularPrice: null,
    choice: { kind: "product", storeProductId: key },
  }) as unknown as Row;

function field(overrides: Record<string, unknown> = {}) {
  return {
    canSearch: true,
    term: "avo",
    knownRows: [row("p1", "AH Avocado", 0.99)],
    shopRows: [row("p2", "AH Avocado XL", 1.29)],
    picked: "p1",
    isSearching: false,
    foundNothing: false,
    noAnswer: false,
    unlinked: false,
    hasTypedPrice: false,
    priceInvalid: false,
    currencyInvalid: false,
    manualPrice: "",
    manualCurrency: "",
    suggestedCurrency: "EUR",
    onTermInput: vi.fn(),
    ask: vi.fn(),
    takeTapped: vi.fn(),
    unlink: vi.fn(),
    editPrice: vi.fn(),
    editCurrency: vi.fn(),
    ...overrides,
  };
}

describe("the product step", () => {
  it("lists what the Store knows and what the shop answered, and takes a tapped product", () => {
    const f = field();

    render(<ProductStep field={f as never} linked={false} store={store} onBack={vi.fn()} />);
    const options = screen.getAllByTestId("product-option");

    expect(options).toHaveLength(2);
    fireEvent.click(options[1]!);

    expect(f.takeTapped).toHaveBeenCalledWith(f.shopRows[0]);
  });

  it("asks the shop as the term is typed", () => {
    const f = field();

    render(<ProductStep field={f as never} linked={false} store={store} onBack={vi.fn()} />);
    fireEvent.change(screen.getByTestId("product-search"), { target: { value: "kaas" } });

    expect(f.onTermInput).toHaveBeenCalledWith("kaas");
  });

  it("opens the price fields on 'type the price yourself' and goes back on Done", () => {
    const f = field();
    const onBack = vi.fn();

    render(<ProductStep field={f as never} linked={false} store={store} onBack={onBack} />);
    expect(screen.queryByTestId("product-price")).toBeNull();
    fireEvent.click(screen.getByTestId("groceries.mobile.typePrice"));
    fireEvent.change(screen.getByTestId("product-price"), { target: { value: "2,49" } });

    expect(f.editPrice).toHaveBeenCalledWith("2,49");
    expect(screen.queryByTestId("groceries.mobile.typePrice")).toBeNull();
    fireEvent.click(screen.getByTestId("header-confirm"));
    expect(onBack).toHaveBeenCalled();
  });

  it("offers to let go of a linked product, once", () => {
    const f = field();
    const { rerender } = render(
      <ProductStep field={f as never} linked store={store} onBack={vi.fn()} />
    );

    fireEvent.click(screen.getByTestId("product-unlink"));
    expect(f.unlink).toHaveBeenCalled();

    rerender(
      <ProductStep
        field={field({ unlinked: true }) as never}
        linked
        store={store}
        onBack={vi.fn()}
      />
    );
    expect(screen.queryByTestId("product-unlink")).toBeNull();
  });
});

describe("the product row", () => {
  const none = { status: "none" } as never;

  it("is an invitation to choose while empty, and opens the search", () => {
    const onPress = vi.fn();

    render(<ProductRow price={none} onPress={onPress} />);
    fireEvent.click(screen.getByTestId("grocery-product"));

    expect(screen.getByText("groceries.mobile.chooseProduct")).toBeTruthy();
    expect(onPress).toHaveBeenCalled();
  });

  it("shows a held product without a cost, and nothing at all without a press or a product", () => {
    const { container, rerender } = render(
      <ProductRow held={{ name: "AH Avocado", detail: "€0.99 · per piece" }} price={none} />
    );

    expect(screen.getByText("AH Avocado")).toBeTruthy();
    expect(screen.getByText("€0.99 · per piece")).toBeTruthy();

    rerender(<ProductRow price={none} />);
    expect(container.textContent).toBe("");
  });
});
