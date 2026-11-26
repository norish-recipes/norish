"use client";

import { SearchField } from "@/components/shared/search-field";
import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { ContentList } from "@norish/shared-react/lists";

/** The search field and the All or Unused toggle over a list of entries; the loading list draws it off. */
export function ContentToolbar({
  list,
  search,
  onSearch,
  unusedOnly,
  onUnusedOnly,
  isDisabled = false,
}: {
  list: ContentList;
  search: string;
  onSearch: (search: string) => void;
  unusedOnly: boolean;
  onUnusedOnly: (unusedOnly: boolean) => void;
  isDisabled?: boolean;
}) {
  const t = useTranslations("settings.content");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <SearchField
        data-testid="content-search"
        isDisabled={isDisabled}
        label={t(`search.${list}`)}
        value={search}
        onChange={onSearch}
      />
      <ToggleButtonGroup
        aria-label={t("show")}
        disallowEmptySelection
        isDisabled={isDisabled}
        selectedKeys={[unusedOnly ? "unused" : "all"]}
        selectionMode="single"
        size="sm"
        onSelectionChange={(keys) => onUnusedOnly(keys.has("unused"))}
      >
        <ToggleButton data-testid="content-show-all" id="all">
          {t("all")}
        </ToggleButton>
        <ToggleButton data-testid="content-show-unused" id="unused">
          <ToggleButtonGroup.Separator />
          {t("unused")}
        </ToggleButton>
      </ToggleButtonGroup>
    </div>
  );
}
