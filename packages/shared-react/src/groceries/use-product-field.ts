import { useEffect, useEffectEvent, useRef, useState } from "react";

import type { StoreDto, StoreProductChoice, StoreProductDto } from "@norish/shared/contracts";
import type { PackSizeWords } from "@norish/shared/lib/format-price";
import type { PackSize } from "@norish/shared/lib/pack-size";
import { chooseUnmistakable, distinctProducts } from "@norish/shared/lib/auto-link";
import { currencyForUrl, isPriced } from "@norish/shared/lib/currency";
import { formatPackSize, formatShelfPrice } from "@norish/shared/lib/format-price";
import { createClientId } from "@norish/shared/lib/operation-helpers";
import { packSizeOf } from "@norish/shared/lib/pack-size";
import { saleRegularPrice } from "@norish/shared/lib/sale";
import { httpUrlSchema } from "@norish/shared/lib/schema";
import { isUnitId } from "@norish/shared/lib/units";

import type { ProductRow } from "./product-rows";
import { answers, candidateRow, productRow, selectedKey } from "./product-rows";
import { useShopSearch, useStoreProducts } from "./use-store-products-query";

/** How long a shopper stops typing before the shop is asked. */
const SEARCH_DEBOUNCE_MS = 400;

export interface ProductFieldOptions {
  store: StoreDto;
  /** The grocery's name as it will be stored; the Product Link is keyed by it. */
  groceryName: string;
  /** What this grocery is linked to now, which is what the field opens reading. */
  linkedProduct: StoreProductDto | null;
  /**
   * Whether that is still being read. While it is, `linkedProduct` being null says nothing, and
   * the field neither asks the shop about the name nor takes a product for it.
   */
  linkPending?: boolean;
  choice: StoreProductChoice | null;
  onChoice: (choice: StoreProductChoice | null) => void;
  /** Whether what is typed by hand could be saved. */
  onValidityChange?: (valid: boolean) => void;
  locale: string;
  packWords: PackSizeWords;
}

