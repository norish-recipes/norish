/**
 * What the row says about a grocery's price: the Line Cost and the packs it
 * counted where the Store knows the product, a loader while the Store is
 * still being asked, and nothing at all for a Miss or a name nobody has
 * asked about.
 */
import { GroceryPrice } from "@/components/groceries/grocery-price";
import { lineOf } from "@/components/groceries/store-total";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import type { GroceryDto, ResolvedProductLink, StoreProductDto } from "@norish/shared/contracts";

const links = new Map<string, ResolvedProductLink>();

vi.mock("@/app/(app)/groceries/stores-context", () => ({
  useStoresContext: () => ({
    linkFor: (storeId: string | null, name: string | null) =>
      links.get(`${storeId}|${name}`) ?? null,
    priceFor: (storeId: string | null, name: string | null) =>
      links.get(`${storeId}|${name}`)?.product ?? null,
  }),
}));

vi.mock("@/hooks/use-unit-formatter", () => ({
  useUnitFormatter: () => ({
    formatAmountUnit: (amount: number | null, unit: string | null) =>
      [amount, unit === "gram" ? "g" : unit].filter((part) => part !== null).join(" "),
  }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) =>
    key === "packs" ? `${params?.count} × ${params?.size}` : key,
  useLocale: () => "en",
}));

const STORE = "store-a";

function grocery(
  name: string,
  amount: number | null = null,
  unit: string | null = null
): GroceryDto {
  return { id: name, name, amount, unit, storeId: STORE, isDone: false } as unknown as GroceryDto;
}

function product(overrides: Partial<StoreProductDto>): StoreProductDto {
  return {
    id: "p-kaas",
    storeId: STORE,
    name: "Oude kaas 500 g",
    pageUrl: "https://shop.example/p/kaas",
    price: 4.99,
    currency: "EUR",
    size: "500 g",
    packQuantity: 500,
    packUnit: "gram",
    packByWeight: false,
    packByHand: false,
    regularPrice: null,
    dealWords: null,
    pricedAt: new Date(),
    isManual: false,
    version: 1,
    ...overrides,
  } as unknown as StoreProductDto;
}

function link(name: string, linked: StoreProductDto | null, triedAt: Date | null = new Date()) {
  links.set(`${STORE}|${name}`, { storeId: STORE, normalizedName: name, triedAt, product: linked });
}

