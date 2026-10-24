"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { InputGroup, TextField } from "@heroui/react";
import { useTranslations } from "next-intl";
import { useDebounceValue } from "usehooks-ts";

const SEARCH_DELAY_MS = 300;

export function EquipmentSearch({
  busy,
  onSearch,
  suffix,
}: {
  busy: boolean;
  onSearch: (search: string) => void;
  suffix?: ReactNode;
}) {
  const t = useTranslations("settings.equipment");
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
            data-testid="equipment-searching"
          />
        </InputGroup.Prefix>
        <InputGroup.Input data-testid="equipment-search" placeholder={t("search")} />
        {suffix ? <InputGroup.Suffix className="pr-1">{suffix}</InputGroup.Suffix> : null}
      </InputGroup>
    </TextField>
  );
}
