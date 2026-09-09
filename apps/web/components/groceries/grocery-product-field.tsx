"use client";

import type { PackSizeWords } from "@/lib/format-price";
import { useCallback, useEffect, useRef, useState } from "react";
import { FIELD_CLASS, FIELD_STYLE } from "@/components/groceries/grocery-field";
import { GroceryPurchaseAmount } from "@/components/groceries/grocery-purchase-amount";
import { ProductDetailsPanel } from "@/components/groceries/product-details-panel";
import { SalePrice } from "@/components/groceries/sale-price";
import { usePanelPortalContainer } from "@/components/Panel/Panel";
import { useShopSearch, useStoreProducts } from "@/hooks/stores";
import { usePackSizeWords } from "@/hooks/stores/use-pack-size-words";
import { formatPackSize, formatShelfPrice } from "@/lib/format-price";
import { ArrowTopRightOnSquareIcon, ChevronRightIcon } from "@heroicons/react/16/solid";
import {
  Button,
  ComboBox,
  FieldError,
  Header,
  Input,
  Label,
  ListBox,
  TextField,
} from "@heroui/react";
import { useLocale, useTranslations } from "next-intl";

import type { StoreDto, StoreProductChoice, StoreProductDto } from "@norish/shared/contracts";
import type { PricedCandidate } from "@norish/shared/lib/currency";
import type { PackSize } from "@norish/shared/lib/pack-size";
import { chooseUnmistakable, distinctProducts } from "@norish/shared/lib/auto-link";
import { currencyForUrl, isPriced } from "@norish/shared/lib/currency";
import { nameWords } from "@norish/shared/lib/normalized-name";
import { createClientId } from "@norish/shared/lib/operation-helpers";
import { packSizeOf } from "@norish/shared/lib/pack-size";
import { saleRegularPrice } from "@norish/shared/lib/sale";

/** How long a shopper stops typing before the shop is asked. */
const SEARCH_DEBOUNCE_MS = 400;

interface GroceryProductFieldProps {
  store: StoreDto;
  itemName?: string;
  purchaseAmount?: number | null;
  onPurchaseAmount?: (amount: number | null) => void;
  /** The grocery's name as it will be stored; the Product Link is keyed by it. */
  groceryName: string;
  /** What this grocery is linked to now, which is what the field opens reading. */
  linkedProduct: StoreProductDto | null;
  /**
   * Whether that is still being read. While it is, `linkedProduct` being null
   * says nothing, and the field neither asks the shop about the name nor takes
   * a product for it: the answer may already exist.
   */
  linkPending?: boolean;
  choice: StoreProductChoice | null;
  onChoice: (choice: StoreProductChoice | null) => void;
  /**
   * Whether what is typed by hand could be saved: a price that is a price, a
   * currency of three letters. The panel's own Save waits on it, so a slip is
   * corrected here rather than quietly dropped on the way to the database.
   */
  onValidityChange?: (valid: boolean) => void;
}

/** One row of the dropdown, whichever list it came from. */
interface ProductRow {
  key: string;
  name: string;
  /** The shop's size words, or else Norish's own for the pack. */
  packWords: string | null;
  /** The product's own page at the shop, where it was read from one. */
  pageUrl: string | null;
  price: number;
  currency: string;
  size: string | null;
  /** What one Shelf Price buys, as read or as set by hand. */
  pack: PackSize | null;
  /** The regular price the shop struck through, where this is a Sale. */
  regularPrice: number | null;
  /** The shop's own words for its deal, on Sale or not. */
  dealWords: string | null;
  choice: StoreProductChoice;
}

/** The shop's size words, or else Norish's own for the pack. */
function packWordsOf(
  size: string | null | undefined,
  pack: PackSize | null | undefined,
  words: PackSizeWords
): string | null {
  return size ?? (pack ? formatPackSize(pack, words) : null);
}

function candidateRow(candidate: PricedCandidate, words: PackSizeWords): ProductRow {
  return {
    key: candidate.url,
    name: candidate.name,
    packWords: packWordsOf(candidate.size, candidate.pack, words),
    pageUrl: candidate.url,
    price: candidate.price,
    currency: candidate.currency,
    size: candidate.size ?? null,
    pack: candidate.pack ?? null,
    regularPrice: saleRegularPrice(candidate.price, candidate.regularPrice),
    dealWords: candidate.dealWords ?? null,
    choice: { kind: "candidate", candidate },
  };
}

