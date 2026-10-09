"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { InputGroup, TextField } from "@heroui/react";
import { useTranslations } from "next-intl";
import { useDebounceValue } from "usehooks-ts";

/** How long typing pauses before the list is searched again, as on the dashboard. */
const SEARCH_DELAY_MS = 300;

/**
 * The search field of the Ingredients page. It owns what is being typed, so
 * a keystroke re-renders this field alone, and hands the page the search
 * once typing pauses: the page, and the fifty rows under it, re-render only
 * then. `busy` pulses the icon while the page is fetching or settling.
 * `suffix` sits inside the field's end, as the Pantry's add button does.
 */
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

  useEffect(() => {
    onSearch(search);
  }, [search, onSearch]);

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
