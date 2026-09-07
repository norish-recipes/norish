/**
 * The grocery panels around their product field: the field is about the Store
 * that is selected now and the grocery being added now, and nothing of the
 * last one may survive into it.
 */
import type { ReactNode } from "react";
import AddGroceryPanel from "@/components/Panel/consumers/add-grocery-panel";
import EditGroceryPanel from "@/components/Panel/consumers/edit-grocery-panel";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import type { GroceryDto, StoreDto, StoreProductDto } from "@norish/shared/contracts";

vi.mock("@/hooks/config/use-units-query", () => ({
  useUnitsQuery: () => ({ units: {} }),
}));

const chooseProduct = vi.fn();

function product(id: string, storeId: string, name: string, price: number): StoreProductDto {
  return {
    id,
    storeId,
    name,
    pageUrl: `https://${storeId}.example/p/${id}`,
    price,
    currency: "EUR",
    size: "1 L",
    regularPrice: null,
    promotionNote: null,
    readAt: new Date("2026-09-01T00:00:00Z"),
  } as unknown as StoreProductDto;
}

const COLA_AT_A = product("prod-a", "store-a", "Coca-Cola 1 L", 1.99);
const COLA_AT_B = product("prod-b", "store-b", "Cola B 1 L", 1.49);

/** What each Store has learned "cola" means, as the database holds it. */
const LINKS: Record<string, StoreProductDto> = {
  "store-a|cola": COLA_AT_A,
  "store-b|cola": COLA_AT_B,
};

/**
 * `stores.groceryPrices` prices *the list*: it answers for the Store each
 * grocery sits under and for no other, so a Store the shopper has only
 * selected is not in it.
 */
const ON_THE_LIST = new Set(["store-a|cola"]);
/** Names the list's Store has been asked about and has not answered: a Pending Link. */
const ASKED_ON_THE_LIST = new Set<string>();

vi.mock("@/hooks/stores/use-store-prices", () => ({
  useStorePrices: () => {
    const linkFor = (storeId: string | null, name: string | null) => {
      const normalized = (name ?? "").toLowerCase();
      const key = `${storeId}|${normalized}`;

      if (ASKED_ON_THE_LIST.has(key)) {
        return { storeId, normalizedName: normalized, triedAt: null, product: null };
      }

      return ON_THE_LIST.has(key)
        ? { storeId, normalizedName: normalized, triedAt: new Date(), product: LINKS[key] ?? null }
        : null;
    };

    return {
      priceFor: (storeId: string | null, name: string | null) =>
        linkFor(storeId, name)?.product ?? null,
      linkFor,
      isLoading: false,
    };
  },
}));

vi.mock("@/hooks/stores/use-parsed-grocery-name", () => ({
  useParsedGroceryName: (raw: string) => raw.trim(),
}));

vi.mock("@/hooks/stores/use-store-products-mutations", () => ({
  useChooseProduct: () => chooseProduct,
}));

vi.mock("@/hooks/stores/use-store-products-query", () => ({
  useShopSearch: () => ({ data: undefined, isPending: true, isFetching: false }),
  useStoreProducts: (storeId: string | null, enabled: boolean) => ({
    data: enabled
      ? Object.values(LINKS).filter((candidate) => candidate.storeId === storeId)
      : undefined,
    isPending: !enabled,
    isFetching: false,
  }),
  useProductLink: (storeId: string | null, name: string) => {
    const key = `${storeId}|${name.trim().toLowerCase()}`;
    const product = LINKS[key];

    return {
      data: product
        ? { storeId, normalizedName: name.trim().toLowerCase(), product, lastTriedAt: null }
        : null,
      isPending: false,
    };
  },
}));

