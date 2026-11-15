import { useEffect, useEffectEvent, useRef, useState } from "react";

import type { StoreDto, StoreProductChoice, StoreProductDto } from "@norish/shared/contracts";
import type { PackSizeWords } from "@norish/shared/lib/format-price";
import { chooseUnmistakable } from "@norish/shared/lib/auto-link";
import { currencyForUrl } from "@norish/shared/lib/currency";
import { formatPackSize, formatShelfPrice } from "@norish/shared/lib/format-price";
import { packSizeOf } from "@norish/shared/lib/pack-size";
import { saleRegularPrice } from "@norish/shared/lib/sale";

import type { ProductRow } from "./product-rows";
import { selectedKey } from "./product-rows";
import { useProductSearch } from "./use-product-search";
import { useTypedProduct } from "./use-typed-product";

export interface ProductFieldOptions {
  /** The Store being priced at; none while the grocery has none, and the field then does nothing. */
  store: StoreDto | null;
  /** The grocery's name as it will be stored; the Product Link is keyed by it. */
  groceryName: string;
  /** What this grocery is linked to now, which is what the field opens reading. */
  linkedProduct: StoreProductDto | null;
  /** Whether that is still being read; until then a null `linkedProduct` says nothing. */
  linkPending?: boolean;
  choice: StoreProductChoice | null;
  onChoice: (choice: StoreProductChoice | null) => void;
  /** Whether what is typed by hand could be saved. */
  onValidityChange?: (valid: boolean) => void;
  locale: string;
  packWords: PackSizeWords;
}

/** Which of the shop's products a grocery is: its search and the by-hand fields, composed.
 * Nothing is written here; the choice goes to `onChoice` for the screen's own Save or Add. */
