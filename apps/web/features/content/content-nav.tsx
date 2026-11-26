"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Label, ListBox, Select, Tabs } from "@heroui/react";
import { useFormatter, useTranslations } from "next-intl";
import { RouterProvider } from "react-aria-components";

import type { ContentList } from "@norish/shared-react/lists";
import {
  CONTENT_LISTS,
  ENTRY_KINDS,
  isContentList,
  useContentCounts,
} from "@norish/shared-react/lists";
import { addBasePath } from "@norish/shared/lib/base-path";

import { contentHref, LIST_ICONS } from "./content-lists";

/** The list picker beside the list on a desktop, over it on a phone. */
export function ContentLayout({ nav, children }: { nav: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
      <div className="w-full md:w-60 md:shrink-0">{nav}</div>
      <div className="flex min-w-0 flex-1 flex-col gap-6">{children}</div>
    </div>
  );
}

function ListLabel({ list, count }: { list: ContentList; count?: number }) {
  const t = useTranslations("settings.content.lists");
  const Icon = LIST_ICONS[list];
  const format = useFormatter();

  return (
    <span className="flex min-w-0 flex-1 items-center gap-2.5">
      <Icon aria-hidden className="size-5 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-start">{t(list)}</span>
      {count === undefined ? null : (
        <span className="text-muted text-sm tabular-nums">{format.number(count)}</span>
      )}
    </span>
  );
}

/** Tags, Cuisines, Categories and Ingredients: a column of links on a desktop, a select on a phone. */
export function ContentNav({ list }: { list: ContentList }) {
  const t = useTranslations("settings.content");
  const router = useRouter();
  const counts = useContentCounts();
  // The Ingredients catalogue is paged, so it shows no count.
  const countOf = (each: ContentList) =>
    each === "ingredients" ? undefined : counts[ENTRY_KINDS[each]];

  return (
    <>
      <RouterProvider
        navigate={(href, options) => router.push(href, options)}
        useHref={addBasePath}
      >
        <Tabs
          aria-label={t("ariaLabel")}
          align="start"
          className="hidden w-full md:flex"
          orientation="vertical"
          selectedKey={list}
        >
          <Tabs.ListContainer className="w-full">
            <Tabs.List aria-label={t("ariaLabel")} className="w-full">
              {CONTENT_LISTS.map((each) => (
                <Tabs.Tab key={each} href={contentHref(each)} id={each}>
                  <ListLabel count={countOf(each)} list={each} />
                  <Tabs.Indicator />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
      </RouterProvider>
      <Select
        aria-label={t("listPicker")}
        className="w-full md:hidden"
        value={list}
        variant="secondary"
        onChange={(key) => {
          if (typeof key === "string" && isContentList(key)) router.push(contentHref(key));
        }}
      >
        <Label className="sr-only">{t("listPicker")}</Label>
        <Select.Trigger>
          <Select.Value className="min-w-0">
            <ListLabel count={countOf(list)} list={list} />
          </Select.Value>
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {CONTENT_LISTS.map((each) => (
              <ListBox.Item key={each} id={each} textValue={t(`lists.${each}`)}>
                <ListLabel count={countOf(each)} list={each} />
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
    </>
  );
}
