/**
 * The grocery panels around their product field: the field is about the Store
 * that is selected now and the grocery being added now, and nothing of the
 * last one may survive into it.
 */
import type { ReactNode } from "react";
import AddGroceryPanel from "@/components/Panel/consumers/add-grocery-panel";
import EditGroceryPanel from "@/components/Panel/consumers/edit-grocery-panel";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import type { GroceryDto, StoreDto, StoreProductDto } from "@norish/shared/contracts";

vi.mock("@/hooks/config/use-units-query", () => ({
  useUnitsQuery: () => ({ units: {} }),
}));

vi.mock("@/hooks/config/use-ingredient-words-query", () => ({
  useIngredientWordsQuery: () => ({ words: undefined }),
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

/** The Ingredient a name resolves to, as the catalogue answers `ingredients.find`. */
const ingredientOf = (name: string) => `i-${name.trim().toLowerCase()}`;

/**
 * `ingredients.find`: every name these tests type is one Norish knows. The
 * query runs synchronously here; the hook's own debounce is what a test waits
 * out, with fake timers, before a typed name has an Ingredient.
 */
vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({
    ingredients: {
      find: {
        queryOptions: (input: { name: string }, opts: { enabled?: boolean }) => ({
          ...opts,
          queryKey: ["ingredients.find", input.name],
          data: { ingredientId: ingredientOf(input.name) },
        }),
      },
    },
  }),
}));
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQuery: (options: { enabled?: boolean; data?: unknown }) => ({
    data: options.enabled === false ? undefined : options.data,
  }),
}));

/** Let the name typed settle, so the panel has asked for its Ingredient. */
function settle() {
  act(() => {
    vi.advanceTimersByTime(500);
  });
}

/** What each Store has learned cola (the Ingredient) means, as the database holds it. */
const LINKS: Record<string, StoreProductDto> = {
  "store-a|i-cola": COLA_AT_A,
  "store-b|i-cola": COLA_AT_B,
};

/**
 * `stores.groceryPrices` prices *the list*: it answers for the Store each
 * grocery sits under and for no other, so a Store the shopper has only
 * selected is not in it.
 */
const ON_THE_LIST = new Set(["store-a|i-cola"]);
/** Ingredients the list's Store has been asked about and has not answered: a Pending Link. */
const ASKED_ON_THE_LIST = new Set<string>();

vi.mock("@/hooks/stores/use-store-prices", () => ({
  useStorePrices: () => {
    const linkFor = (storeId: string | null, ingredientId: string | null | undefined) => {
      const key = `${storeId}|${ingredientId}`;

      if (!ingredientId) return null;
      if (ASKED_ON_THE_LIST.has(key)) {
        return { storeId, ingredientId, triedAt: null, product: null, suggestion: null };
      }

      return ON_THE_LIST.has(key)
        ? {
            storeId,
            ingredientId,
            triedAt: new Date(),
            product: LINKS[key] ?? null,
            suggestion: null,
          }
        : null;
    };

    return {
      priceFor: (storeId: string | null, ingredientId: string | null | undefined) =>
        linkFor(storeId, ingredientId)?.product ?? null,
      linkFor,
      isLoading: false,
    };
  },
}));

vi.mock("@/hooks/stores/use-parsed-grocery-name", () => ({
  useParsedGroceryName: (raw: string) => raw.trim(),
}));

/** Where each Store files each Ingredient, as the database holds it. */
const AISLE_LINKS: Record<string, string> = { "store-c|i-cola": "aisle-frisdrank" };
const fileGroceryName = vi.fn();

vi.mock("@/hooks/stores/use-store-aisles", () => ({
  useStoreAisles: () => ({
    aisleFor: (storeId: string | null, ingredientId: string | null | undefined) =>
      AISLE_LINKS[`${storeId}|${ingredientId}`] ?? null,
    isLoading: false,
  }),
  useFileGroceryName: () => fileGroceryName,
}));

