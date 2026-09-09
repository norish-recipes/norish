"use client";

import { FIELD_CLASS, FIELD_STYLE } from "@/components/groceries/grocery-field";
import Panel from "@/components/Panel/Panel";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { FieldError, Input, Label, TextField } from "@heroui/react";
import { useTranslations } from "next-intl";

interface ProductDetailsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  onNameChange: (name: string) => void;
  currency: string;
  onCurrencyChange: (currency: string) => void;
  /** Whether what is typed for the currency is not one; the field says so. */
  currencyInvalid: boolean;
  /** What the shop is most likely to charge in, shown where nothing is typed. */
  suggestedCurrency: string;
  /** The pack in words, read-only; empty where the product has none. */
  pack: string;
}

/**
 * The product's own details, in a panel of their own the way the recurrence
 * editor is: what a shopper corrects once in a while stays off the grocery
 * panel, which keeps what they touch every time. Nothing here writes
 * anything; the grocery panel's own Save does.
 */
export function ProductDetailsPanel({
  open,
  onOpenChange,
  name,
  onNameChange,
  currency,
  onCurrencyChange,
  currencyInvalid,
  suggestedCurrency,
  pack,
}: ProductDetailsPanelProps) {
  const t = useTranslations("groceries.picker");
  const tActions = useTranslations("common.actions");

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
          <div className="flex gap-3">
            <TextField
              className="w-32 shrink-0"
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
            {pack && (
              <TextField isReadOnly className="min-w-0 flex-1" value={pack}>
                <Label>{t("packSize")}</Label>
                <Input
                  className={FIELD_CLASS}
                  data-testid="product-pack-size"
                  style={FIELD_STYLE}
                  variant="secondary"
                />
              </TextField>
            )}
          </div>
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
