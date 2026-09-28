"use client";

import { useEffect, useState } from "react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { Input, TextField } from "@heroui/react";
import { useTranslations } from "next-intl";
import { useDebounceValue } from "usehooks-ts";

/** How long typing pauses before the list is searched again, as on the dashboard. */
const SEARCH_DELAY_MS = 300;

/**
 * The search field of the Ingredients page. It owns what is being typed, so
 * a keystroke re-renders this field alone, and hands the page the search
 * once typing pauses: the page, and the fifty rows under it, re-render only
 * then. `busy` pulses the icon while the page is fetching or settling.
 */
export function IngredientSearch({
  busy,
  onSearch,
}: {
  busy: boolean;
  onSearch: (search: string) => void;
}) {
  const t = useTranslations("settings.ingredients");
  const [text, setText] = useState("");
  const [search] = useDebounceValue(text.trim(), SEARCH_DELAY_MS);

  useEffect(() => {
    onSearch(search);
  }, [search, onSearch]);

  return (
    <TextField
      aria-label={t("search")}
      className="relative min-w-0 flex-1"
      value={text}
      onChange={setText}
    >
      <MagnifyingGlassIcon
        aria-hidden
        className={`pointer-events-none absolute top-1/2 left-3 z-10 h-5 w-5 -translate-y-1/2 ${
          busy ? "text-accent animate-pulse" : "text-muted"
        }`}
        data-fetching={busy}
        data-testid="ingredients-searching"
      />
      <Input
        className="pl-10"
        data-testid="ingredients-search"
        placeholder={t("search")}
        variant="secondary"
      />
    </TextField>
  );
}
