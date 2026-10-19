"use client";

import { useRouter } from "next/navigation";
import CreateRecipeButton from "@/components/dashboard/create-recipe-button";
import FloatingRecipeChip from "@/components/dashboard/floating-recipe-chip";
import LibraryHeading from "@/components/dashboard/library-heading";
import LibraryTypeChips from "@/components/dashboard/library-type-chips";
import LibraryView from "@/components/dashboard/library-view";
import RecipeViewModeToggle, {
  RecipeViewModeTabs,
} from "@/components/dashboard/recipe-view-mode-toggle";
import SearchInput from "@/components/dashboard/search-input";
import TodaysMeals from "@/components/dashboard/today/todays-meals";
import { usePermissionsContext } from "@/context/permissions-context";
import { PhotoIcon } from "@heroicons/react/16/solid";
import { Button, Tabs } from "@heroui/react";
import { useTranslations } from "next-intl";

import { cssHeaderControl, cssHeaderIcon } from "@norish/web/config/css-tokens";

const LIBRARY_HEADING_ID = "recipe-library-heading";

function BulkImageImportButton() {
  const router = useRouter();
  const t = useTranslations("recipes.dashboard");
  const { isAIEnabled } = usePermissionsContext();

  if (!isAIEnabled) return null;

  return (
    <Button
      aria-label={t("bulkImageImport")}
      className={`rounded-full font-medium max-md:px-0 md:px-3 ${cssHeaderControl}`}
      data-testid="bulk-image-import-button"
      size="md"
      variant="secondary"
      onPress={() => router.push("/recipes/import")}
    >
      <PhotoIcon className={cssHeaderIcon} />
      <span className="hidden md:inline">{t("bulkImageImport")}</span>
    </Button>
  );
}

function RecipeLibrary() {
  return (
    <section aria-labelledby={LIBRARY_HEADING_ID} className="flex min-h-0 flex-1 flex-col">
      <RecipeViewModeTabs>
        <div className="flex shrink-0 flex-col gap-4">
          <div className="flex min-h-10 flex-wrap items-center justify-between gap-3">
            <LibraryHeading id={LIBRARY_HEADING_ID} />
            <div className="flex items-center gap-2">
              <RecipeViewModeToggle />
              <BulkImageImportButton />
              <CreateRecipeButton />
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <SearchInput />
            <LibraryTypeChips />
          </div>
        </div>

        <Tabs.Panel className="mt-0 min-h-0 flex-1 p-0" id="grid">
          <LibraryView variant="grid" />
        </Tabs.Panel>
        <Tabs.Panel className="mt-0 min-h-0 flex-1 p-0" id="list">
          <LibraryView variant="list" />
        </Tabs.Panel>
      </RecipeViewModeTabs>
    </section>
  );
}

/** The dashboard surface shared by the Live route and Offline bootstrap. */
export function Dashboard() {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-8">
      <TodaysMeals />
      <RecipeLibrary />
      <FloatingRecipeChip />
    </div>
  );
}
