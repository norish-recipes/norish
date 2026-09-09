"use client";

import type { Key } from "react";
import { FIELD_CLASS, FIELD_STYLE } from "@/components/groceries/grocery-field";
import Panel, { usePanelPortalContainer } from "@/components/Panel/Panel";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { FieldError, Input, Label, ListBox, Select, TextField } from "@heroui/react";
import { useTranslations } from "next-intl";

import { UNIT_IDS, unitLabel } from "@norish/shared/lib/units";

const NO_UNIT = "none";

interface ProductDetailsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  onNameChange: (name: string) => void;
  price: string;
  onPriceChange: (price: string) => void;
  /** Whether what is typed for the price is not one; the field says so. */
  priceInvalid: boolean;
  currency: string;
  onCurrencyChange: (currency: string) => void;
  /** Whether what is typed for the currency is not one; the field says so. */
  currencyInvalid: boolean;
  /** What the shop is most likely to charge in, shown where nothing is typed. */
  suggestedCurrency: string;
  /** The Pack Size — what one Shelf Price buys — as an amount and a unit of the unit table. */
  packQuantity: string;
  onPackQuantityChange: (quantity: string) => void;
  packUnit: string;
  onPackUnitChange: (unit: string) => void;
  /** Whether the pack is half typed, or its amount is not one; the field says so. */
  packInvalid: boolean;
  /** The product's own page at the shop, where there is one to give. */
  pageUrl: string;
  onPageUrlChange: (pageUrl: string) => void;
  /** Whether what is typed for the page is not a web address; the field says so. */
  pageUrlInvalid: boolean;
}

/**
 * Everything about the product, in a panel of its own the way the recurrence
 * editor is: its name, what it costs and in what, what one price buys, and
 * its page at the shop — all of it the shopper's to overwrite, since a
 * shop's reading is a starting point and never the last word. What a shopper
 * touches every time stays on the grocery panel; what they correct once in a
 * while lives here. Nothing here writes anything; the grocery panel's own
 * Save does.
 */
export function ProductDetailsPanel({
  open,
  onOpenChange,
  name,
  onNameChange,
  price,
  onPriceChange,
  priceInvalid,
  currency,
  onCurrencyChange,
  currencyInvalid,
  suggestedCurrency,
  packQuantity,
  onPackQuantityChange,
  packUnit,
  onPackUnitChange,
  packInvalid,
  pageUrl,
  onPageUrlChange,
  pageUrlInvalid,
}: ProductDetailsPanelProps) {
  const t = useTranslations("groceries.picker");
  const tActions = useTranslations("common.actions");
  const portalContainer = usePanelPortalContainer();
  const handleUnitChange = (value: Key | null) => {
    const key = value?.toString() ?? NO_UNIT;

    onPackUnitChange(key === NO_UNIT ? "" : key);
  };

  return (
    <Panel
      nested
      className="contents"
      open={open}
      title={t("productDetails")}
      onOpenChange={onOpenChange}
    >
      <Panel.Body>
        <div className="flex flex-col gap-3">
          <TextField value={name} onChange={onNameChange}>
            <Label>{t("byHandName")}</Label>
            <Input
              className={FIELD_CLASS}
              data-testid="product-by-hand-name"
              style={FIELD_STYLE}
              variant="secondary"
            />
          </TextField>

          {/* What it costs, and in what */}
          <div className="flex gap-3">
            <TextField
              className="min-w-0 flex-1"
              isInvalid={priceInvalid}
              value={price}
              onChange={onPriceChange}
            >
              <Label>{t("byHandPrice")}</Label>
              <Input
                className={FIELD_CLASS}
                data-testid="product-details-price"
                inputMode="decimal"
                placeholder="0.00"
                style={FIELD_STYLE}
                variant="secondary"
              />
              {priceInvalid && (
                <FieldError data-testid="product-details-price-error">
                  {t("invalidPrice")}
                </FieldError>
              )}
            </TextField>
            <TextField
              className="w-28 shrink-0"
              isInvalid={currencyInvalid}
              value={currency}
              onChange={onCurrencyChange}
            >
              <Label>{t("byHandCurrency")}</Label>
              <Input
                autoCapitalize="characters"
                className={FIELD_CLASS}
                data-testid="product-by-hand-currency"
                maxLength={3}
                placeholder={suggestedCurrency}
                style={FIELD_STYLE}
                variant="secondary"
              />
              {currencyInvalid && (
                <FieldError data-testid="product-currency-error">{t("invalidCurrency")}</FieldError>
              )}
            </TextField>
          </div>

          {/* What one price buys: an amount and a unit, or neither */}
          <div className="flex gap-3" data-testid="product-pack-size">
            <TextField
              className="min-w-0 flex-1"
              isInvalid={packInvalid}
              value={packQuantity}
              onChange={onPackQuantityChange}
            >
              <Label>{t("packAmount")}</Label>
              <Input
                className={FIELD_CLASS}
                data-testid="product-pack-quantity"
                inputMode="decimal"
                style={FIELD_STYLE}
                variant="secondary"
              />
              {packInvalid && (
                <FieldError data-testid="product-pack-error">{t("invalidPack")}</FieldError>
              )}
            </TextField>
            <div className="min-w-0 flex-1" data-testid="product-pack-unit">
              <Select
                fullWidth
                selectedKey={packUnit === "" ? NO_UNIT : packUnit}
                variant="secondary"
                onSelectionChange={handleUnitChange}
              >
                <Label>{t("packUnit")}</Label>
                <Select.Trigger className="min-h-12 items-center">
                  <Select.Value className="flex items-center" />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover UNSTABLE_portalContainer={portalContainer}>
                  <ListBox>
                    <ListBox.Item id={NO_UNIT} textValue="—">
                      <span className="text-muted">—</span>
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                    {UNIT_IDS.map((unit) => (
                      <ListBox.Item key={unit} id={unit} textValue={unitLabel(unit)}>
                        <span>{unitLabel(unit)}</span>
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>
          </div>

          {/* The product's page at the shop */}
          <TextField isInvalid={pageUrlInvalid} value={pageUrl} onChange={onPageUrlChange}>
            <Label>{t("productPage")}</Label>
            <Input
              className={FIELD_CLASS}
              data-testid="product-by-hand-page"
              inputMode="url"
              placeholder="https://"
              style={FIELD_STYLE}
              type="url"
              variant="secondary"
            />
            {pageUrlInvalid && (
              <FieldError data-testid="product-page-error">{t("invalidUrl")}</FieldError>
            )}
          </TextField>
        </div>
      </Panel.Body>
      <Panel.Footer>
        <ActionButtonGroup>
          <ActionButton action="done" onPress={() => onOpenChange(false)}>
            {tActions("done")}
          </ActionButton>
        </ActionButtonGroup>
      </Panel.Footer>
    </Panel>
  );
}
