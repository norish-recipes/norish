/**
 * The grocery panel's product field: what it asks the shop about, and what it
 * says while it is asking.
 */
import type { ReactNode } from "react";
import { GroceryProductField } from "@/components/groceries/grocery-product-field";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import type { StoreDto, StoreProductDto } from "@norish/shared/contracts";
import { readPackSize } from "@norish/shared/lib/pack-size";

interface SearchCall {
  storeId: string | null;
  term: string;
  enabled: boolean;
}

vi.mock("@/hooks/config/use-units-query", () => ({
  useUnitsQuery: () => ({ units: {} }),
}));

const searchCalls: SearchCall[] = [];

/** A shop that has been asked and has not answered yet. */
const SEARCH_IS_SLOW = { current: false };
/** A shop that is down, or turned the visit away: it answered nothing at all. */
const SHOP_IS_DOWN = { current: false };

/** What the shop answers: whatever shares a word with the term. */
const SHOP: Record<
  string,
  {
    name: string;
    url: string;
    price: number;
    size: string;
    regularPrice?: number;
    dealWords?: string;
  }[]
> = {
  "store-a": [
    { name: "Coca-Cola 1 L", url: "https://a.example/p/cola-1l", price: 1.99, size: "1 L" },
    { name: "Cola Zero 1,5 L", url: "https://a.example/p/cola-zero", price: 2.29, size: "1,5 L" },
    {
      name: "Fanta 1 L",
      url: "https://a.example/p/fanta",
      price: 1.49,
      size: "1 L",
      regularPrice: 1.99,
      dealWords: "ACTIE",
    },
    { name: "Fanta Orange 1 L", url: "https://a.example/p/fanta-orange", price: 1.99, size: "1 L" },
  ],
  "store-b": [{ name: "Cola B 1 L", url: "https://b.example/p/cola-1l", price: 1.49, size: "1 L" }],
};

function answer(storeId: string | null, term: string) {
  const words = term
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

  return (SHOP[storeId ?? ""] ?? []).filter((candidate) =>
    words.some((word) => candidate.name.toLowerCase().includes(word))
  );
}

/** What each Store has already stored, which the field shows without asking. */
const KNOWN: Record<string, StoreProductDto[]> = { "store-a": [], "store-b": [] };