describe("GroceryPrice", () => {
  it("shows the Shelf Price and the product it is for, for one pack", () => {
    link("kaas", product({}));
    render(<GroceryPrice line={lineOf(grocery("kaas"))} />);

    expect(screen.getByTestId("grocery-line-cost")).toHaveTextContent("€4.99 (1 × €4.99)");
    expect(screen.getByTestId("grocery-product")).toHaveTextContent("Oude kaas 500 g");
    expect(screen.queryByTestId("grocery-one-pack")).not.toBeInTheDocument();
  });

  it("shows the total and the amount times shelf price", () => {
    link("bloem", product({ id: "p-bloem", name: "Tarwebloem", price: 2.99 }));
    render(<GroceryPrice line={lineOf(grocery("bloem", 700, "gram"))} />);

    expect(screen.getByTestId("grocery-line-cost")).toHaveTextContent("€5.98 (2 × €2.99)");
    expect(screen.getByTestId("grocery-price")).toHaveAttribute("data-grocery-packs", "2");
  });

  it("uses pack metadata for calculation without showing it as purchase arithmetic", () => {
    link("bloem", product({ id: "p-bloem", price: 2.99, size: "groot pak", packByHand: true }));
    render(<GroceryPrice line={lineOf(grocery("bloem", 700, "gram"))} />);

    expect(screen.getByTestId("grocery-line-cost")).toHaveTextContent("€5.98 (2 × €2.99)");
  });

  it("shows the cost and the weight priced for what is sold loose", () => {
    link(
      "bananen",
      product({
        id: "p-bananen",
        name: "Bananen",
        price: 1.99,
        size: "per kg",
        packQuantity: 1,
        packUnit: "kilogram",
        packByWeight: true,
      })
    );
    render(<GroceryPrice line={lineOf(grocery("bananen", 700, "gram"))} />);

    expect(screen.getByTestId("grocery-line-cost")).toHaveTextContent("€1.39 (0.7 × €1.99)");
  });

  it("notes, quietly, a line it priced as one pack", () => {
    link("kaas", product({}));
    render(<GroceryPrice line={lineOf(grocery("kaas", 2, "liter"))} />);

    expect(screen.getByTestId("grocery-line-cost")).toHaveTextContent("€4.99 (1 × €4.99)");
    expect(screen.getByTestId("grocery-one-pack")).toHaveTextContent("onePack");
  });

  it("shows a Sale like any other price: the regular Line Cost struck through, the new one beside it", () => {
    link("kaas", product({ price: 3.38, regularPrice: 5.3, size: "150 g", packQuantity: 150 }));
    render(<GroceryPrice line={lineOf(grocery("kaas", 300, "gram"))} />);

    // The strike, the price and the arithmetic, all on the money line; the
    // price itself is no chip and no badge, just the price.
    const lineCost = screen.getByTestId("grocery-line-cost");

    expect(lineCost).toHaveTextContent(/^€10\.60 €6\.76 \(2 × €3\.38\)$/);
    expect(within(lineCost).getByTestId("grocery-regular-cost")).toHaveTextContent("€10.60");
    expect(within(lineCost).getByTestId("grocery-sale")).toHaveTextContent(/^€6\.76$/);
    expect(within(lineCost).getByTestId("grocery-sale")).not.toHaveAttribute("title");
    expect(screen.queryByTestId("grocery-deal-words")).not.toBeInTheDocument();
    expect(screen.getByTestId("grocery-product")).toHaveTextContent(/^Oude kaas 500 g$/);
  });

  it("keeps the shop's words for a Sale on the price, for whoever wants them", () => {
    link("kaas", product({ price: 3.38, regularPrice: 5.3, dealWords: "Weekend actie" }));
    render(<GroceryPrice line={lineOf(grocery("kaas"))} />);

    // The words are the price's title and not a badge of their own.
    const price = screen.getByTestId("grocery-sale");

    expect(price).toHaveTextContent(/^€3\.38$/);
    expect(price).toHaveAttribute("title", "Weekend actie");
    expect(screen.getByTestId("grocery-line-cost")).toHaveTextContent(
      /^€5\.30 €3\.38 \(1 × €3\.38\)$/
    );
  });

  it("keeps the product name separate from promotion details", () => {
    link("kaas", product({ price: 2.95, dealWords: "2 voor €5.50" }));
    render(<GroceryPrice line={lineOf(grocery("kaas"))} />);

    // Words over a regular price are not a Sale, and are never worked into
    // the number: the price stands as it is, and the words are its title.
    expect(screen.getByTestId("grocery-deal-words")).toHaveTextContent(/^€2\.95$/);
    expect(screen.getByTestId("grocery-deal-words")).toHaveAttribute("title", "2 voor €5.50");
    expect(screen.getByTestId("grocery-product")).toHaveTextContent(/^Oude kaas 500 g$/);
    expect(screen.queryByTestId("grocery-sale")).not.toBeInTheDocument();
    expect(screen.queryByTestId("grocery-regular-cost")).not.toBeInTheDocument();
    expect(screen.getByTestId("grocery-line-cost")).toHaveTextContent(/^€2\.95 \(1 × €2\.95\)$/);
  });

  it("shows a loader, and no words, while the Store is still being asked", () => {
    link("melk", null, null);
    render(<GroceryPrice line={lineOf(grocery("melk"))} />);

    const pending = screen.getByTestId("grocery-price-pending");

    expect(pending).toBeInTheDocument();
    expect(pending).toHaveTextContent("");
    expect(screen.getByLabelText("pending")).toBeInTheDocument();
    expect(screen.queryByTestId("grocery-price")).not.toBeInTheDocument();
  });

  it("shows nothing for a Miss, and nothing for a name nobody asked about", () => {
    link("sterrenstof", null);
    const { container } = render(
      <>
        <GroceryPrice line={lineOf(grocery("sterrenstof"))} />
        <GroceryPrice line={lineOf(grocery("niets"))} />
      </>
    );

    expect(container).toBeEmptyDOMElement();
  });
});
