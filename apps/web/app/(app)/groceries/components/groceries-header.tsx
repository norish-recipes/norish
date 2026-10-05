"use client";

import { useRouter } from "next/navigation";
import { ArchiveBoxIcon, ClipboardDocumentListIcon } from "@heroicons/react/20/solid";
import { Tabs } from "@heroui/react";
import { useTranslations } from "next-intl";

import { GroceriesListActions } from "./groceries-page";

export type GroceriesView = "list" | "pantry";

const HREF: Record<GroceriesView, string> = { list: "/groceries", pantry: "/groceries/pantry" };

/**
 * The top of Groceries on both of its views: the view's title, and on the
 * right the _List · Pantry_ switch beside the list's own controls. The switch
 * is the same segmented toggle the Library and a cookbook use; each view has
 * an address of its own to bookmark and land on. It stays mounted while the
 * views swap below it, so its indicator slides rather than redraws.
 */
export function GroceriesHeader({ view }: { view: GroceriesView }) {
  const t = useTranslations("groceries.page");
  const router = useRouter();

  return (
    <div className="mb-6 flex min-h-10 shrink-0 items-center justify-between gap-3">
      <h1 className="truncate text-2xl font-bold">
        {view === "pantry" ? t("pantry") : t("title")}
      </h1>
      <div className="flex shrink-0 items-center gap-2">
        <Tabs
          selectedKey={view}
          onSelectionChange={(key) => router.push(HREF[key as GroceriesView])}
        >
          <Tabs.ListContainer className="shrink-0">
            <Tabs.List aria-label={t("views")} className="p-0.5">
              {(
                [
                  ["list", ClipboardDocumentListIcon],
                  ["pantry", ArchiveBoxIcon],
                ] as const
              ).map(([id, Icon]) => (
                <Tabs.Tab key={id} className="h-7 min-w-8 px-2.5 text-xs sm:min-w-16" id={id}>
                  <div className="flex items-center gap-1.5" title={t(id)}>
                    <Icon className="size-4 shrink-0" />
                    <span className="sr-only sm:not-sr-only">{t(id)}</span>
                  </div>
                  <Tabs.Indicator />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
        {view === "list" ? <GroceriesListActions /> : null}
      </div>
    </div>
  );
}