// The Aisle field itself is not what these are about; a plain select drives
// exactly the callback the real one does.
vi.mock("@/components/groceries/aisle-selector", () => ({
  AisleSelector: ({ aisles, selectedAisleId, onSelectionChange }: any) => (
    <select
      data-testid="aisle-selector"
      value={selectedAisleId ?? "none"}
      onChange={(event) =>
        onSelectionChange(event.target.value === "none" ? null : event.target.value)
      }
    >
      <option value="none">noAisle</option>
      {aisles.map((aisle: { id: string; name: string }) => (
        <option key={aisle.id} value={aisle.id}>
          {aisle.name}
        </option>
      ))}
    </select>
  ),
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
    // The server resolves the name to its Ingredient and reads that link.
    const ingredientId = ingredientOf(name);
    const product = LINKS[`${storeId}|${ingredientId}`];

    return {
      data: product ? { storeId, ingredientId, product, triedAt: null, suggestion: null } : null,
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
  ActionButtonGroup: ({ children, start }: { children: ReactNode; start?: ReactNode }) => (
    <div>
      {start}
      {children}
    </div>
  ),
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
    sortOrder: 0,
    website: `https://${id}.example`,
    searchAddress: `https://${id}.example/search?q={query}`,
    aisles: [],
  } as unknown as StoreDto;
}

/** A Store with aisles: a plain one, with no shop behind it, which aisles need none of. */
const WITH_AISLES = {
  ...store("store-c", "Store C"),
  website: null,
  searchAddress: null,
  aisles: [
    { id: "aisle-frisdrank", storeId: "store-c", name: "Frisdrank", sortOrder: 0, version: 1 },
    { id: "aisle-zuivel", storeId: "store-c", name: "Zuivel", sortOrder: 1, version: 1 },
  ],
} as unknown as StoreDto;

const STORES = [store("store-a", "Store A"), store("store-b", "Store B"), WITH_AISLES];

const GROCERY = {
  id: "grocery-1",
  name: "cola",
  ingredientId: "i-cola",
  amount: null,
  unit: null,
  storeId: "store-a",
  completed: false,
  version: 1,
} as unknown as GroceryDto;

beforeEach(() => {
  vi.useFakeTimers();
  chooseProduct.mockClear();
  fileGroceryName.mockClear();
  ASKED_ON_THE_LIST.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the Aisle field, in both panels", () => {
  function aisleField() {
    return screen.queryByTestId("aisle-selector");
  }

  it("is there only for a Store with aisles, once there is a name, directly under the Store", () => {
    render(
      <AddGroceryPanel
        open={true}
        stores={STORES}
        onCreate={() => undefined}
        onCreateRecurring={() => undefined}
        onOpenChange={() => undefined}
      />
    );

    // No Store, then a Store without aisles: the panel a shopper already knows.
    fireEvent.change(screen.getByPlaceholderText("placeholder"), { target: { value: "cola" } });
    expect(aisleField()).not.toBeInTheDocument();
    fireEvent.change(screen.getByTestId("store-selector"), { target: { value: "store-a" } });
    expect(aisleField()).not.toBeInTheDocument();

    // A Store with aisles, and a name typed: the field, under the Store.
    fireEvent.change(screen.getByTestId("store-selector"), { target: { value: "store-c" } });
    const field = aisleField();

    expect(field).toBeInTheDocument();
    expect(
      screen.getByTestId("store-selector").compareDocumentPosition(field!) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    // Its options are the Store's aisles in order, and "No aisle".
    expect(Array.from((field as HTMLSelectElement).options).map((o) => o.textContent)).toEqual([
      "noAisle",
      "Frisdrank",
      "Zuivel",
    ]);

    // The name gone, the field goes with it.
    fireEvent.change(screen.getByPlaceholderText("placeholder"), { target: { value: "" } });
    expect(aisleField()).not.toBeInTheDocument();
  });

  it("shows what the Store remembers for a grocery's own Ingredient, and swaps with the Store", () => {
    render(
      <EditGroceryPanel
        grocery={{ ...GROCERY, storeId: "store-c" } as GroceryDto}
        open={true}
        recurringGrocery={null}
        stores={STORES}
        onDelete={() => undefined}
        onOpenChange={() => undefined}
        onSave={() => undefined}
      />
    );

    // Store C files "cola" under Frisdrank: filing reads as correcting a fact.
    expect(aisleField()).toHaveValue("aisle-frisdrank");

    // Another Store has no aisles: no field, and nothing of Store C's carried over.
    fireEvent.change(screen.getByTestId("store-selector"), { target: { value: "store-a" } });
    expect(aisleField()).not.toBeInTheDocument();

    // Back again, the field reads what the Store remembers, not a stale choice.
    fireEvent.change(screen.getByTestId("store-selector"), { target: { value: "store-c" } });
    expect(aisleField()).toHaveValue("aisle-frisdrank");
  });

  it("shows what the Store remembers for a name being typed, once its Ingredient is known", () => {
    render(
      <AddGroceryPanel
        open={true}
        stores={STORES}
        onCreate={() => undefined}
        onCreateRecurring={() => undefined}
        onOpenChange={() => undefined}
      />
    );

    fireEvent.change(screen.getByTestId("store-selector"), { target: { value: "store-c" } });
    fireEvent.change(screen.getByPlaceholderText("placeholder"), { target: { value: "Cola" } });
    // Still being typed: nothing is known about it yet.
    expect(aisleField()).toHaveValue("none");

    settle();
    expect(aisleField()).toHaveValue("aisle-frisdrank");
  });

  it("writes nothing until Save, and then only a choice that differs from what was remembered", () => {
    const onSave = vi.fn();

    render(
      <EditGroceryPanel
        grocery={{ ...GROCERY, storeId: "store-c" } as GroceryDto}
        open={true}
        recurringGrocery={null}
        stores={STORES}
        onDelete={() => undefined}
        onOpenChange={() => undefined}
        onSave={onSave}
      />
    );

    fireEvent.change(aisleField()!, { target: { value: "aisle-zuivel" } });
    expect(aisleField()).toHaveValue("aisle-zuivel");
    expect(fileGroceryName).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("action-save"));

    expect(onSave).toHaveBeenCalled();
    expect(fileGroceryName).toHaveBeenCalledExactlyOnceWith(
      "store-c",
      { name: "cola", ingredientId: "i-cola" },
      "aisle-zuivel"
    );
  });

  it("leaves a name the shopper did not re-file exactly as the Store remembered it", () => {
    render(
      <EditGroceryPanel
        grocery={{ ...GROCERY, storeId: "store-c" } as GroceryDto}
        open={true}
        recurringGrocery={null}
        stores={STORES}
        onDelete={() => undefined}
        onOpenChange={() => undefined}
        onSave={() => undefined}
      />
    );

    // Chosen, then chosen back: what the Store remembered, so nothing to write.
    fireEvent.change(aisleField()!, { target: { value: "aisle-zuivel" } });
    fireEvent.change(aisleField()!, { target: { value: "aisle-frisdrank" } });
    fireEvent.click(screen.getByTestId("action-save"));

    expect(fileGroceryName).not.toHaveBeenCalled();
  });

  it("drops a choice when the Store is swapped, and one from a panel closed without adding", () => {
    const { rerender } = render(
      <EditGroceryPanel
        grocery={{ ...GROCERY, storeId: "store-c" } as GroceryDto}
        open={true}
        recurringGrocery={null}
        stores={STORES}
        onDelete={() => undefined}
        onOpenChange={() => undefined}
        onSave={() => undefined}
      />
    );

    // Chosen at Store C, then away to Store A and back: Store C's own memory,
    // not the choice, is what the field reads.
    fireEvent.change(aisleField()!, { target: { value: "aisle-zuivel" } });
    fireEvent.change(screen.getByTestId("store-selector"), { target: { value: "store-a" } });
    fireEvent.change(screen.getByTestId("store-selector"), { target: { value: "store-c" } });
    expect(aisleField()).toHaveValue("aisle-frisdrank");
    fireEvent.click(screen.getByTestId("action-save"));
    expect(fileGroceryName).not.toHaveBeenCalled();

    // The add panel stays mounted between openings: a choice made and then
    // abandoned with Close must not surface for the next name.
    rerender(
      <AddGroceryPanel
        open={true}
        stores={STORES}
        onCreate={() => undefined}
        onCreateRecurring={() => undefined}
        onOpenChange={() => undefined}
      />
    );
    fireEvent.change(screen.getByPlaceholderText("placeholder"), { target: { value: "melk" } });
    fireEvent.change(screen.getByTestId("store-selector"), { target: { value: "store-c" } });
    fireEvent.change(aisleField()!, { target: { value: "aisle-zuivel" } });
    rerender(
      <AddGroceryPanel
        open={false}
        stores={STORES}
        onCreate={() => undefined}
        onCreateRecurring={() => undefined}
        onOpenChange={() => undefined}
      />
    );
    rerender(
      <AddGroceryPanel
        open={true}
        stores={STORES}
        onCreate={() => undefined}
        onCreateRecurring={() => undefined}
        onOpenChange={() => undefined}
      />
    );
    fireEvent.change(screen.getByPlaceholderText("placeholder"), { target: { value: "kaas" } });
    fireEvent.change(screen.getByTestId("store-selector"), { target: { value: "store-c" } });
    expect(aisleField()).toHaveValue("none");
    fireEvent.click(screen.getByRole("button", { name: "add" }));
    expect(fileGroceryName).not.toHaveBeenCalled();
  });

  it("files a new name from the panel that adds it, and forgets one with No aisle", () => {
    render(
      <AddGroceryPanel
        open={true}
        stores={STORES}
        onCreate={() => undefined}
        onCreateRecurring={() => undefined}
        onOpenChange={() => undefined}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("placeholder"), { target: { value: "melk" } });
    fireEvent.change(screen.getByTestId("store-selector"), { target: { value: "store-c" } });
    settle();
    expect(aisleField()).toHaveValue("none");

    fireEvent.change(aisleField()!, { target: { value: "aisle-zuivel" } });
    fireEvent.click(screen.getByRole("button", { name: "add" }));

    expect(fileGroceryName).toHaveBeenCalledExactlyOnceWith(
      "store-c",
      { name: "melk", ingredientId: "i-melk" },
      "aisle-zuivel"
    );

    // The next grocery, a name the Store files already — its Ingredient asked
    // for once the typing stops: "No aisle" forgets it.
    fireEvent.change(screen.getByPlaceholderText("placeholder"), { target: { value: "cola" } });
    settle();
    expect(aisleField()).toHaveValue("aisle-frisdrank");
    fireEvent.change(aisleField()!, { target: { value: "none" } });
    fireEvent.click(screen.getByRole("button", { name: "add" }));

    expect(fileGroceryName).toHaveBeenLastCalledWith(
      "store-c",
      { name: "cola", ingredientId: "i-cola" },
      null
    );
  });
});

describe("EditGroceryPanel, on a grocery the Store is still being asked about", () => {
  it("waits on the Pending Link rather than asking the shop itself", () => {
    ASKED_ON_THE_LIST.add("store-a|i-beleg");
    render(
      <EditGroceryPanel
        grocery={{ ...GROCERY, name: "beleg", ingredientId: "i-beleg" } as GroceryDto}
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
    // neither searches the shop for the name nor fills a price in; the price
    // fields stand empty, ready for one the shopper types.
    expect(screen.queryByTestId("product-searching")).not.toBeInTheDocument();
    expect(screen.getByTestId("product-by-hand-price")).toHaveValue("");
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

    expect(row).toHaveTextContent(/€.+ · 1 L/);
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
    expect(screen.getByTestId("product-by-hand-price")).toHaveValue("");
  });
});
