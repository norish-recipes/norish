import { useEffect, useState } from "react";

import type { PackSize } from "@norish/shared/lib/pack-size";
import { createClientId } from "@norish/shared/lib/operation-helpers";
import { httpUrlSchema } from "@norish/shared/lib/schema";
import { isUnitId } from "@norish/shared/lib/units";

/** The product field's by-hand fields: name, price, currency, pack and page, each held to what it claims. */
export function useTypedProduct(options: {
  groceryName: string;
  /** What the shop most likely charges in, shown while the currency is left empty. */
  suggestedCurrency: string;
  /** Whether the pack the fields describe is sold by weight, which a typed pack keeps. */
  byWeight: boolean;
  onValidityChange?: (valid: boolean) => void;
}) {
  const { groceryName, suggestedCurrency, byWeight, onValidityChange } = options;
  // Whether the fields show the shop's numbers or the shopper's, who owns them once typed over.
  const [byHand, setByHand] = useState(false);
  const [manualPrice, setManualPrice] = useState("");
  const [manualName, setManualName] = useState(groceryName);
  const [manualCurrency, setManualCurrency] = useState("");
  const [manualPackQuantity, setManualPackQuantity] = useState("");
  const [manualPackUnit, setManualPackUnit] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [manualId] = useState(createClientId);

  const currency = (manualCurrency.trim() || suggestedCurrency).toUpperCase();
  const typedPrice = Number(manualPrice.replace(",", "."));
  // A price is a number not below nothing, a currency three letters; an empty field is never wrong.
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

  useEffect(() => {
    onValidityChange?.(valid);
  }, [valid, onValidityChange]);

  // A field taken away (the Store swapped, the next grocery begun) takes its complaint with it.
  useEffect(() => () => onValidityChange?.(true), [onValidityChange]);

  const typedPack: PackSize | null =
    quantityTyped && unitTyped && !packInvalid && isUnitId(manualPackUnit)
      ? { quantity: typedQuantity, unit: manualPackUnit, byWeight }
      : null;
  const typing = (set: (value: string) => void) => (value: string) => {
    setByHand(true);
    set(value);
  };

  return {
    byHand,
    manualId,
    manualName,
    manualPrice,
    manualCurrency,
    manualPackQuantity,
    manualPackUnit,
    manualUrl,
    currency,
    typedPrice,
    typedPack,
    priceInvalid,
    currencyInvalid,
    urlInvalid,
    packInvalid: Boolean(packInvalid),
    hasTypedPrice: manualPrice.trim() !== "" && !priceInvalid && !currencyInvalid,
    // Only a web address is a product page.
    pageUrl: trimmedUrl !== "" && !urlInvalid ? trimmedUrl : null,
    /** The fields say what this is and costs, until somebody types over them. */
    show: (
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
    },
    /** Every field but the name empties, and is the shop's again. */
    clear: () => {
      setByHand(false);
      setManualPrice("");
      setManualCurrency("");
      setManualPackQuantity("");
      setManualPackUnit("");
      setManualUrl("");
    },
    showName: setManualName,
    editName: typing(setManualName),
    editPrice: typing(setManualPrice),
    editCurrency: typing(setManualCurrency),
    editPackQuantity: typing(setManualPackQuantity),
    editPackUnit: typing(setManualPackUnit),
    editPageUrl: typing(setManualUrl),
  };
}
