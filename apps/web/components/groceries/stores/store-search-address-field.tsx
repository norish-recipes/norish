"use client";

import { FIELD_CLASS, FIELD_STYLE } from "@/components/groceries/grocery-field";
import { Input, Label, TextField } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { SearchAddressDerivation } from "@norish/shared/lib/search-address";
import {
  deriveSearchAddress,
  resolveSearchAddress,
  SEARCH_ADDRESS_PLACEHOLDER,
} from "@norish/shared/lib/search-address";

interface StoreSearchAddressFieldProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * What a store's pasted link becomes: the shop's website, and its Search
 * Address when the paste carried one. The user never authors a template —
 * they paste the homepage or a search they just ran — so the derivation is
 * shown rather than demanded, and the field stays theirs to correct.
 */
export function storeLinkFields(value: string): {
  website: string | null;
  searchAddress: string | null;
  /** The term the paste carried, which is what the shop is probed with. */
  term: string | null;
} {
  const derived = deriveSearchAddress(value);

  if (!derived) return { website: null, searchAddress: null, term: null };
  if (derived.kind === "website") {
    return { website: derived.website, searchAddress: null, term: null };
  }

  return { website: derived.website, searchAddress: derived.searchAddress, term: derived.term };
}

/** The Search Address with its slot set apart from the address around it. */
function MarkedAddress({ address }: { address: string }) {
  const [before, after] = address.split(SEARCH_ADDRESS_PLACEHOLDER);

  return (
    <span className="break-all">
      {before}
      <span className="bg-accent/15 text-accent rounded px-1 font-semibold">
        {SEARCH_ADDRESS_PLACEHOLDER}
      </span>
      {after}
    </span>
  );
}

function Preview({
  derived,
  sampleTerm,
}: {
  derived: SearchAddressDerivation;
  sampleTerm: string;
}) {
  const t = useTranslations("groceries.storeManager");

  if (derived.kind === "website") {
    return (
      <>
        <p className="text-muted text-xs">{t("websiteOnly")}</p>
        <p className="text-muted text-xs">
          {t("searchAddressManualHint", { placeholder: SEARCH_ADDRESS_PLACEHOLDER })}
        </p>
      </>
    );
  }

  return (
    <>
      <p className="text-muted text-xs">{t("searchAddressFound")}</p>
      <p className="text-xs" data-testid="search-address-preview">
        <MarkedAddress address={derived.searchAddress} />
      </p>
      <p className="text-muted text-xs break-all">
        {t("searchAddressExample", {
          url: resolveSearchAddress(derived.searchAddress, derived.term ?? sampleTerm),
        })}
      </p>
    </>
  );
}

export function StoreSearchAddressField({ value, onChange }: StoreSearchAddressFieldProps) {
  const t = useTranslations("groceries.storeManager");
  const trimmed = value.trim();
  const derived = trimmed ? deriveSearchAddress(trimmed) : null;

  return (
    <div className="flex flex-col gap-2">
      <TextField value={value} onChange={onChange}>
        <Label>{t("shopLink")}</Label>
        <Input
          className={FIELD_CLASS}
          data-testid="store-shop-link"
          placeholder={t("shopLinkPlaceholder")}
          style={FIELD_STYLE}
          variant="secondary"
        />
      </TextField>
      {!trimmed && <p className="text-muted text-xs">{t("shopLinkHint")}</p>}
      {trimmed && !derived && <p className="text-danger text-xs">{t("linkInvalid")}</p>}
      {derived && <Preview derived={derived} sampleTerm={t("sampleTerm")} />}
    </div>
  );
}
