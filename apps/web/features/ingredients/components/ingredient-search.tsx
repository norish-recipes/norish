"use client";

import type { ReactNode } from "react";
import { useEffect, useEffectEvent, useState } from "react";
import { SearchField } from "@/components/shared/search-field";
import { useTranslations } from "next-intl";
import { useDebounceValue } from "usehooks-ts";

/** How long typing pauses before the list is searched again, as on the dashboard. */
const SEARCH_DELAY_MS = 300;

/** The search field holds the typed text; only the debounced search re-renders the page. */
export function IngredientSearch({
  busy,
  onSearch,
  suffix,
}: {
  busy: boolean;
  onSearch: (search: string) => void;
  suffix?: ReactNode;
}) {
  const t = useTranslations("settings.ingredients");
  const [text, setText] = useState("");
  const [search] = useDebounceValue(text.trim(), SEARCH_DELAY_MS);

  // Handed on when the search changes, not when the page hands a new callback.
  const handOn = useEffectEvent(onSearch);

  useEffect(() => {
    handOn(search);
  }, [search]);

  return (
    <SearchField
      busy={busy}
      data-testid="ingredients-search"
      iconTestId="ingredients-searching"
      label={t("search")}
      suffix={suffix}
      value={text}
      onChange={setText}
    />
  );
}
