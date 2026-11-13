"use client";

import type { ReactNode } from "react";
import { useEffect, useEffectEvent, useState } from "react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { InputGroup, TextField } from "@heroui/react";
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
    <TextField aria-label={t("search")} className="min-w-0 flex-1" value={text} onChange={setText}>
      <InputGroup variant="secondary">
        <InputGroup.Prefix className="pl-3">
          <MagnifyingGlassIcon
            aria-hidden
            className={`size-5 ${busy ? "text-accent animate-pulse" : "text-muted"}`}
            data-fetching={busy}
            data-testid="ingredients-searching"
          />
        </InputGroup.Prefix>
        <InputGroup.Input data-testid="ingredients-search" placeholder={t("search")} />
        {suffix ? <InputGroup.Suffix className="pr-1">{suffix}</InputGroup.Suffix> : null}
      </InputGroup>
    </TextField>
  );
}