function productRow(product: StoreProductDto, words: PackSizeWords): ProductRow {
  const pack = packSizeOf(product);

  return {
    key: product.id,
    name: product.name,
    packWords: packWordsOf(product.size, pack, words),
    pageUrl: product.pageUrl,
    price: product.price,
    currency: product.currency,
    size: product.size,
    pack,
    regularPrice: saleRegularPrice(product.price, product.regularPrice),
    dealWords: product.dealWords,
    choice: { kind: "product", storeProductId: product.id },
  };
}

/**
 * One row of the dropdown: the name, and beside it the price the way the row
 * shows it — struck regular price and a chip on a Sale — and the pack.
 */
function RowContent({
  row,
  locale,
  regularPriceLabel,
}: {
  row: ProductRow;
  locale: string;
  regularPriceLabel: (price: string) => string;
}) {
  const regular =
    row.regularPrice === null ? null : formatShelfPrice(locale, row.regularPrice, row.currency);

  return (
    <div className="flex w-full items-center justify-between gap-3">
      <span className="min-w-0 flex-1 truncate">{row.name}</span>
      <span className="text-muted shrink-0 text-xs tabular-nums">
        <SalePrice
          price={formatShelfPrice(locale, row.price, row.currency)}
          regular={regular}
          regularLabel={regular === null ? undefined : regularPriceLabel(regular)}
          testIds={{
            sale: "product-option-sale",
            words: "product-option-words",
            regular: "product-option-regular",
          }}
          words={row.dealWords}
        />
        {row.packWords ? ` · ${row.packWords}` : ""}
      </span>
    </div>
  );
}

/** Which row the held choice is, so the field reads what is linked. */
function selectedKey(choice: StoreProductChoice | null): string | null {
  if (choice?.kind === "product") return choice.storeProductId;
  if (choice?.kind === "candidate") return choice.candidate.url;

  return null;
}

/**
 * Whether a product the Store already stored is an answer to this question.
 * The shop filters its own answers; nothing filters what the Store has lying
 * around, so a search for "cola" must not hand back last week's cheese. The
 * words are the auto-link rule's own, so the two never disagree on what a word is.
 */
function answers(name: string, term: string): boolean {
  const asked = nameWords(term);

  if (asked.length === 0) return true;
  const has = nameWords(name);

  // A long enough word may sit inside one of the name's own — "cola" answers
  // "Coca-Cola" — but a short one must be a word in its own right, or the "l"
  // of "1 L" would answer every question with an l in it.
  return asked.some((word) =>
    word.length < 3 ? has.includes(word) : has.some((part) => part.includes(word))
  );
}

/**
 * Which of the shop's products this grocery is, as a field of the grocery
 * panel like any other: it reads what the grocery is linked to now, asks the
 * shop as you type, and drops down what it answered with the price beside it.
 *
 * The dropdown says where each row came from, because the two are not the same
 * kind of fact: what the Store already knows is there instantly and is what
 * next week's list will be priced from, while the shop's own answers are being
 * read right now and take as long as that shop takes.
 *
 * The shop has already filtered, so its answers are never filtered again here
 * — a search for "beleg" that answers "Oude kaas" must still offer it. What the
 * Store has stored was filtered by nobody, so it is held against the question.
 *
 * The shop itself is visited only for a question nobody has answered: the
 * grocery's own name while it is unlinked, or something typed. Opening a
 * grocery to rename it must not send anyone's household to a supermarket.
 *
 * A Store with no shop behind it has no such field at all — pricing is
 * something a Store gains, and an ordinary Store is a heading. A Store that
 * points at a shop Norish could not make a search out of keeps the field, dead
 * and saying why, because there is a link to go and correct — and offers the
 * price fields beneath it, because an unreadable shop costs the shopper a
 * price, not the feature.
 *
 * Nothing here writes anything: the choice is held by the panel and committed
 * by its own Save or Add, because writing on tap reads as "it saved without me
 * saving".
 */