// react-query's own semantics: a disabled query never leaves `pending`.
vi.mock("@/hooks/stores", () => ({
  useShopSearch: (storeId: string | null, term: string, enabled: boolean) => {
    searchCalls.push({ storeId, term, enabled });
    const on = enabled && Boolean(storeId) && term.trim().length > 0;

    if (!on) return { data: undefined, isPending: true, isFetching: false };
    if (SEARCH_IS_SLOW.current) return { data: undefined, isPending: true, isFetching: true };
    if (SHOP_IS_DOWN.current) {
      return { data: { candidates: [], answered: false }, isPending: false, isFetching: false };
    }

    return {
      data: {
        candidates: answer(storeId, term).map((candidate) => ({
          name: candidate.name,
          url: candidate.url,
          price: candidate.price,
          currency: "EUR",
          size: candidate.size,
          pack: readPackSize(candidate.size) ?? undefined,
          regularPrice: candidate.regularPrice,
          dealWords: candidate.dealWords,
        })),
        answered: true,
      },
      isPending: false,
      isFetching: false,
    };
  },
  useStoreProducts: (storeId: string | null, enabled: boolean) => ({
    data: enabled ? (KNOWN[storeId ?? ""] ?? []) : undefined,
    isPending: !enabled,
    isFetching: false,
  }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key} ${Object.values(params).join(" ")}` : key,
  useLocale: () => "en",
}));

vi.mock("@/components/Panel/Panel", () => {
  // The details panel is a nested Panel; here it is always open, so the
  // fields behind it are reachable without a tap.
  const Panel = ({ children }: { children: ReactNode }) => <div>{children}</div>;

  Panel.Body = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  Panel.Footer = ({ children }: { children: ReactNode }) => <div>{children}</div>;

  return { usePanelPortalContainer: () => undefined, default: Panel };
});

function store(id: string, name: string, searchAddress: string | null): StoreDto {
  return {
    id,
    name,
    color: "blue",
    sortOrder: 0,
    website: `https://${id}.example`,
    searchAddress,
    aisles: [],
  } as unknown as StoreDto;
}

const STORE_A = store("store-a", "Store A", "https://a.example/search?q={query}");
const STORE_B = store("store-b", "Store B", "https://b.example/search?q={query}");
/** A Store with a shop link Norish could not make a search out of. */
const UNREADABLE = store("store-c", "Store C", null);
/** An ordinary Store: a heading, and no shop behind it at all. */
const NO_SHOP = { ...store("store-d", "Store D", null), website: null } as StoreDto;

function product(id: string, storeId: string, name: string, price: number): StoreProductDto {
  return {
    id,
    storeId,
    name,
    pageUrl: `https://${storeId}.example/p/${id}`,
    price,
    currency: "EUR",
    size: "1 L",
    packQuantity: 1,
    packUnit: "liter",
    packByWeight: false,
    packByHand: false,
    regularPrice: null,
    dealWords: null,
    pricedAt: new Date("2026-09-01T00:00:00Z"),
  } as unknown as StoreProductDto;
}

/** The term the field last actually asked a shop about. */
function lastAskedTerm(): string | null {
  return (
    searchCalls.filter((call) => call.enabled && call.term.trim().length > 0).at(-1)?.term ?? null
  );
}

function field(): HTMLElement {
  return screen.getByTestId("grocery-product-field");
}

function options(): string[] {
  return screen.queryAllByTestId("product-option").map((node) => node.textContent ?? "");
}

beforeEach(() => {
  searchCalls.length = 0;
  KNOWN["store-a"] = [];
  KNOWN["store-b"] = [];
  SHOP_IS_DOWN.current = false;
});

describe("GroceryProductField", () => {
  it("asks the shop about the grocery's own name when the name arrived after the field", () => {
    vi.useFakeTimers();
    try {
      // The add panel mounts this field the moment a Store is picked, which for
      // a batch add is before the shopper has typed the grocery's name.
      const { rerender } = render(
        <GroceryProductField
          choice={null}
          groceryName=""
          linkedProduct={null}
          store={STORE_A}
          onChoice={() => undefined}
        />
      );

      rerender(
        <GroceryProductField
          choice={null}
          groceryName="cola"
          linkedProduct={null}
          store={STORE_A}
          onChoice={() => undefined}
        />
      );

      act(() => {
        field().focus();
      });
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(lastAskedTerm()).toBe("cola");
      expect(screen.queryByTestId("product-searching")).not.toBeInTheDocument();
      expect(options()).toContain("Coca-Cola 1 L€1.99 · 1 L");
    } finally {
      vi.useRealTimers();
    }
  });

  it("asks the shop once the grocery's name stops being typed, not once per letter", () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(
        <GroceryProductField
          choice={null}
          groceryName=""
          linkedProduct={null}
          store={STORE_A}
          onChoice={() => undefined}
        />
      );

      act(() => {
        field().focus();
      });
      for (const partial of ["c", "co", "col", "cola"]) {
        rerender(
          <GroceryProductField
            choice={null}
            groceryName={partial}
            linkedProduct={null}
            store={STORE_A}
            onChoice={() => undefined}
          />
        );
        act(() => {
          vi.advanceTimersByTime(100);
        });
      }

      // Mid-word the shop has not been asked about anything.
      expect(lastAskedTerm()).toBeNull();

      act(() => {
        vi.advanceTimersByTime(500);
      });

      const asked = new Set(
        searchCalls.filter((call) => call.enabled && call.term.length > 0).map((call) => call.term)
      );

      expect([...asked]).toEqual(["cola"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("neither asks the shop nor takes a product while the grocery's link is still being read", () => {
    vi.useFakeTimers();
    try {
      const onChoice = vi.fn();
      const { rerender } = render(
        <GroceryProductField
          choice={null}
          groceryName="Cola B 1 L"
          linkPending
          linkedProduct={null}
          store={STORE_B}
          onChoice={onChoice}
        />
      );

      act(() => {
        field().focus();
      });
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // "Nothing linked" is not an answer yet, so it is not acted on: the name
      // may well turn out to be linked already.
      expect(lastAskedTerm()).toBeNull();
      expect(onChoice).not.toHaveBeenCalled();

      // The link arrives: the grocery was linked all along, and stays so.
      const linked = product("prod-b", "store-b", "Cola B 1 L", 1.49);

      rerender(
        <GroceryProductField
          choice={null}
          groceryName="Cola B 1 L"
          linkPending={false}
          linkedProduct={linked}
          store={STORE_B}
          onChoice={onChoice}
        />
      );
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(lastAskedTerm()).toBeNull();
      expect(onChoice).not.toHaveBeenCalled();
      expect(field()).toHaveValue("Cola B 1 L");
    } finally {
      vi.useRealTimers();
    }
  });

  it("lets go of a product it took for the grocery's name when the name moves on", () => {
    vi.useFakeTimers();
    try {
      const onChoice = vi.fn();
      const { rerender } = render(
        <GroceryProductField
          choice={null}
          groceryName="Cola B 1 L"
          linkedProduct={null}
          store={STORE_B}
          onChoice={onChoice}
        />
      );

      act(() => {
        field().focus();
      });
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(onChoice).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "candidate" }));
      expect(field()).toHaveValue("Cola B 1 L");

      // The shopper goes on typing the grocery's name. The field's own answer
      // was to a question that is no longer being asked, so it is let go —
      // Save must not link "Cola B 1 L extra" to a product taken for "Cola B 1 L".
      rerender(
        <GroceryProductField
          choice={null}
          groceryName="Cola B 1 L extra"
          linkedProduct={null}
          store={STORE_B}
          onChoice={onChoice}
        />
      );

      expect(onChoice).toHaveBeenLastCalledWith(null);
      expect(field()).toHaveValue("");
      expect(screen.getByTestId("product-by-hand-price")).toHaveValue("");
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps a product the shopper tapped when the grocery's name moves on", async () => {
    const onChoice = vi.fn();
    const { rerender } = render(
      <GroceryProductField
        choice={null}
        groceryName="cola"
        linkedProduct={null}
        store={STORE_A}
        onChoice={onChoice}
      />
    );

    await act(async () => {
      field().focus();
    });

    const picked = screen
      .getAllByTestId("product-option")
      .find((node) => node.textContent?.includes("Cola Zero"));

    await act(async () => {
      fireEvent.click(picked as HTMLElement);
    });

    rerender(
      <GroceryProductField
        choice={null}
        groceryName="cola zero"
        linkedProduct={null}
        store={STORE_A}
        onChoice={onChoice}
      />
    );

    // A tap is the shopper's own answer, and a renamed grocery does not undo it.
    expect(onChoice).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "candidate" }));
    expect(field()).toHaveValue("Cola Zero 1,5 L");
  });

  it("stops saying it is searching once there is nothing to search for", async () => {
    render(
      <GroceryProductField
        choice={null}
        groceryName=""
        linkedProduct={null}
        store={STORE_A}
        onChoice={() => undefined}
      />
    );

    await act(async () => {
      field().focus();
    });

    expect(screen.queryByTestId("product-searching")).not.toBeInTheDocument();
    // The price fields are there all the same, empty: a shopper never waits
    // on a shop to type what they saw on the shelf.
    expect(screen.getByTestId("product-by-hand")).toBeInTheDocument();
    expect(screen.getByTestId("product-by-hand-price")).toHaveValue("");
  });

  it("says nothing was found only once the shop has actually answered nothing", async () => {
    render(
      <GroceryProductField
        choice={null}
        groceryName="ansjovis"
        linkedProduct={null}
        store={STORE_A}
        onChoice={() => undefined}
      />
    );

    await act(async () => {
      field().focus();
    });

    expect(lastAskedTerm()).toBe("ansjovis");
    expect(screen.getByTestId("product-by-hand")).toBeInTheDocument();
  });

  it("says a shop that did not answer did not answer, rather than that it has nothing", async () => {
    SHOP_IS_DOWN.current = true;
    render(
      <GroceryProductField
        choice={null}
        groceryName="cola"
        linkedProduct={null}
        store={STORE_A}
        onChoice={() => undefined}
      />
    );

    await act(async () => {
      field().focus();
    });

    // A shop that is down has not said it stocks no cola.
    expect(screen.getByTestId("product-no-answer")).toBeInTheDocument();
    expect(screen.queryByText(/nothingFound/)).not.toBeInTheDocument();
    // The shopper can still type what they saw on the shelf.
    expect(screen.getByTestId("product-by-hand-price")).toBeInTheDocument();
  });

  it("keeps the row that was picked when a typed price is deleted again", async () => {
    const onChoice = vi.fn();

    render(
      <GroceryProductField
        choice={null}
        groceryName="cola"
        linkedProduct={null}
        store={STORE_A}
        onChoice={onChoice}
      />
    );

    await act(async () => {
      field().focus();
    });
    const picked = screen
      .getAllByTestId("product-option")
      .find((node) => node.textContent?.includes("Cola Zero"));

    await act(async () => {
      fireEvent.click(picked as HTMLElement);
    });
    await act(async () => {
      fireEvent.change(screen.getByTestId("product-by-hand-price"), { target: { value: "1,99" } });
    });
    expect(onChoice).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "manual" }));

    await act(async () => {
      fireEvent.change(screen.getByTestId("product-by-hand-price"), { target: { value: "" } });
    });

    // The row still reads as picked, so the pick is what Save writes.
    expect(onChoice).toHaveBeenLastCalledWith(
      expect.objectContaining({
        kind: "candidate",
        candidate: expect.objectContaining({ name: "Cola Zero 1,5 L" }),
      })
    );
  });

  it("does not carry the last product's price into a name that has none", () => {
    vi.useFakeTimers();
    try {
      const linked = product("prod-a", "store-a", "Coca-Cola 1 L", 1.99);
      const { rerender } = render(
        <GroceryProductField
          choice={null}
          groceryName="cola"
          linkedProduct={linked}
          store={STORE_A}
          onChoice={() => undefined}
        />
      );

      expect(screen.getByTestId("product-by-hand-price")).toHaveValue("1.99");

      // Renamed to something the Store knows nothing about: the fields, when
      // they show again, must not be prefilled with cola's price.
      rerender(
        <GroceryProductField
          choice={null}
          groceryName="ansjovis"
          linkedProduct={null}
          store={STORE_A}
          onChoice={() => undefined}
        />
      );
      act(() => {
        field().focus();
      });
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(screen.getByTestId("product-by-hand-name")).toHaveValue("ansjovis");
      expect(screen.getByTestId("product-by-hand-price")).toHaveValue("");
    } finally {
      vi.useRealTimers();
    }
  });

  it("reads the new Store's own linked product when the Store is swapped", () => {
    const linkedAtA = product("prod-a", "store-a", "Coca-Cola 1 L", 1.99);
    const linkedAtB = product("prod-b", "store-b", "Cola B 1 L", 1.49);

    KNOWN["store-a"] = [linkedAtA];
    KNOWN["store-b"] = [linkedAtB];

    const { rerender } = render(
      <GroceryProductField
        choice={null}
        groceryName="cola"
        linkedProduct={linkedAtA}
        store={STORE_A}
        onChoice={() => undefined}
      />
    );

    expect(field()).toHaveValue("Coca-Cola 1 L");

    rerender(
      <GroceryProductField
        choice={null}
        groceryName="cola"
        linkedProduct={linkedAtB}
        store={STORE_B}
        onChoice={() => undefined}
      />
    );

    expect(field()).toHaveValue("Cola B 1 L");
    expect(screen.getByTestId("product-by-hand-price")).toHaveValue("1.49");
  });

  it("takes the one product a shopper would not hesitate over, without being asked", async () => {
    const chosen: unknown[] = [];

    render(
      <GroceryProductField
        choice={null}
        groceryName="Cola B 1 L"
        linkedProduct={null}
        store={STORE_B}
        onChoice={(choice) => chosen.push(choice)}
      />
    );

    await act(async () => {
      field().focus();
    });

    expect(chosen).toEqual([
      {
        kind: "candidate",
        candidate: {
          name: "Cola B 1 L",
          url: "https://b.example/p/cola-1l",
          price: 1.49,
          currency: "EUR",
          size: "1 L",
          pack: { quantity: 1, unit: "liter", byWeight: false },
        },
      },
    ]);
    expect(field()).toHaveValue("Cola B 1 L");
    expect(screen.getByTestId("product-by-hand-price")).toHaveValue("1.49");
  });

  it("takes the one product a typed term found, and does not ask the shop about it again", () => {
    vi.useFakeTimers();
    try {
      const onChoice = vi.fn();

      render(
        <GroceryProductField
          choice={null}
          groceryName="cola"
          linkedProduct={null}
          store={STORE_A}
          onChoice={onChoice}
        />
      );

      act(() => {
        field().focus();
      });
      // Two colas answer "cola", so nothing has been chosen yet.
      expect(onChoice).not.toHaveBeenCalled();

      // The product's own name, one letter slipped: near enough to be it.
      act(() => {
        fireEvent.change(field(), { target: { value: "Cola Zero 1,5L" } });
      });
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(onChoice).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "candidate",
          candidate: expect.objectContaining({ name: "Cola Zero 1,5 L" }),
        })
      );
      expect(field()).toHaveValue("Cola Zero 1,5 L");

      // The name it wrote into the box is that answer, not a new question:
      // the shop is not visited again for the product it has just chosen.
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(lastAskedTerm()).toBe("Cola Zero 1,5L");
    } finally {
      vi.useRealTimers();
    }
  });

  it("chooses nothing where two of the shop's products answer equally well", async () => {
    const chosen: unknown[] = [];

    render(
      <GroceryProductField
        choice={null}
        groceryName="cola"
        linkedProduct={null}
        store={STORE_A}
        onChoice={(choice) => chosen.push(choice)}
      />
    );

    await act(async () => {
      field().focus();
    });

    expect(options()).toHaveLength(2);
    expect(chosen).toEqual([]);
    expect(field()).toHaveValue("");
  });

  // AH lists one loaf under two product numbers: the same name, the same
  // price, two addresses. That is one row.
  it("offers a product the shop lists under two addresses once", async () => {
    SHOP["store-a"]?.push({
      name: "Coca-Cola 1 L",
      url: "https://a.example/p/cola-1l-again",
      price: 1.99,
      size: "1 L",
    });
    try {
      render(
        <GroceryProductField
          choice={null}
          groceryName="cola"
          linkedProduct={null}
          store={STORE_A}
          onChoice={() => undefined}
        />
      );

      await act(async () => {
        field().focus();
      });

      // Two colas, not three: nothing is taken, and the twin is not offered.
      expect(options()).toHaveLength(2);
      expect(options().filter((row) => row.includes("Coca-Cola 1 L"))).toHaveLength(1);
    } finally {
      SHOP["store-a"]?.pop();
    }
  });

  it("takes the first of several products carrying exactly the grocery's name", async () => {
    const chosen: unknown[] = [];

    // The same cola again at another price: the name is the grocery's to the
    // letter, so the shopper has chosen, and the shop's first listing is it.
    SHOP["store-a"]?.push({
      name: "Coca-Cola 1 L",
      url: "https://a.example/p/cola-1l-promo",
      price: 1.79,
      size: "1 L",
    });
    try {
      render(
        <GroceryProductField
          choice={null}
          groceryName="Coca-Cola 1 L"
          linkedProduct={null}
          store={STORE_A}
          onChoice={(choice) => chosen.push(choice)}
        />
      );

      await act(async () => {
        field().focus();
      });

      expect(chosen).toEqual([
        expect.objectContaining({
          kind: "candidate",
          candidate: expect.objectContaining({ url: "https://a.example/p/cola-1l", price: 1.99 }),
        }),
      ]);
      expect(field()).toHaveValue("Coca-Cola 1 L");
    } finally {
      SHOP["store-a"]?.pop();
    }
  });

  it("takes a product the shop lists under two addresses, by its first address", async () => {
    const chosen: unknown[] = [];

    SHOP["store-b"]?.push({
      name: "Cola B 1 L",
      url: "https://b.example/p/cola-1l-again",
      price: 1.49,
      size: "1 L",
    });
    try {
      render(
        <GroceryProductField
          choice={null}
          groceryName="Cola B 1 L"
          linkedProduct={null}
          store={STORE_B}
          onChoice={(choice) => chosen.push(choice)}
        />
      );

      await act(async () => {
        field().focus();
      });

      expect(chosen).toEqual([
        expect.objectContaining({
          kind: "candidate",
          candidate: expect.objectContaining({ url: "https://b.example/p/cola-1l" }),
        }),
      ]);
      expect(field()).toHaveValue("Cola B 1 L");
    } finally {
      SHOP["store-b"]?.pop();
    }
  });

  it("takes the Store's own copy of a product over the shop's twin of it", async () => {
    const chosen: unknown[] = [];

    // Stored from an earlier visit, under an address the shop is not
    // answering with today. It is what a link can point at, so it is the row.
    KNOWN["store-b"] = [product("known-cola-b", "store-b", "Cola B 1 L", 1.49)];

    render(
      <GroceryProductField
        choice={null}
        groceryName="Cola B 1 L"
        linkedProduct={null}
        store={STORE_B}
        onChoice={(choice) => chosen.push(choice)}
      />
    );

    await act(async () => {
      field().focus();
    });

    expect(chosen).toEqual([{ kind: "product", storeProductId: "known-cola-b" }]);
    expect(field()).toHaveValue("Cola B 1 L");
  });

  it("leaves a grocery that is already linked exactly as it is", async () => {
    const linked = product("prod-b", "store-b", "Cola B 1 L", 1.49);
    const chosen: unknown[] = [];

    KNOWN["store-b"] = [linked];

    render(
      <GroceryProductField
        choice={null}
        groceryName="Cola B 1 L"
        linkedProduct={linked}
        store={STORE_B}
        onChoice={(choice) => chosen.push(choice)}
      />
    );

    await act(async () => {
      field().focus();
    });

    expect(chosen).toEqual([]);
    expect(field()).toHaveValue("Cola B 1 L");
  });

  it("is not there at all for a Store with no shop behind it", () => {
    const { container } = render(
      <GroceryProductField
        choice={null}
        groceryName="cola"
        linkedProduct={null}
        store={NO_SHOP}
        onChoice={() => undefined}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("cannot be typed in for a shop Norish cannot read, but a price can", async () => {
    const onChoice = vi.fn();

    render(
      <GroceryProductField
        choice={null}
        groceryName="cola"
        linkedProduct={null}
        store={UNREADABLE}
        onChoice={onChoice}
      />
    );

    expect(field()).toBeDisabled();
    expect(searchCalls.every((call) => !call.enabled)).toBe(true);
    // And it says why, rather than leaving a dead field to be puzzled over.
    expect(screen.getByTestId("product-cannot-search")).toBeInTheDocument();

    // An unreadable shop costs the shopper a price, not the feature: the
    // fields to type one are there, prefilled with the grocery's name.
    expect(screen.getByTestId("product-by-hand-name")).toHaveValue("cola");
    await act(async () => {
      fireEvent.change(screen.getByTestId("product-by-hand-price"), { target: { value: "1.79" } });
    });

    expect(onChoice).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: "manual", name: "cola", price: 1.79 })
    );
  });

  it("corrects the by-hand product the grocery is linked to rather than making another", async () => {
    const onChoice = vi.fn();
    const typedBefore = {
      ...product("manual-1", "store-a", "Cola from the market", 1.5),
      pageUrl: null,
      isManual: true,
    } as unknown as StoreProductDto;

    render(
      <GroceryProductField
        choice={null}
        groceryName="cola"
        linkedProduct={typedBefore}
        store={STORE_A}
        onChoice={onChoice}
      />
    );

    await act(async () => {
      fireEvent.change(screen.getByTestId("product-by-hand-price"), { target: { value: "1.65" } });
    });

    // The same product, corrected: without this every correction added a new
    // by-hand product, and two identical names made the unmistakable rule
    // refuse both.
    expect(onChoice).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: "manual", id: "manual-1", price: 1.65 })
    );
  });

  it("never edits a product read from a page by hand; a typed price is a new product", async () => {
    const onChoice = vi.fn();
    const read = product("read-1", "store-a", "Coca-Cola 1 L", 1.99);

    render(
      <GroceryProductField
        choice={null}
        groceryName="cola"
        linkedProduct={read}
        store={STORE_A}
        onChoice={onChoice}
      />
    );

    await act(async () => {
      fireEvent.change(screen.getByTestId("product-by-hand-price"), { target: { value: "1.65" } });
    });

    const choice = onChoice.mock.lastCall?.[0] as { kind: string; id?: string };

    expect(choice.kind).toBe("manual");
    expect(choice.id).not.toBe("read-1");
  });

  it("offers the Store's own products for the term, and not its whole shelf", async () => {
    KNOWN["store-a"] = [
      product("known-cola", "store-a", "Cola Light 1 L", 1.89),
      product("known-kaas", "store-a", "Oude kaas 500 g", 4.99),
    ];

    render(
      <GroceryProductField
        choice={null}
        groceryName="cola"
        linkedProduct={null}
        store={STORE_A}
        onChoice={() => undefined}
      />
    );

    await act(async () => {
      field().focus();
    });

    const offered = options().join("|");

    expect(offered).toContain("Cola Light 1 L");
    expect(offered).toContain("Coca-Cola 1 L");
    expect(offered).not.toContain("Oude kaas");
  });

  it("does not answer a question with a product that only shares a size", async () => {
    KNOWN["store-a"] = [product("known-melk", "store-a", "Halfvolle melk 1 L", 1.29)];

    render(
      <GroceryProductField
        choice={null}
        groceryName="cola"
        linkedProduct={null}
        store={STORE_A}
        onChoice={() => undefined}
      />
    );

    await act(async () => {
      field().focus();
    });

    // "cola" and "Halfvolle melk 1 L" share the letter l and nothing else.
    expect(options().join("|")).not.toContain("Halfvolle melk");
  });

  it("says which rows the Store already knew and which the shop just answered", async () => {
    KNOWN["store-a"] = [product("known-cola", "store-a", "Cola Light 1 L", 1.89)];

    render(
      <GroceryProductField
        choice={null}
        groceryName="cola"
        linkedProduct={null}
        store={STORE_A}
        onChoice={() => undefined}
      />
    );

    await act(async () => {
      field().focus();
    });

    expect(screen.getByTestId("product-group-known")).toBeInTheDocument();
    expect(screen.getByTestId("product-group-shop")).toBeInTheDocument();
  });

  it("says the shop is being read in the dropdown, where the rows will land", async () => {
    render(
      <GroceryProductField
        choice={null}
        groceryName="cola"
        linkedProduct={null}
        store={STORE_A}
        onChoice={() => undefined}
      />
    );

    // The shop has been asked and has not answered yet: AH takes its time, and
    // the dropdown is where the shopper is looking.
    SEARCH_IS_SLOW.current = true;
    await act(async () => {
      field().focus();
    });

    expect(screen.getByTestId("product-group-shop")).toHaveTextContent("searching");
    SEARCH_IS_SLOW.current = false;
  });

  it("fills the price fields from the product that was picked", async () => {
    const onChoice = vi.fn();

    render(
      <GroceryProductField
        choice={null}
        groceryName="cola"
        linkedProduct={null}
        store={STORE_A}
        onChoice={onChoice}
      />
    );

    await act(async () => {
      field().focus();
    });

    const picked = screen
      .getAllByTestId("product-option")
      .find((node) => node.textContent?.includes("Cola Zero"));

    await act(async () => {
      fireEvent.click(picked as HTMLElement);
    });

    expect(onChoice).toHaveBeenCalledWith(expect.objectContaining({ kind: "candidate" }));
    expect(screen.getByTestId("product-by-hand-price")).toHaveValue("2.29");
    expect(screen.getByTestId("product-by-hand-name")).toHaveValue("Cola Zero 1,5 L");
  });

  it("turns a price typed over the shop's own into the shopper's price", async () => {
    const onChoice = vi.fn();

    render(
      <GroceryProductField
        choice={null}
        groceryName="cola"
        linkedProduct={null}
        store={STORE_A}
        onChoice={onChoice}
      />
    );

    await act(async () => {
      field().focus();
    });

    const picked = screen
      .getAllByTestId("product-option")
      .find((node) => node.textContent?.includes("Cola Zero"));

    await act(async () => {
      fireEvent.click(picked as HTMLElement);
    });
    await act(async () => {
      fireEvent.change(screen.getByTestId("product-by-hand-price"), { target: { value: "1,99" } });
    });

    expect(onChoice).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: "manual", price: 1.99, name: "Cola Zero 1,5 L" })
    );
    // The row stays picked: the shopper corrected a price, they did not
    // un-choose the product.
    expect(field()).toHaveValue("Cola Zero 1,5 L");
  });

  it("asks the shop about what was typed once the typing stops", async () => {
    vi.useFakeTimers();
    try {
      render(
        <GroceryProductField
          choice={null}
          groceryName="cola"
          linkedProduct={null}
          store={STORE_A}
          onChoice={() => undefined}
        />
      );

      act(() => {
        field().focus();
      });
      act(() => {
        fireEvent.change(field(), { target: { value: "zero" } });
      });

      // Mid-keystroke the shop is not asked about a half-typed word.
      expect(lastAskedTerm()).toBe("cola");

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(lastAskedTerm()).toBe("zero");
    } finally {
      vi.useRealTimers();
    }
  });

  describe("a Sale in the dropdown", () => {
    it("shows the badge, the struck pack price and the shop's words on a result on Sale", async () => {
      render(
        <GroceryProductField
          choice={null}
          groceryName="fanta"
          linkedProduct={null}
          store={STORE_A}
          onChoice={() => undefined}
        />
      );

      await act(async () => {
        field().focus();
      });

      // Two products answer "fanta", so the shopper chooses; the row on Sale
      // reads as the shop presents it.
      const fanta = screen
        .getAllByTestId("product-option")
        .find((node) => node.textContent?.startsWith("Fanta 1 L"));

      expect(fanta).toBeDefined();
      expect(fanta?.querySelector("[data-testid='product-option-regular']")).toHaveTextContent(
        "€1.99"
      );
      // Said for a reader who cannot see the strike, as on the row.
      expect(fanta?.querySelector("[data-testid='product-option-regular']")).toHaveAttribute(
        "aria-label",
        "regularPrice €1.99"
      );
      // The Sale price reads like any other, the shop's words its title; the pack follows.
      const price = fanta?.querySelector("[data-testid='product-option-sale']");

      expect(price).toHaveTextContent(/^€1\.49$/);
      expect(price).toHaveAttribute("title", "ACTIE");
      expect(fanta).toHaveTextContent("€1.99 €1.49 · 1 L");
    });
  });

  describe("the shop's own page for the product", () => {
    it("opens it for the product shown, and not for one typed by hand", async () => {
      const read = {
        ...product("read-1", "store-a", "Coca-Cola 1 L", 1.99),
        pageUrl: "https://a.example/p/cola-1l",
      } as StoreProductDto;
      const linked = render(
        <GroceryProductField
          choice={null}
          groceryName="cola"
          linkedProduct={read}
          store={STORE_A}
          onChoice={() => undefined}
        />
      );

      // The linked product's page, in a new tab: the shop's site is not Norish.
      const link = screen.getByTestId("product-page-link");

      expect(link).toHaveAttribute("href", "https://a.example/p/cola-1l");
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveTextContent("openPage Store A");
      linked.unmount();

      // A result of the shop's own search has a page too, before it is stored.
      const unlinked = render(
        <GroceryProductField
          choice={null}
          groceryName="cola"
          linkedProduct={null}
          store={STORE_A}
          onChoice={() => undefined}
        />
      );

      expect(screen.queryByTestId("product-page-link")).not.toBeInTheDocument();
      await act(async () => {
        field().focus();
      });
      const zero = screen
        .getAllByTestId("product-option")
        .find((node) => node.textContent?.includes("Cola Zero"));

      await act(async () => {
        fireEvent.click(zero as HTMLElement);
      });
      expect(screen.getByTestId("product-page-link")).toHaveAttribute(
        "href",
        "https://a.example/p/cola-zero"
      );
      unlinked.unmount();

      // A product typed by hand has no page anywhere.
      const byHand = { ...read, id: "manual-1", pageUrl: null, isManual: true } as StoreProductDto;

      render(
        <GroceryProductField
          choice={null}
          groceryName="cola"
          linkedProduct={byHand}
          store={STORE_A}
          onChoice={() => undefined}
        />
      );
      expect(screen.queryByTestId("product-page-link")).not.toBeInTheDocument();
    });
  });

  describe("what is typed by hand", () => {
    it("says a price that is not a price is not one, and tells the panel so", () => {
      const onValidityChange = vi.fn();

      render(
        <GroceryProductField
          choice={null}
          groceryName="cola"
          linkedProduct={product("prod-a", "store-a", "Coca-Cola 1 L", 1.99)}
          store={STORE_A}
          onChoice={() => undefined}
          onValidityChange={onValidityChange}
        />
      );

      expect(onValidityChange).toHaveBeenLastCalledWith(true);
      expect(screen.queryByTestId("product-price-error")).not.toBeInTheDocument();

      fireEvent.change(screen.getByTestId("product-by-hand-price"), { target: { value: "1.9.9" } });
      expect(screen.getByTestId("product-price-error")).toHaveTextContent("invalidPrice");
      expect(onValidityChange).toHaveBeenLastCalledWith(false);

      fireEvent.change(screen.getByTestId("product-by-hand-price"), { target: { value: "-2" } });
      expect(screen.getByTestId("product-price-error")).toBeInTheDocument();

      fireEvent.change(screen.getByTestId("product-by-hand-price"), { target: { value: "2,49" } });
      expect(screen.queryByTestId("product-price-error")).not.toBeInTheDocument();
      expect(onValidityChange).toHaveBeenLastCalledWith(true);
    });

    it("wants three letters for a currency", () => {
      const onValidityChange = vi.fn();
      const onChoice = vi.fn();

      render(
        <GroceryProductField
          choice={null}
          groceryName="cola"
          linkedProduct={product("prod-a", "store-a", "Coca-Cola 1 L", 1.99)}
          store={STORE_A}
          onChoice={onChoice}
          onValidityChange={onValidityChange}
        />
      );

      fireEvent.change(screen.getByTestId("product-by-hand-price"), { target: { value: "2.49" } });
      fireEvent.change(screen.getByTestId("product-by-hand-currency"), { target: { value: "EU" } });

      expect(screen.getByTestId("product-currency-error")).toHaveTextContent("invalidCurrency");
      expect(onValidityChange).toHaveBeenLastCalledWith(false);
      // Half a currency is not a price the panel may save.
      expect(onChoice).not.toHaveBeenLastCalledWith(expect.objectContaining({ currency: "EU" }));

      fireEvent.change(screen.getByTestId("product-by-hand-currency"), {
        target: { value: "usd" },
      });
      expect(screen.queryByTestId("product-currency-error")).not.toBeInTheDocument();
      expect(onValidityChange).toHaveBeenLastCalledWith(true);
      expect(onChoice).toHaveBeenLastCalledWith(
        expect.objectContaining({ kind: "manual", price: 2.49, currency: "USD" })
      );
    });

    it("keeps the Sale and the pack of the product it corrects, and says so", async () => {
      const onChoice = vi.fn();
      const onSale = {
        ...product("read-1", "store-a", "Geitenkaas plakken", 2.19),
        size: "150 g",
        packQuantity: 150,
        packUnit: "gram",
        regularPrice: 3.29,
        dealWords: "Weekend actie",
      } as StoreProductDto;

      render(
        <GroceryProductField
          choice={null}
          groceryName="geitenkaas"
          linkedProduct={onSale}
          store={STORE_A}
          onChoice={onChoice}
        />
      );

      expect(screen.getByTestId("product-pack-quantity")).toHaveValue("150");

      // A name typed over a product on Sale corrects that product: the
      // correction carries its Sale, the deal's words, its size and its pack,
      // so the row after Save is the same Sale under a better name.
      await act(async () => {
        fireEvent.change(screen.getByTestId("product-by-hand-name"), {
          target: { value: "Geitenkaas plakken, 150 g" },
        });
      });

      expect(onChoice).toHaveBeenLastCalledWith(
        expect.objectContaining({
          kind: "manual",
          name: "Geitenkaas plakken, 150 g",
          price: 2.19,
          size: "150 g",
          pack: { quantity: 150, unit: "gram", byWeight: false },
          regularPrice: 3.29,
          dealWords: "Weekend actie",
        })
      );
      // The pack stays on the panel too: the amount above still counts it.
      expect(screen.getByTestId("product-pack-quantity")).toHaveValue("150");
      expect(screen.getByTestId("product-details")).toHaveTextContent("€2.19 · 150 g");

      // A price typed at or above the regular one is no Sale any more; the
      // shop's words stay, since they are the shop's and not a number.
      await act(async () => {
        fireEvent.change(screen.getByTestId("product-by-hand-price"), {
          target: { value: "3.29" },
        });
      });

      expect(onChoice).toHaveBeenLastCalledWith(
        expect.objectContaining({ kind: "manual", price: 3.29, regularPrice: null })
      );
      expect(onChoice.mock.lastCall?.[0]).toMatchObject({ dealWords: "Weekend actie" });
    });

    it("sums the product up on the details row", () => {
      render(
        <GroceryProductField
          choice={null}
          groceryName="cola"
          linkedProduct={product("prod-a", "store-a", "Coca-Cola 1 L", 1.99)}
          store={STORE_A}
          onChoice={() => undefined}
        />
      );

      const row = screen.getByTestId("product-details");

      // The price and the pack, in one line; the name is in the product field
      // right above it.
      expect(row).toHaveTextContent("productDetails");
      expect(row).toHaveTextContent("€1.99 · 1 L");
      expect(row).not.toHaveTextContent("Coca-Cola");
    });

    it("holds everything about the product, all of it the shopper's to overwrite", () => {
      const onChoice = vi.fn();

      render(
        <GroceryProductField
          choice={null}
          groceryName="cola"
          linkedProduct={product("prod-a", "store-a", "Coca-Cola 1 L", 1.99)}
          store={STORE_A}
          onChoice={onChoice}
        />
      );

      // Prefilled from the product the fields describe.
      expect(screen.getByTestId("product-by-hand-name")).toHaveValue("Coca-Cola 1 L");
      expect(screen.getByTestId("product-details-price")).toHaveValue("1.99");
      expect(screen.getByTestId("product-by-hand-currency")).toHaveValue("EUR");
      expect(screen.getByTestId("product-pack-quantity")).toHaveValue("1");
      expect(screen.getByTestId("product-by-hand-page")).toHaveValue(
        "https://store-a.example/p/prod-a"
      );

      // A page typed over the product's rides on the choice, as does the pack.
      fireEvent.change(screen.getByTestId("product-by-hand-page"), {
        target: { value: "https://store-a.example/p/cola-family" },
      });
      fireEvent.change(screen.getByTestId("product-pack-quantity"), { target: { value: "2" } });

      expect(onChoice).toHaveBeenLastCalledWith(
        expect.objectContaining({
          kind: "manual",
          pageUrl: "https://store-a.example/p/cola-family",
          pack: expect.objectContaining({ quantity: 2, unit: "liter" }),
        })
      );
      // The link beside the field follows what was typed.
      expect(screen.getByTestId("product-page-link")).toHaveAttribute(
        "href",
        "https://store-a.example/p/cola-family"
      );
    });

    it("refuses a page that is not a web address, and half a pack, before Save", () => {
      const onValidityChange = vi.fn();

      render(
        <GroceryProductField
          choice={null}
          groceryName="cola"
          linkedProduct={product("prod-a", "store-a", "Coca-Cola 1 L", 1.99)}
          store={STORE_A}
          onChoice={() => undefined}
          onValidityChange={onValidityChange}
        />
      );

      fireEvent.change(screen.getByTestId("product-by-hand-page"), {
        target: { value: "not a page" },
      });
      expect(screen.getByTestId("product-page-error")).toBeInTheDocument();
      expect(onValidityChange).toHaveBeenLastCalledWith(false);

      fireEvent.change(screen.getByTestId("product-by-hand-page"), { target: { value: "" } });
      expect(onValidityChange).toHaveBeenLastCalledWith(true);

      // An amount without a unit is half a pack, and said so.
      fireEvent.change(screen.getByTestId("product-pack-quantity"), { target: { value: "" } });
      expect(screen.getByTestId("product-pack-error")).toBeInTheDocument();
      expect(onValidityChange).toHaveBeenLastCalledWith(false);
    });
  });

  it("keeps pack metadata out of the grocery editor", () => {
    render(
      <GroceryProductField
        choice={null}
        groceryName="cola"
        linkedProduct={product("prod-a", "store-a", "Coca-Cola 1 L", 1.99)}
        store={STORE_A}
        onChoice={() => undefined}
      />
    );

    expect(screen.queryByTestId("pack-size")).not.toBeInTheDocument();
  });
});
