"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Input } from "@heroui/react";
import { MagnifyingGlassIcon } from "@heroicons/react/16/solid";
import { useTranslations } from "next-intl";

import Filters from "../shared/filters";

import { useRecipesContext } from "@/context/recipes-context";
import { useRecipesFiltersContext } from "@/context/recipes-filters-context";
import { isUrl } from "@/lib/helpers";

export default function SearchInput() {
  const t = useTranslations("recipes.dashboard");
  const { filters, setFilters } = useRecipesFiltersContext();
  const { importRecipe } = useRecipesContext();
  const [_isPending, startTransition] = useTransition();
  const [inputValue, setInputValue] = useState(filters.rawInput);

  const scheduleFilterUpdate = useCallback(
    (value: string) => {
      startTransition(() => setFilters({ rawInput: value }));
    },
    [setFilters]
  );

  useEffect(() => {
    setInputValue(filters.rawInput);
  }, [filters.rawInput]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;

    setInputValue(rawValue);
    const trimmedValue = rawValue.trim();

    if (isUrl(trimmedValue)) {
      setInputValue("");
      scheduleFilterUpdate("");
      void importRecipe(trimmedValue);
    } else {
      scheduleFilterUpdate(trimmedValue);
    }
  };

  const hasFilters = filters.rawInput.trim().length > 0 || filters.searchTags.length > 0;

  return (
    <div className="flex w-full items-center gap-2">
      <Input
        isClearable
        classNames={{
          inputWrapper: "h-12",
          input: "text-[15px]",
        }}
        id="search-input"
        placeholder={t("searchPlaceholder")}
        radius="full"
        startContent={
          <MagnifyingGlassIcon
            className={`h-5 w-5 ${hasFilters ? "text-primary animate-pulse" : "text-default-400"}`}
          />
        }
        style={{ fontSize: "16px" }}
        value={inputValue}
        variant="flat"
        onChange={handleChange}
        onClear={() => {
          setInputValue("");
          scheduleFilterUpdate("");
        }}
      />
      <Filters isGlass={false} />
    </div>
  );
}
