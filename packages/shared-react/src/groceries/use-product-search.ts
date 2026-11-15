import { useEffect, useState } from "react";

import type { StoreDto, StoreProductDto } from "@norish/shared/contracts";
import type { PackSizeWords } from "@norish/shared/lib/format-price";
import { distinctProducts } from "@norish/shared/lib/auto-link";
import { isPriced } from "@norish/shared/lib/currency";

import { answers, candidateRow, productRow } from "./product-rows";
import { useShopSearch, useStoreProducts } from "./use-store-products-query";

/** How long a shopper stops typing before the shop is asked. */
const SEARCH_DEBOUNCE_MS = 400;

/** The product field's search: the term, the shop's answer and the Store's own products as one row each. */
export function useProductSearch(options: {
  store: StoreDto | null;
  groceryName: string;
  linkedProduct: StoreProductDto | null;
  linkPending: boolean;
  /** The row the field holds as picked; it stands for its twins and is always listed. */
  picked: string | null;
  packWords: PackSizeWords;
}) {
  const { store, groceryName, linkedProduct, linkPending, picked, packWords } = options;
  const canSearch = Boolean(store?.searchAddress);
  const [term, setTerm] = useState(linkedProduct?.name ?? "");
  const [searchedTerm, setSearchedTerm] = useState(() => groceryName.trim());
  const [asked, setAsked] = useState(false);
  const [typed, setTyped] = useState(false);
  // The name the field put in the box itself: an answer, so the shop is not asked about it again.
  const [answeredWith, setAnsweredWith] = useState<string | null>(null);

  // The grocery's name until the shopper types, then what they typed; asked once the typing stops.
  useEffect(() => {
    const next = typed ? term.trim() || groceryName.trim() : groceryName.trim();

    if (typed && answeredWith === term) return;
    if (next === searchedTerm) return;
    const timer = setTimeout(() => setSearchedTerm(next), SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [term, groceryName, typed, searchedTerm, answeredWith]);

  // Nothing linked, and known to be so rather than still being read.
  const unanswered = !linkedProduct && !linkPending;
  // Exactly the query's own `enabled`, so what the field says and what the search does agree.
  const asking = canSearch && asked && (typed || unanswered) && searchedTerm.trim().length > 0;
  const search = useShopSearch(store?.id ?? null, searchedTerm, asking);
  const products = useStoreProducts(store?.id ?? null, asked);
  const candidates = (search.data?.candidates ?? []).filter(isPriced);
  const stored = products.data ?? [];
  const storedByPage = new Map(
    stored
      .filter((product) => product.pageUrl)
      .map((product) => [product.pageUrl ?? "", product] as const)
  );
  const offered = new Set(candidates.map((candidate) => candidate.url));
  // A result the Store already has a product for is that product, with the price read from its page.
  const known = stored
    .filter(
      (product) =>
        (product.pageUrl && offered.has(product.pageUrl)) ||
        product.id === picked ||
        answers(product.name, searchedTerm || groceryName)
    )
    .map((product) => productRow(product, packWords));
  const fromShop = candidates
    .filter((candidate) => !storedByPage.has(candidate.url))
    .map((candidate) => candidateRow(candidate, packWords));
  // One row per product however many addresses the shop lists it under; a picked row stands for its twins.
  const rows = distinctProducts([...known, ...fromShop], (row) => row.key === picked);
  // A query nobody enabled stays `pending` for ever, so `isPending` alone never stops searching.
  const isSearching = asking && (search.isPending || search.isFetching);
  // A shop that is down or turned the visit away has not said it stocks nothing.
  const noAnswer = asking && !isSearching && search.data?.answered === false;
  const foundNothing = asking && !isSearching && !noAnswer && candidates.length === 0;

  return {
    canSearch,
    pointsAtShop: Boolean(store?.website ?? store?.searchAddress),
    term,
    searchedTerm,
    typed,
    unanswered,
    stored,
    candidates,
    rows,
    knownRows: rows.filter((row) => row.choice.kind === "product"),
    shopRows: rows.filter((row) => row.choice.kind === "candidate"),
    isSearching,
    noAnswer,
    foundNothing,
    onTermInput: (value: string) => {
      setAsked(true);
      setTyped(true);
      setTerm(value);
    },
    ask: () => setAsked(true),
    /** The box reads the linked product's name, as it opens with. */
    showTerm: setTerm,
    /** The box shows a row's name as the answer it is. */
    answer: (name: string) => {
      setAnsweredWith(name);
      setTerm(name);
    },
    /** The question is gone until the typing stops and a new one is asked. */
    forget: () => {
      setAnsweredWith(null);
      setTerm("");
      setSearchedTerm("");
      setTyped(false);
    },
  };
}