vi.mock("@/hooks/use-recurrence-detection", () => ({
  useRecurrenceDetection: () => ({ detectedPattern: null }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key} ${Object.values(params).join(" ")}` : key,
  useLocale: () => "en",
}));

vi.mock("@/components/Panel/Panel", () => {
  const Panel = ({ children, open }: { children: ReactNode; open: boolean }) =>
    open ? <div>{children}</div> : null;

  Panel.Body = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  Panel.Footer = ({ children }: { children: ReactNode }) => <div>{children}</div>;

  return { default: Panel, usePanelPortalContainer: () => undefined };
});

vi.mock("@/components/Panel/consumers/recurrence-panel", () => ({
  RecurrencePanel: () => null,
}));

vi.mock("@/app/(app)/groceries/components/recurrence-suggestion", () => ({
  RecurrenceSuggestion: () => null,
}));

vi.mock("@/components/shared/action-button", () => ({
  ActionButton: ({ children, onPress, isDisabled, action }: any) => (
    <button data-testid={`action-${action}`} disabled={isDisabled} type="button" onClick={onPress}>
      {children}
    </button>
  ),
  ActionButtonGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

// The Store picker itself is not what these are about; a plain select drives
// exactly the callback the real one does.
vi.mock("@/components/groceries/store-selector", () => ({
  StoreSelector: ({ selectedStoreId, stores, onSelectionChange }: any) => (
    <select
      data-testid="store-selector"
      value={selectedStoreId ?? "none"}
      onChange={(event) =>
        onSelectionChange(event.target.value === "none" ? null : event.target.value)
      }
    >
      <option value="none">none</option>
      {stores.map((store: StoreDto) => (
        <option key={store.id} value={store.id}>
          {store.name}
        </option>
      ))}
    </select>
  ),
}));

function store(id: string, name: string): StoreDto {
  return {
    id,
    name,
    color: "blue",
    icon: "ShoppingCartIcon",
    sortOrder: 0,
    website: `https://${id}.example`,
    searchAddress: `https://${id}.example/search?q={query}`,
    aisles: [],
  } as unknown as StoreDto;
}

const STORES = [store("store-a", "Store A"), store("store-b", "Store B")];

const GROCERY = {
  id: "grocery-1",
  name: "cola",
  amount: null,
  unit: null,
  storeId: "store-a",
  completed: false,
  version: 1,
} as unknown as GroceryDto;

beforeEach(() => {
  chooseProduct.mockClear();
  ASKED_ON_THE_LIST.clear();
});

describe("EditGroceryPanel, on a grocery the Store is still being asked about", () => {
  it("waits on the Pending Link rather than asking the shop itself", () => {
    ASKED_ON_THE_LIST.add("store-a|beleg");
    render(
      <EditGroceryPanel
        grocery={{ ...GROCERY, name: "beleg" } as GroceryDto}
        open={true}
        recurringGrocery={null}
        stores={STORES}
        onDelete={() => undefined}
        onOpenChange={() => undefined}
        onSave={() => undefined}
      />
    );

    act(() => {
      screen.getByTestId("grocery-product-field").focus();
    });

    // Nothing linked is not an answer yet: the queue is asking, so the field
    // neither searches the shop for the name nor offers to type a price.
    expect(screen.queryByTestId("product-searching")).not.toBeInTheDocument();
    expect(screen.queryByTestId("product-by-hand")).not.toBeInTheDocument();
  });
});

describe("EditGroceryPanel, swapping the Store", () => {
  it("reads the new Store's own linked product straight away", () => {
    render(
      <EditGroceryPanel
        grocery={GROCERY}
        open={true}
        recurringGrocery={null}
        stores={STORES}
        onDelete={() => undefined}
        onOpenChange={() => undefined}
        onSave={() => undefined}
      />
    );

    expect(screen.getByTestId("grocery-product-field")).toHaveValue("Coca-Cola 1 L");

    fireEvent.change(screen.getByTestId("store-selector"), { target: { value: "store-b" } });

    expect(screen.getByTestId("grocery-product-field")).toHaveValue("Cola B 1 L");
    expect(screen.getByTestId("product-by-hand-price")).toHaveValue("1.49");
  });

  it("never writes a product of the Store that was swapped away from", () => {
    render(
      <EditGroceryPanel
        grocery={GROCERY}
        open={true}
        recurringGrocery={null}
        stores={STORES}
        onDelete={() => undefined}
        onOpenChange={() => undefined}
        onSave={() => undefined}
      />
    );

    // Point the grocery at one of Store A's products, then change Store.
    act(() => {
      screen.getByTestId("grocery-product-field").focus();
    });

    const option = screen
      .getAllByTestId("product-option")
      .find((node) => node.textContent?.includes("Coca-Cola 1 L"));

    expect(option).toBeDefined();
    act(() => {
      fireEvent.click(option as HTMLElement);
    });
    expect(screen.getByTestId("grocery-product-field")).toHaveValue("Coca-Cola 1 L");

    fireEvent.change(screen.getByTestId("store-selector"), { target: { value: "store-b" } });
    fireEvent.click(screen.getByTestId("action-save"));

    // Store A's product is not in Store B; writing it there is an error the
    // shopper never asked for.
    expect(chooseProduct).not.toHaveBeenCalled();
  });
});

describe("EditGroceryPanel, the order of its fields", () => {
  it("puts the recurrence control under the name and before the Store", () => {
    render(
      <EditGroceryPanel
        grocery={GROCERY}
        open={true}
        recurringGrocery={null}
        stores={STORES}
        onDelete={() => undefined}
        onOpenChange={() => undefined}
        onSave={() => undefined}
      />
    );

    const name = screen.getByPlaceholderText("editPlaceholder");
    const recurrence = screen.getByText("addRepeat");
    const store = screen.getByTestId("store-selector");

    // Name, then recurrence, then the Store: what the row is, how often it
    // comes back, and only then where it is bought.
    expect(
      name.compareDocumentPosition(recurrence) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      recurrence.compareDocumentPosition(store) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
});

describe("EditGroceryPanel, the product's details", () => {
  it("keeps them behind a row of their own, opened like the recurrence editor", () => {
    render(
      <EditGroceryPanel
        grocery={GROCERY}
        open={true}
        recurringGrocery={null}
        stores={STORES}
        onDelete={() => undefined}
        onOpenChange={() => undefined}
        onSave={() => undefined}
      />
    );

    // The row says what is behind it, and the fields themselves are not on
    // the panel until it is opened.
    const row = screen.getByTestId("product-details");

    expect(row).toHaveTextContent("EUR · 1 L");
    expect(screen.queryByTestId("product-by-hand-name")).not.toBeInTheDocument();

    fireEvent.click(row);

    expect(screen.getByTestId("product-by-hand-name")).toHaveValue("Coca-Cola 1 L");
    expect(screen.getByTestId("product-by-hand-currency")).toHaveValue("EUR");

    fireEvent.click(screen.getByTestId("action-done"));

    expect(screen.queryByTestId("product-by-hand-name")).not.toBeInTheDocument();
  });

  it("refuses to save while the price typed is not a price", () => {
    render(
      <EditGroceryPanel
        grocery={GROCERY}
        open={true}
        recurringGrocery={null}
        stores={STORES}
        onDelete={() => undefined}
        onOpenChange={() => undefined}
        onSave={() => undefined}
      />
    );

    expect(screen.getByTestId("action-save")).toBeEnabled();

    fireEvent.change(screen.getByTestId("product-by-hand-price"), { target: { value: "abc" } });

    expect(screen.getByTestId("product-price-error")).toHaveTextContent("invalidPrice");
    expect(screen.getByTestId("action-save")).toBeDisabled();

    fireEvent.change(screen.getByTestId("product-by-hand-price"), { target: { value: "2,49" } });

    expect(screen.queryByTestId("product-price-error")).not.toBeInTheDocument();
    expect(screen.getByTestId("action-save")).toBeEnabled();
  });
});

describe("AddGroceryPanel, the order of its fields and what it refuses", () => {
  it("puts the recurrence control under the name and before the Store, and waits on a price", () => {
    const onCreate = vi.fn();

    render(
      <AddGroceryPanel
        open={true}
        stores={STORES}
        onCreate={onCreate}
        onCreateRecurring={() => undefined}
        onOpenChange={() => undefined}
      />
    );

    const name = screen.getByPlaceholderText("placeholder");
    const recurrence = screen.getByText("addRepeat");
    const store = screen.getByTestId("store-selector");

    expect(
      name.compareDocumentPosition(recurrence) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      recurrence.compareDocumentPosition(store) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    fireEvent.change(name, { target: { value: "cola" } });
    fireEvent.change(store, { target: { value: "store-a" } });
    const add = screen.getByRole("button", { name: "add" });

    expect(add).toBeEnabled();

    fireEvent.change(screen.getByTestId("product-by-hand-price"), { target: { value: "abc" } });
    expect(screen.getByTestId("product-price-error")).toBeInTheDocument();
    expect(add).toBeDisabled();
    fireEvent.click(add);
    expect(onCreate).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId("product-by-hand-price"), { target: { value: "1.99" } });
    expect(add).toBeEnabled();
  });
});

describe("AddGroceryPanel, adding one grocery after another", () => {
  it("does not offer the last grocery's product for the next one", () => {
    render(
      <AddGroceryPanel
        open={true}
        stores={STORES}
        onCreate={() => undefined}
        onCreateRecurring={() => undefined}
        onOpenChange={() => undefined}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("placeholder"), { target: { value: "cola" } });
    fireEvent.change(screen.getByTestId("store-selector"), { target: { value: "store-a" } });

    act(() => {
      screen.getByTestId("grocery-product-field").focus();
    });

    const option = screen
      .getAllByTestId("product-option")
      .find((node) => node.textContent?.includes("Coca-Cola 1 L"));

    act(() => {
      fireEvent.click(option as HTMLElement);
    });
    expect(screen.getByTestId("grocery-product-field")).toHaveValue("Coca-Cola 1 L");

    // The panel stays open for the next grocery; the last one's product must
    // not still be sitting in it.
    fireEvent.click(screen.getByRole("button", { name: "add" }));

    expect(screen.getByTestId("grocery-product-field")).toHaveValue("");
    expect(screen.queryByTestId("product-by-hand")).not.toBeInTheDocument();
  });
});