export function useProductField({
  store,
  groceryName,
  linkedProduct,
  linkPending = false,
  choice,
  onChoice,
  onValidityChange,
  locale,
  packWords,
}: ProductFieldOptions) {
  const [picked, setPicked] = useState<string | null>(() => selectedKey(choice));
  // The shopper said the linked product is not it and chose nothing else: the field stays empty.
  const [unlinked, setUnlinked] = useState(false);
  const heldByHandRef = useRef("");
  // A row the field took by itself, and whether for the grocery's own name or a typed term.
  const [autoPicked, setAutoPicked] = useState<{ key: string; forName: boolean } | null>(null);
  // A choice the field made while rendering, handed to the panel by the effect below.
  const [ownChoice, setOwnChoice] = useState<{ choice: StoreProductChoice | null } | null>(null);
  const [lastName, setLastName] = useState(groceryName);

  const search = useProductSearch({
    store,
    groceryName,
    linkedProduct,
    linkPending,
    picked,
    packWords,
  });
  const { rows, stored, typed: termTyped, searchedTerm, unanswered, isSearching } = search;

  // The product the fields describe: the picked row, else the link; a correction inherits its details.
  const selectedRow = rows.find((row) => row.key === picked);
  const selectedPack = picked
    ? (selectedRow?.pack ?? null)
    : linkedProduct
      ? packSizeOf(linkedProduct)
      : null;
  const selectedSize = picked ? selectedRow?.size : linkedProduct?.size;
  const selectedRegularPrice = picked
    ? (selectedRow?.regularPrice ?? null)
    : linkedProduct
      ? saleRegularPrice(linkedProduct.price, linkedProduct.regularPrice)
      : null;
  const selectedDealWords = picked
    ? (selectedRow?.dealWords ?? null)
    : (linkedProduct?.dealWords ?? null);

  // This Store's products' currency, else what its website's top-level domain implies.
  const suggestedCurrency =
    stored[0]?.currency ??
    search.candidates[0]?.currency ??
    currencyForUrl(store?.website ?? null) ??
    "EUR";
  const typed = useTypedProduct({
    groceryName,
    suggestedCurrency,
    byWeight: selectedPack?.byWeight ?? false,
    onValidityChange,
  });
  const { byHand, hasTypedPrice, typedPrice, typedPack, currency, pageUrl } = typed;

  // The panel's own setter is no reason to hand the same choice over again.
  const handOver = useEffectEvent((next: StoreProductChoice | null) => onChoice(next));

  useEffect(() => {
    if (ownChoice) handOver(ownChoice.choice);
  }, [ownChoice]);

  /** This row is the answer, tapped or unmistakable; whoever took it hands its choice over. */
  const take = (row: ProductRow) => {
    search.answer(row.name);
    setUnlinked(false);
    setPicked(row.key);
    typed.show(row.name, row.price, row.currency, row.pack, row.pageUrl);
  };

  /** A row the shopper tapped is theirs, the one the field took for them included. */
  const takeTapped = (row: ProductRow) => {
    setAutoPicked(null);
    take(row);
    onChoice(row.choice);
  };

  // A tap on the picked row changes no value, so the ComboBox stays silent; the row answers itself.
  const tapRow = (row: ProductRow) => {
    if (row.key === picked) takeTapped(row);
  };

  // The one row nobody would hesitate over, taken only while nothing is linked, picked or typed.
  const question = searchedTerm || groceryName.trim();
  // Rows for the name as it was a moment ago answer nothing: only once the search caught up.
  const rowsAnswerTheQuestion = termTyped || searchedTerm === groceryName.trim();
  const unmistakable =
    !picked && !byHand && unanswered && !isSearching && rowsAnswerTheQuestion
      ? chooseUnmistakable(rows, question)
      : null;

  if (unmistakable) {
    setAutoPicked({ key: unmistakable.key, forName: !termTyped });
    take(unmistakable);
    setOwnChoice({ choice: unmistakable.choice });
  }

  /** The field's own answer let go of, and its question with it. */
  const untake = () => {
    setAutoPicked(null);
    setPicked(null);
    search.forget();
    typed.clear();
  };

  /** Not this product, says the shopper: the field empties and Save writes a Miss. */
  const unlink = () => {
    untake();
    setUnlinked(true);
    onChoice({ kind: "none" });
  };

  // Another Store is another shop: nothing of the last one's search or product carries over.
  const storeId = store?.id ?? null;
  const [lastStoreId, setLastStoreId] = useState(storeId);

  if (lastStoreId !== storeId) {
    setLastStoreId(storeId);
    untake();
    setUnlinked(false);
  }

  // A row taken for the grocery's name follows the name; one the shopper tapped or typed for stays.
  if (lastName !== groceryName) {
    setLastName(groceryName);
    if (autoPicked?.forName) {
      untake();
      setOwnChoice({ choice: null });
    }
  }

  const opensWith = linkedProduct?.name ?? "";
  const [lastOpensWith, setLastOpensWith] = useState(opensWith);

  if (lastOpensWith !== opensWith) {
    setLastOpensWith(opensWith);
    search.showTerm(opensWith);
  }

  // The fields open reading the link, read again only when these change: a tap must not be undone.
  const [readFrom, setReadFrom] = useState<{
    byHand: boolean;
    groceryName: string;
    linkedProduct: StoreProductDto | null;
    unlinked: boolean;
  } | null>(null);

  if (
    !readFrom ||
    readFrom.byHand !== byHand ||
    readFrom.groceryName !== groceryName ||
    readFrom.linkedProduct !== linkedProduct ||
    readFrom.unlinked !== unlinked
  ) {
    setReadFrom({ byHand, groceryName, linkedProduct, unlinked });
    if (!byHand && !unlinked) {
      if (linkedProduct) {
        typed.show(
          linkedProduct.name,
          linkedProduct.price,
          linkedProduct.currency,
          packSizeOf(linkedProduct),
          linkedProduct.pageUrl
        );
      } else {
        typed.showName(groceryName);
        if (!picked) typed.clear();
      }
    }
  }

  // A price typed over a by-hand product corrects it; over a shop's product it is a new one.
  const shown = picked ? (stored.find((product) => product.id === picked) ?? null) : linkedProduct;
  const manualTarget = shown?.isManual ? shown.id : typed.manualId;
  // A typed price is the choice as soon as it is one; deleted again, the picked row is.
  const pickedChoice = rows.find((row) => row.key === picked)?.choice ?? null;

  // A correction keeps its product's size, pack and Sale; the typed price decides if it still is one.
  const heldByHand = hasTypedPrice
    ? `${manualTarget}|${typed.manualName}|${typedPrice}|${currency}|${selectedSize ?? ""}|${JSON.stringify(typedPack)}|${pageUrl ?? ""}|${selectedRegularPrice ?? ""}|${selectedDealWords ?? ""}`
    : `picked|${picked ?? ""}`;
  const handOverByHand = useEffectEvent(() =>
    onChoice(
      hasTypedPrice
        ? {
            kind: "manual",
            id: manualTarget,
            name: typed.manualName.trim() || groceryName,
            price: typedPrice,
            currency,
            size: selectedSize ?? null,
            pack: typedPack,
            pageUrl,
            regularPrice: saleRegularPrice(typedPrice, selectedRegularPrice),
            dealWords: selectedDealWords,
          }
        : (pickedChoice ?? (unlinked ? { kind: "none" } : null))
    )
  );

  useEffect(() => {
    // Fields showing the shop's numbers again start over: what is typed next is handed over anew.
    if (!byHand) {
      heldByHandRef.current = "";

      return;
    }
    if (heldByHandRef.current === heldByHand) return;
    heldByHandRef.current = heldByHand;
    handOverByHand();
  }, [byHand, heldByHand]);

  // The pack in words: the shop's own unless typed over, else Norish's for the pack held.
  const packEdited = JSON.stringify(typedPack) !== JSON.stringify(selectedPack);
  const packDetail =
    typedPack && (packEdited || !selectedSize || (!picked && linkedProduct?.packByHand))
      ? formatPackSize(typedPack, packWords)
      : (selectedSize ?? "");
  // The details row sums up the price and the pack; the name is in the field above.
  const detailsSummary = [
    hasTypedPrice ? formatShelfPrice(locale, typedPrice, currency) : currency,
    packDetail,
  ]
    .filter(Boolean)
    .join(" · ");
  const detailsProblem = typed.currencyInvalid
    ? ("currency" as const)
    : typed.urlInvalid
      ? ("url" as const)
      : typed.packInvalid
        ? ("pack" as const)
        : null;

  return {
    pointsAtShop: search.pointsAtShop,
    canSearch: search.canSearch,
    term: search.term,
    onTermInput: search.onTermInput,
    ask: search.ask,
    rows,
    knownRows: search.knownRows,
    shopRows: search.shopRows,
    picked,
    takeTapped,
    tapRow,
    isSearching,
    noAnswer: search.noAnswer,
    foundNothing: search.foundNothing,
    unlinked,
    unlink,
    pageUrl,
    hasTypedPrice,
    typedPrice,
    selectedPack,
    suggestedCurrency,
    manualName: typed.manualName,
    manualPrice: typed.manualPrice,
    manualCurrency: typed.manualCurrency,
    manualPackQuantity: typed.manualPackQuantity,
    manualPackUnit: typed.manualPackUnit,
    manualUrl: typed.manualUrl,
    priceInvalid: typed.priceInvalid,
    currencyInvalid: typed.currencyInvalid,
    packInvalid: typed.packInvalid,
    urlInvalid: typed.urlInvalid,
    detailsSummary,
    detailsProblem,
    editName: typed.editName,
    editPrice: typed.editPrice,
    editCurrency: typed.editCurrency,
    editPackQuantity: typed.editPackQuantity,
    editPackUnit: typed.editPackUnit,
    editPageUrl: typed.editPageUrl,
  };
}