/**
 * Which of the shop's products a grocery is: reads what it is linked to now, asks the shop as you
 * type, and holds the price, currency, pack and page a shopper may overwrite. Nothing is written
 * here: the choice goes to `onChoice` and is committed by the screen's own Save or Add.
 */
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
  const canSearch = Boolean(store.searchAddress);
  const pointsAtShop = Boolean(store.website ?? store.searchAddress);
  const opensWith = linkedProduct?.name ?? "";
  const [term, setTerm] = useState(opensWith);
  const [searchedTerm, setSearchedTerm] = useState(() => groceryName.trim());
  const [asked, setAsked] = useState(false);
  const [typed, setTyped] = useState(false);
  const [picked, setPicked] = useState<string | null>(() => selectedKey(choice));
  // Whether the fields below still show the shop's own numbers, or the
  // shopper's. Only a shopper who typed over them owns them.
  const [byHand, setByHand] = useState(false);
  // The shopper has said the linked product is not it, and nothing has been
  // chosen in its place: the field stays empty rather than reading the link.
  const [unlinked, setUnlinked] = useState(false);
  const [manualPrice, setManualPrice] = useState("");
  const [manualName, setManualName] = useState(groceryName);
  const [manualCurrency, setManualCurrency] = useState("");
  // What one price buys, and the product's page: prefilled from the product
  // the fields describe, and the shopper's to overwrite like the rest.
  const [manualPackQuantity, setManualPackQuantity] = useState("");
  const [manualPackUnit, setManualPackUnit] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [manualId] = useState(createClientId);
  const heldByHandRef = useRef("");
  // The name the field itself put in the box. That is an answer, not a
  // question: writing a choice into the input must never send the household
  // back to the shop to ask about the product they have just chosen.
  const [answeredWith, setAnsweredWith] = useState<string | null>(null);
  // A row the field took by itself, and whether it took it for the grocery's
  // own name rather than for something the shopper typed here.
  const [autoPicked, setAutoPicked] = useState<{ key: string; forName: boolean } | null>(null);
  // What the field took or let go of by itself, while rendering, for the
  // effect below to hand to the panel once it is on screen.
  const [ownChoice, setOwnChoice] = useState<{ choice: StoreProductChoice | null } | null>(null);
  const [lastName, setLastName] = useState(groceryName);
  const [lastOpensWith, setLastOpensWith] = useState(opensWith);

  // Until the shopper types, the question is the grocery's own name, which the
  // panel above may still be being filled in; after they type it is what they
  // typed. Either way only once the typing stops: the name field is typed one
  // letter at a time, and a shop is not asked about "k", "ka" and "kaa" on the
  // way to "kaas". Never the linked product's own name: that question is
  // already answered.
  useEffect(() => {
    const next = typed ? term.trim() || groceryName.trim() : groceryName.trim();

    if (typed && answeredWith === term) return;
    if (next === searchedTerm) return;
    const timer = setTimeout(() => setSearchedTerm(next), SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [term, groceryName, typed, searchedTerm, answeredWith]);

  // The panel's own setter is no reason to hand the same choice over again.
  const handOver = useEffectEvent((next: StoreProductChoice | null) => onChoice(next));

  useEffect(() => {
    if (ownChoice) handOver(ownChoice.choice);
  }, [ownChoice]);

  // Nobody has answered this name: nothing is linked, and that is known
  // rather than still being read.
  const unanswered = !linkedProduct && !linkPending;
  const wants = canSearch && asked && (typed || unanswered);
  // Exactly the query's own `enabled`, so what the field says about the search
  // and what the search is doing cannot drift apart.
  const asking = wants && searchedTerm.trim().length > 0;
  const search = useShopSearch(store.id, searchedTerm, asking);
  const products = useStoreProducts(store.id, asked);
  const candidates = (search.data?.candidates ?? []).filter(isPriced);
  const stored = products.data ?? [];
  const storedByPage = new Map(
    stored
      .filter((product) => product.pageUrl)
      .map((product) => [product.pageUrl ?? "", product] as const)
  );
  const offered = new Set(candidates.map((candidate) => candidate.url));
  // One product, one row. A result the Store already has a product for is that
  // product: it carries the price Norish read from the product's own page, and
  // it is what a link can point at.
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
  // One product, one row, however many addresses the shop lists it under: AH
  // lists a loaf under two product numbers with nothing to tell them apart.
  // The Store's own copy stands for the shop's, and a row that is picked
  // stands for its twins, so what is linked is never the row that was hidden.
  const rows = distinctProducts([...known, ...fromShop], (row) => row.key === picked);
  const knownRows = rows.filter((row) => row.choice.kind === "product");
  const shopRows = rows.filter((row) => row.choice.kind === "candidate");
  // A query nobody enabled sits in `pending` for ever, so a field that reads
  // `isPending` alone says it is searching long after it has stopped.
  const isSearching = asking && (search.isPending || search.isFetching);
  // A shop that is down, or turned the visit away, has not said it stocks
  // nothing: that is a different fact from an empty answer, and is worded as
  // one rather than sending the shopper to type a price for something the
  // shop sells.
  const noAnswer = asking && !isSearching && search.data?.answered === false;
  // Whether the *shop* answered with nothing, not whether the dropdown is
  // empty: a Store that already knows other products still has a shop that
  // cannot price this one.
  const foundNothing = asking && !isSearching && !noAnswer && candidates.length === 0;

  // What the shop is most likely to charge in, so the field is a confirmation
  // rather than a question: what this Store's products are already priced in,
  // else what its website's top-level domain implies.
  const suggestedCurrency =
    stored[0]?.currency ?? candidates[0]?.currency ?? currencyForUrl(store.website) ?? "EUR";
  const currency = (manualCurrency.trim() || suggestedCurrency).toUpperCase();
  const typedPrice = Number(manualPrice.replace(",", "."));
  // What is typed is held to what it claims to be, and said so under the
  // field: a price is a number that is not below nothing, a currency is
  // three letters. An empty field claims nothing and is never wrong.
  const priceInvalid =
    manualPrice.trim() !== "" && !(Number.isFinite(typedPrice) && typedPrice >= 0);
  const currencyInvalid =
    manualCurrency.trim() !== "" && !/^[A-Za-z]{3}$/.test(manualCurrency.trim());
  const trimmedUrl = manualUrl.trim();
  const urlInvalid = trimmedUrl !== "" && !httpUrlSchema.safeParse(trimmedUrl).success;
  const typedQuantity = Number(manualPackQuantity.replace(",", "."));
  const quantityTyped = manualPackQuantity.trim() !== "";
  const unitTyped = manualPackUnit !== "";
  // A pack is an amount and a unit, or nothing at all; half a pack is said so.
  const packInvalid =
    quantityTyped !== unitTyped ||
    (quantityTyped && !(Number.isFinite(typedQuantity) && typedQuantity > 0));
  const valid = !priceInvalid && !currencyInvalid && !urlInvalid && !packInvalid;
  const hasTypedPrice = manualPrice.trim() !== "" && !priceInvalid && !currencyInvalid;

  useEffect(() => {
    onValidityChange?.(valid);
  }, [valid, onValidityChange]);

  // A field that is taken away — the Store swapped, the next grocery begun —
  // takes its complaint with it.
  useEffect(() => () => onValidityChange?.(true), [onValidityChange]);

  /** The fields say what this is and costs, until somebody types over them. */
  const showAs = (
    name: string,
    price: number,
    priceCurrency: string,
    pack: PackSize | null,
    productPage: string | null
  ) => {
    setByHand(false);
    setManualName(name);
    setManualPrice(String(price));
    setManualCurrency(priceCurrency);
    setManualPackQuantity(pack ? String(pack.quantity) : "");
    setManualPackUnit(pack?.unit ?? "");
    setManualUrl(productPage ?? "");
  };

  /**
   * This row is the answer, however it came to be: tapped, or unmistakable.
   * Whoever took it hands its choice to the panel.
   */
  const take = (row: ProductRow) => {
    setAnsweredWith(row.name);
    setUnlinked(false);
    setPicked(row.key);
    setTerm(row.name);
    showAs(row.name, row.price, row.currency, row.pack, row.pageUrl);
  };

  /** A row the shopper tapped is theirs, the one the field took for them included. */
  const takeTapped = (row: ProductRow) => {
    setAutoPicked(null);
    take(row);
    onChoice(row.choice);
  };

  // A tap on the row already picked changes no value, so the ComboBox's
  // onChange stays silent; that row answers its own tap.
  const tapRow = (row: ProductRow) => {
    if (row.key === picked) takeTapped(row);
  };

  // The one row a human would not hesitate over, by the rule the lookup queue
  // applies at the shop. A shopper who typed the product's own name has made
  // the choice already, and offering it back as a row to tap is asking them to
  // make it twice. Only where nobody has answered yet: a grocery with nothing
  // linked — known, not merely unread — no row picked and no price typed over
  // the top. Nothing is written either way — the panel's own Save is still
  // what commits it.
  const question = searchedTerm || groceryName.trim();
  // The rows answer the term that was searched. For the grocery's own name
  // that is the question being asked only once the typing has stopped and the
  // search has caught up with it; rows for the name as it was a moment ago
  // answer nothing.
  const rowsAnswerTheQuestion = typed || searchedTerm === groceryName.trim();
  const unmistakable =
    !picked && !byHand && unanswered && !isSearching && rowsAnswerTheQuestion
      ? chooseUnmistakable(rows, question)
      : null;

  if (unmistakable) {
    setAutoPicked({ key: unmistakable.key, forName: !typed });
    take(unmistakable);
    setOwnChoice({ choice: unmistakable.choice });
  }

  /**
   * The field's own answer, let go of: the question it answered is gone, and
   * so is the question itself, until the typing stops and a new one is asked.
   */
  const untake = () => {
    setAutoPicked(null);
    setAnsweredWith(null);
    setPicked(null);
    setTerm("");
    setSearchedTerm("");
    setTyped(false);
    setByHand(false);
    setManualPrice("");
    setManualCurrency("");
    setManualPackQuantity("");
    setManualPackUnit("");
    setManualUrl("");
  };

  /**
   * The product the grocery is linked to is not it, says the shopper. The
   * field empties, and the panel's own Save writes a Miss: unpriced, and not
   * asked of the shop again until somebody types in here.
   */
  const unlink = () => {
    untake();
    setUnlinked(true);
    onChoice({ kind: "none" });
  };

  // A row the field took for the grocery's own name follows that name. A
  // shopper who goes on typing after the field took "kaas" for them is no
  // longer asking about "kaas", so the row is let go and the new name is held
  // against the rows afresh — or the shop is asked again. A row the shopper
  // tapped, or one taken for a term they typed here, is theirs and stays.
  if (lastName !== groceryName) {
    setLastName(groceryName);
    if (autoPicked?.forName) {
      untake();
      setOwnChoice({ choice: null });
    }
  }

  if (lastOpensWith !== opensWith) {
    setLastOpensWith(opensWith);
    setTerm(opensWith);
  }

  // What the grocery is linked to now is what the fields open reading, so the
  // panel has its whole shape from the first frame. A name with nothing linked
  // and nothing picked has no price to show yet — not the last name's. Only
  // these are a reason to read them again: a tap sets `picked` and the fields
  // in the same breath, and must not be undone by it.
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
        const linkedPack = packSizeOf(linkedProduct);

        setManualName(linkedProduct.name);
        setManualPrice(String(linkedProduct.price));
        setManualCurrency(linkedProduct.currency);
        setManualPackQuantity(linkedPack ? String(linkedPack.quantity) : "");
        setManualPackUnit(linkedPack?.unit ?? "");
        setManualUrl(linkedProduct.pageUrl ?? "");
      } else {
        setManualName(groceryName);
        if (!picked) {
          setManualPrice("");
          setManualCurrency("");
          setManualPackQuantity("");
          setManualPackUnit("");
          setManualUrl("");
        }
      }
    }
  }

  // The product the fields describe: the row that is picked, else what the
  // grocery is linked to. Its pack, size words, regular price and deal words
  // are what a correction typed over it inherits.
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
  // The product's own page at the shop, as the fields hold it: prefilled from
  // the product they describe, or typed. Only a web address is one.
  const pageUrl = trimmedUrl !== "" && !urlInvalid ? trimmedUrl : null;
  // The pack the fields hold: an amount and a unit, prefilled from the product
  // they describe or typed, and by weight where that product was.
  const typedByWeight = selectedPack?.byWeight ?? false;
  const typedPack: PackSize | null =
    quantityTyped && unitTyped && !packInvalid && isUnitId(manualPackUnit)
      ? { quantity: typedQuantity, unit: manualPackUnit, byWeight: typedByWeight }
      : null;

  // A price typed over a by-hand product corrects that product — the one the
  // shopper made earlier for this name, or one they picked from what the Store
  // knows — rather than adding a second beside it. Over anything else it is a
  // new by-hand product, because a price read from a shop's own page is never
  // edited by hand.
  const shown = picked ? (stored.find((product) => product.id === picked) ?? null) : linkedProduct;
  const manualTarget = shown?.isManual ? shown.id : manualId;

  // A price the shopper typed is the choice as soon as it is a price — over a
  // product they picked as readily as over a shop that found nothing, because
  // Norish never overwrites a price it read from a shop's own page. There is
  // nothing to press: the panel's own Save is what commits it. A price typed
  // and then deleted again leaves the row they picked as the choice, since
  // the row still reads as picked.
  const pickedChoice = rows.find((row) => row.key === picked)?.choice ?? null;

  // A correction is of the product it corrects, so it keeps that product's
  // size words, pack, regular price and deal words: the row after Save is the
  // same Sale under a corrected name or price. Whether it is still a Sale is
  // decided by the price typed against the regular one, as everywhere else.
  const heldByHand = hasTypedPrice
    ? `${manualTarget}|${manualName}|${typedPrice}|${currency}|${selectedSize ?? ""}|${JSON.stringify(typedPack)}|${pageUrl ?? ""}|${selectedRegularPrice ?? ""}|${selectedDealWords ?? ""}`
    : `picked|${picked ?? ""}`;
  const handOverByHand = useEffectEvent(() =>
    onChoice(
      hasTypedPrice
        ? {
            kind: "manual",
            id: manualTarget,
            name: manualName.trim() || groceryName,
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
    // Fields the shop's numbers were shown in again start over: whatever is
    // typed over them next is handed to the panel, even if it was before.
    if (!byHand) {
      heldByHandRef.current = "";

      return;
    }
    if (heldByHandRef.current === heldByHand) return;
    heldByHandRef.current = heldByHand;
    handOverByHand();
  }, [byHand, heldByHand]);

  // The pack in words: the shop's own where it has them and nothing was typed
  // over them, else Norish's for the pack the fields hold.
  const packEdited = JSON.stringify(typedPack) !== JSON.stringify(selectedPack);
  const packDetail =
    typedPack && (packEdited || !selectedSize || (!picked && linkedProduct?.packByHand))
      ? formatPackSize(typedPack, packWords)
      : (selectedSize ?? "");
  // What the details row says is behind it: the price and the pack. The name
  // is in the product field above.
  const detailsSummary = [
    hasTypedPrice ? formatShelfPrice(locale, typedPrice, currency) : currency,
    packDetail,
  ]
    .filter(Boolean)
    .join(" · ");
  const detailsProblem = currencyInvalid
    ? ("currency" as const)
    : urlInvalid
      ? ("url" as const)
      : packInvalid
        ? ("pack" as const)
        : null;

  // Hooks first, and only then: a Store that points at no shop has nothing to
  // ask and nothing to show.
  return {
    pointsAtShop,
    canSearch,
    term,
    onTermInput: (value: string) => {
      setAsked(true);
      setTyped(true);
      setTerm(value);
    },
    ask: () => setAsked(true),
    rows,
    knownRows,
    shopRows,
    picked,
    takeTapped,
    tapRow,
    isSearching,
    noAnswer,
    foundNothing,
    unlinked,
    unlink,
    pageUrl,
    hasTypedPrice,
    typedPrice,
    selectedPack,
    suggestedCurrency,
    manualName,
    manualPrice,
    manualCurrency,
    manualPackQuantity,
    manualPackUnit,
    manualUrl,
    priceInvalid,
    currencyInvalid,
    packInvalid: Boolean(packInvalid),
    urlInvalid,
    detailsSummary,
    detailsProblem,
    editName: (value: string) => {
      setByHand(true);
      setManualName(value);
    },
    editPrice: (value: string) => {
      setByHand(true);
      setManualPrice(value);
    },
    editCurrency: (value: string) => {
      setByHand(true);
      setManualCurrency(value);
    },
    editPackQuantity: (value: string) => {
      setByHand(true);
      setManualPackQuantity(value);
    },
    editPackUnit: (value: string) => {
      setByHand(true);
      setManualPackUnit(value);
    },
    editPageUrl: (value: string) => {
      setByHand(true);
      setManualUrl(value);
    },
  };
}
