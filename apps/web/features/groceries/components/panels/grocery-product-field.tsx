"use client";

import { useState } from "react";
import { PanelComboBoxPopover } from "@/components/Panel/Panel";
import { SalePrice } from "@/features/groceries/components/list/sale-price";
import { usePackSizeWords } from "@/features/groceries/hooks/use-pack-size-words";
import { FIELD_CLASS, FIELD_STYLE } from "@/features/groceries/lib/grocery-field";
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

import type { ProductRow } from "@norish/shared-react/groceries";
import type { StoreDto, StoreProductChoice, StoreProductDto } from "@norish/shared/contracts";
import { useProductField } from "@norish/shared-react/groceries";
import { formatShelfPrice } from "@norish/shared/lib/format-price";

import { GroceryPurchaseAmount } from "./grocery-purchase-amount";
import { ProductDetailsPanel } from "./product-details-panel";

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
 * and saying why, because there is a link to go and correct. The price fields
 * are beneath it from the start, whatever the shop has or has not said: a
 * shopper never waits on a lookup to type what they saw on the shelf, and
 * everything about the product — its name, price, currency, pack and page —
 * is theirs to overwrite behind the details row.
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
  const field = useProductField({
    store,
    groceryName,
    linkedProduct,
    linkPending,
    choice,
    onChoice,
    onValidityChange,
    locale,
    packWords,
  });
  const {
    canSearch,
    term,
    rows,
    knownRows,
    shopRows,
    picked,
    isSearching,
    noAnswer,
    foundNothing,
    unlinked,
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
    packInvalid,
    urlInvalid,
    detailsSummary,
    detailsProblem,
  } = field;
  // The product's details live behind a row of their own, opened the way the recurrence editor is.
  const [detailsOpen, setDetailsOpen] = useState(false);
  const problemText = detailsProblem
    ? t({ currency: "invalidCurrency", url: "invalidUrl", pack: "invalidPack" }[detailsProblem])
    : null;

  // A Store that points at no shop has nothing to ask and nothing to show.
  if (!field.pointsAtShop) return null;

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
        value={picked}
        variant="secondary"
        onInputChange={field.onTermInput}
        onChange={(key) => {
          const row = rows.find((candidate) => candidate.key === String(key));

          if (row) field.takeTapped(row);
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
            onFocus={field.ask}
          />
          <ComboBox.Trigger />
        </ComboBox.InputGroup>
        <PanelComboBoxPopover>
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
                    onPress={() => field.tapRow(row)}
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
                    onPress={() => field.tapRow(row)}
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
        </PanelComboBoxPopover>
      </ComboBox>

      {linkedProduct && !unlinked && (
        <Button
          className="self-start"
          data-testid="product-unlink"
          size="sm"
          variant="outline"
          onPress={field.unlink}
        >
          {t("unlink")}
        </Button>
      )}

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

      {/* What it costs, there from the start: nobody waits on a shop to type a price */}
      {
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
              onChange={field.editPrice}
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
              className={`flex min-w-0 items-center gap-1 text-sm ${problemText ? "text-danger" : "text-muted"}`}
            >
              <span className="truncate">{problemText ?? detailsSummary}</span>
              <ChevronRightIcon aria-hidden className="h-4 w-4 shrink-0" />
            </span>
          </Button>

          <ProductDetailsPanel
            currency={manualCurrency}
            currencyInvalid={currencyInvalid}
            name={manualName}
            open={detailsOpen}
            packInvalid={packInvalid}
            packQuantity={manualPackQuantity}
            packUnit={manualPackUnit}
            pageUrl={manualUrl}
            pageUrlInvalid={urlInvalid}
            price={manualPrice}
            priceInvalid={priceInvalid}
            suggestedCurrency={suggestedCurrency}
            onCurrencyChange={field.editCurrency}
            onNameChange={field.editName}
            onOpenChange={setDetailsOpen}
            onPackQuantityChange={field.editPackQuantity}
            onPackUnitChange={field.editPackUnit}
            onPageUrlChange={field.editPageUrl}
            onPriceChange={field.editPrice}
          />
        </div>
      }
    </div>
  );
}