export function GroceryProductField({
  store,
  itemName,
  purchaseAmount,
  onPurchaseAmount,
  groceryName,
  linkedProduct,
  linkPending = false,
  choice,
  onChoice,
  onValidityChange,
}: GroceryProductFieldProps) {
  const t = useTranslations("groceries.picker");
  const tPrice = useTranslations("groceries.price");
  const locale = useLocale();
  const packWords = usePackSizeWords();
  const portalContainer = usePanelPortalContainer();
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
  const [manualPrice, setManualPrice] = useState("");
  const [manualName, setManualName] = useState(groceryName);
  const [manualCurrency, setManualCurrency] = useState("");
  const [manualId] = useState(createClientId);
  // The product's name, currency and pack live behind a row of their own,
  // opened the way the recurrence editor is: what a shopper touches every
  // time stays on the panel, what they correct once a year does not.
  const [detailsOpen, setDetailsOpen] = useState(false);
  const heldByHand = useRef("");
  // The name the field itself put in the box. That is an answer, not a
  // question: writing a choice into the input must never send the household
  // back to the shop to ask about the product they have just chosen.
  const answeredWith = useRef<string | null>(null);
  // A row the field took by itself, and whether it took it for the grocery's
  // own name rather than for something the shopper typed here.
  const autoPicked = useRef<{ key: string; forName: boolean } | null>(null);
  const lastName = useRef(groceryName);

  // Until the shopper types, the question is the grocery's own name, which the
  // panel above may still be being filled in; after they type it is what they
  // typed. Either way only once the typing stops: the name field is typed one
  // letter at a time, and a shop is not asked about "k", "ka" and "kaa" on the
  // way to "kaas". Never the linked product's own name: that question is
  // already answered.
  useEffect(() => {
    const next = typed ? term.trim() || groceryName.trim() : groceryName.trim();

    if (typed && answeredWith.current === term) return;
    if (next === searchedTerm) return;
    const timer = setTimeout(() => setSearchedTerm(next), SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [term, groceryName, typed, searchedTerm]);

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
  const valid = !priceInvalid && !currencyInvalid;
  const hasTypedPrice = manualPrice.trim() !== "" && !priceInvalid && !currencyInvalid;

  useEffect(() => {
    onValidityChange?.(valid);
  }, [valid, onValidityChange]);

  // A field that is taken away — the Store swapped, the next grocery begun —
  // takes its complaint with it.
  useEffect(() => () => onValidityChange?.(true), [onValidityChange]);

  /** The fields below say what this costs, until somebody types over them. */
  const showAs = useCallback((name: string, price: number, priceCurrency: string) => {
    setByHand(false);
    setManualName(name);
    setManualPrice(String(price));
    setManualCurrency(priceCurrency);
    heldByHand.current = "";
  }, []);

  /** This row is the answer, however it came to be: tapped, or unmistakable. */
  const take = useCallback(
    (row: ProductRow) => {
      answeredWith.current = row.name;
      setPicked(row.key);
      setTerm(row.name);
      showAs(row.name, row.price, row.currency);
      onChoice(row.choice);
    },
    [onChoice, showAs]
  );

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

  useEffect(() => {
    if (!unmistakable) return;
    autoPicked.current = { key: unmistakable.key, forName: !typed };
    take(unmistakable);
  }, [unmistakable, take, typed]);

  /**
   * The field's own answer, let go of: the question it answered is gone, and
   * so is the question itself, until the typing stops and a new one is asked.
   */
  const untake = useCallback(() => {
    autoPicked.current = null;
    answeredWith.current = null;
    heldByHand.current = "";
    setPicked(null);
    setTerm("");
    setSearchedTerm("");
    setTyped(false);
    setByHand(false);
    setManualPrice("");
    setManualCurrency("");
    onChoice(null);
  }, [onChoice]);

  // A row the field took for the grocery's own name follows that name. A
  // shopper who goes on typing after the field took "kaas" for them is no
  // longer asking about "kaas", so the row is let go and the new name is held
  // against the rows afresh — or the shop is asked again. A row the shopper
  // tapped, or one taken for a term they typed here, is theirs and stays.
  useEffect(() => {
    if (lastName.current === groceryName) return;
    lastName.current = groceryName;
    if (autoPicked.current?.forName) untake();
  }, [groceryName, untake]);

  useEffect(() => {
    setTerm(opensWith);
  }, [opensWith]);

  // Read by the effect below without being a reason for it to run: a tap sets
  // `picked` and the fields in the same breath, and must not be undone by it.
  const pickedRef = useRef(picked);

  useEffect(() => {
    pickedRef.current = picked;
  }, [picked]);

  // What the grocery is linked to now is what the fields open reading, so the
  // panel has its whole shape from the first frame. A name with nothing linked
  // and nothing picked has no price to show yet — not the last name's.
  useEffect(() => {
    if (byHand) return;
    if (linkedProduct) {
      setManualName(linkedProduct.name);
      setManualPrice(String(linkedProduct.price));
      setManualCurrency(linkedProduct.currency);

      return;
    }
    setManualName(groceryName);
    if (!pickedRef.current) {
      setManualPrice("");
      setManualCurrency("");
    }
  }, [byHand, groceryName, linkedProduct]);

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
  // The product's own page at the shop, for the product the fields describe;
  // a product typed by hand has none anywhere.
  const pageUrl = picked ? (selectedRow?.pageUrl ?? null) : (linkedProduct?.pageUrl ?? null);

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
  useEffect(() => {
    if (!byHand) return;
    const packWords = JSON.stringify(selectedPack);
    const held = hasTypedPrice
      ? `${manualTarget}|${manualName}|${typedPrice}|${currency}|${selectedSize ?? ""}|${packWords}|${selectedRegularPrice ?? ""}|${selectedDealWords ?? ""}`
      : `picked|${picked ?? ""}`;

    if (heldByHand.current === held) return;
    heldByHand.current = held;
    onChoice(
      hasTypedPrice
        ? {
            kind: "manual",
            id: manualTarget,
            name: manualName.trim() || groceryName,
            price: typedPrice,
            currency,
            size: selectedSize ?? null,
            pack: selectedPack,
            regularPrice: saleRegularPrice(typedPrice, selectedRegularPrice),
            dealWords: selectedDealWords,
          }
        : pickedChoice
    );
  }, [
    byHand,
    hasTypedPrice,
    manualName,
    typedPrice,
    currency,
    groceryName,
    manualTarget,
    onChoice,
    picked,
    pickedChoice,
    selectedSize,
    selectedPack,
    selectedRegularPrice,
    selectedDealWords,
  ]);

  const packDetail =
    selectedPack && (!selectedSize || (!picked && linkedProduct?.packByHand))
      ? formatPackSize(selectedPack, packWords)
      : (selectedSize ?? "");
  // What the details row says is behind it: the currency and the pack, which
  // nothing else on the panel shows. The name is in the product field above.
  const detailsSummary = [currency, packDetail].filter(Boolean).join(" · ");

  // The fields are the answer to "what does this cost", so they are there
  // whenever there is an answer to show or one to be typed — and always for a
  // shop that cannot be searched, where typing one is the only way to a price.
  const showsPrice =
    Boolean(picked) || Boolean(linkedProduct) || foundNothing || noAnswer || byHand || !canSearch;

  // Hooks first, and only then: a Store that points at no shop has nothing to
  // ask and nothing to show.
  if (!pointsAtShop) return null;

  return (
    <div className="flex flex-col gap-2">
      <ComboBox
        allowsEmptyCollection
        inputValue={term}
        isDisabled={!canSearch}
        // The rows are the answer already: the shop filtered its own products,
        // and what the Store had lying around was held against the question
        // above. Handing the rows over says so, and a ComboBox told its list is
        // filtered leaves the collection exactly as this component built it.
        items={rows}
        menuTrigger="focus"
        selectedKey={picked}
        variant="secondary"
        onInputChange={(value) => {
          setAsked(true);
          setTyped(true);
          setTerm(value);
        }}
        onSelectionChange={(key) => {
          const row = rows.find((candidate) => candidate.key === String(key));

          if (!row) return;
          autoPicked.current = null;
          take(row);
        }}
      >
        <div className="flex items-baseline justify-between gap-3">
          <Label>{t("productLabel", { store: store.name })}</Label>
          {pageUrl && (
            <a
              className="text-accent inline-flex shrink-0 items-center gap-1 text-xs font-medium hover:underline"
              data-testid="product-page-link"
              href={pageUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              {t("openPage", { store: store.name })}
              <ArrowTopRightOnSquareIcon aria-hidden className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
        <ComboBox.InputGroup>
          <Input
            className={FIELD_CLASS}
            data-testid="grocery-product-field"
            placeholder={canSearch ? t("searchPlaceholder") : t("cannotSearch")}
            style={FIELD_STYLE}
            onFocus={() => setAsked(true)}
          />
          <ComboBox.Trigger />
        </ComboBox.InputGroup>
        <ComboBox.Popover UNSTABLE_portalContainer={portalContainer}>
          <ListBox renderEmptyState={() => null}>
            {knownRows.length > 0 && (
              <ListBox.Section>
                <Header className="text-muted px-2 py-1 text-xs" data-testid="product-group-known">
                  {t("knownGroup")}
                </Header>
                {knownRows.map((row) => (
                  <ListBox.Item
                    key={row.key}
                    data-testid="product-option"
                    id={row.key}
                    textValue={row.name}
                  >
                    <RowContent
                      locale={locale}
                      regularPriceLabel={(price) => tPrice("regularPrice", { price })}
                      row={row}
                    />
                  </ListBox.Item>
                ))}
              </ListBox.Section>
            )}
            {(isSearching || shopRows.length > 0) && (
              <ListBox.Section>
                <Header className="text-muted px-2 py-1 text-xs" data-testid="product-group-shop">
                  {isSearching ? t("searching", { store: store.name }) : t("shopGroup")}
                </Header>
                {shopRows.map((row) => (
                  <ListBox.Item
                    key={row.key}
                    data-testid="product-option"
                    id={row.key}
                    textValue={row.name}
                  >
                    <RowContent
                      locale={locale}
                      regularPriceLabel={(price) => tPrice("regularPrice", { price })}
                      row={row}
                    />
                  </ListBox.Item>
                ))}
              </ListBox.Section>
            )}
          </ListBox>
        </ComboBox.Popover>
      </ComboBox>

      {!canSearch && (
        <p className="text-muted text-xs" data-testid="product-cannot-search">
          {t("cannotSearchHint", { store: store.name })}
        </p>
      )}

      {isSearching && (
        <p className="text-muted text-xs" data-testid="product-searching">
          {t("searching", { store: store.name })}
        </p>
      )}

      {showsPrice && (
        <div className="flex flex-col gap-3 pt-1" data-testid="product-by-hand">
          {foundNothing && !picked && (
            <p className="text-muted text-xs">{t("nothingFound", { store: store.name })}</p>
          )}
          {noAnswer && !picked && (
            <p className="text-muted text-xs" data-testid="product-no-answer">
              {t("noAnswer", { store: store.name })}
            </p>
          )}
          <div className="flex gap-3">
            {onPurchaseAmount && (
              <GroceryPurchaseAmount
                product={{
                  price: hasTypedPrice ? typedPrice : 0,
                  pack: selectedPack,
                }}
                raw={itemName ?? groceryName}
                value={purchaseAmount}
                onChange={onPurchaseAmount}
              />
            )}
            <TextField
              className="flex-1"
              isInvalid={priceInvalid}
              value={manualPrice}
              onChange={(value) => {
                setByHand(true);
                setManualPrice(value);
              }}
            >
              <Label>{t("byHandPrice")}</Label>
              <Input
                className={FIELD_CLASS}
                data-testid="product-by-hand-price"
                inputMode="decimal"
                placeholder="0.00"
                style={FIELD_STYLE}
                variant="secondary"
              />
              {priceInvalid && (
                <FieldError data-testid="product-price-error">{t("invalidPrice")}</FieldError>
              )}
            </TextField>
          </div>
          {purchaseAmount != null && onPurchaseAmount && (
            <Button
              className="self-start"
              size="sm"
              variant="outline"
              onPress={() => onPurchaseAmount(null)}
            >
              {t("useCalculatedAmount")}
            </Button>
          )}

          {/* The product's own details, behind a row that says what is there */}
          <Button
            fullWidth
            className="h-12 justify-between rounded-full px-4 text-base font-normal"
            data-testid="product-details"
            variant="tertiary"
            onPress={() => setDetailsOpen(true)}
          >
            <span className="shrink-0">{t("productDetails")}</span>
            <span
              className={`flex min-w-0 items-center gap-1 text-sm ${currencyInvalid ? "text-danger" : "text-muted"}`}
            >
              <span className="truncate">
                {currencyInvalid ? t("invalidCurrency") : detailsSummary}
              </span>
              <ChevronRightIcon aria-hidden className="h-4 w-4 shrink-0" />
            </span>
          </Button>

          <ProductDetailsPanel
            currency={manualCurrency}
            currencyInvalid={currencyInvalid}
            name={manualName}
            open={detailsOpen}
            pack={packDetail}
            suggestedCurrency={suggestedCurrency}
            onCurrencyChange={(value) => {
              setByHand(true);
              setManualCurrency(value);
            }}
            onNameChange={(value) => {
              setByHand(true);
              setManualName(value);
            }}
            onOpenChange={setDetailsOpen}
          />
        </div>
      )}
    </div>
  );
}
