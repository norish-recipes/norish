"use client";

import { RollingText } from "@/components/shared/rolling-text";
import { ArchiveBoxIcon, ClipboardDocumentListIcon } from "@heroicons/react/20/solid";
import { Tabs } from "@heroui/react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";

import { GroceriesListActions } from "./groceries-page";

export type GroceriesView = "list" | "pantry";

const HREF: Record<GroceriesView, string> = { list: "/groceries", pantry: "/groceries/pantry" };

/** How long the views, and what only one of them has, take to come and go. */
export const VIEW_TRANSITION = { duration: 0.2, ease: "easeOut" } as const;

/**
 * The top of Groceries on both of its views: the view's title, and on the
 * right the _List · Pantry_ switch with the list's own controls to its left.
 * The switch is the same segmented toggle the Library and a cookbook use;
 * each view has an address of its own to bookmark and land on, and the switch
 * only rewrites the address, so its indicator slides at once rather than
 * waiting on a navigation.
 *
 * The switch is the row's last item so it never moves under the reader's
 * finger: the list's controls fade out beside it rather than pulling it
 * across. The title rolls to the new view's name the way the Library's
 * heading does, up towards the Pantry and down back to the list.
 */
export function GroceriesHeader({ view }: { view: GroceriesView }) {
  const t = useTranslations("groceries.page");
  const titles: Record<GroceriesView, string> = { list: t("title"), pantry: t("pantry") };
  // As many slots as the longer title, so no letter is a slot created mid-roll.
  const slots = Math.max(...Object.values(titles).map((title) => [...title].length));

  return (
    <div className="mb-6 flex min-h-10 shrink-0 flex-wrap items-center justify-between gap-3">
      <h1 aria-label={titles[view]} className="truncate text-2xl font-bold">
        <span aria-hidden className="inline-flex items-baseline whitespace-pre">
          <RollingText
            isRising={view === "pantry"}
            keyFrom="left"
            slots={slots}
            value={titles[view]}
          />
        </span>
      </h1>
      <div className="flex shrink-0 items-center gap-2">
        {/* On a phone the gear's room stays in the Pantry too, so both views
            wrap alike and the switch never jumps a row. */}
        <div className="flex justify-end max-md:min-h-9 max-md:min-w-9">
          <AnimatePresence initial={false}>
            {view === "list" ? (
              <motion.div
                key="list-actions"
                animate={{ opacity: 1 }}
                className="flex items-center gap-2"
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
                transition={VIEW_TRANSITION}
              >
                <GroceriesListActions />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
        <Tabs
          selectedKey={view}
          onSelectionChange={(key) =>
            window.history.pushState(null, "", HREF[key as GroceriesView])
          }
        >
          <Tabs.ListContainer className="shrink-0">
            <Tabs.List aria-label={t("views")} className="p-0.5">
              {(
                [
                  ["list", ClipboardDocumentListIcon],
                  ["pantry", ArchiveBoxIcon],
                ] as const
              ).map(([id, Icon]) => (
                <Tabs.Tab key={id} className="h-7 px-2.5 text-xs sm:min-w-16" id={id}>
                  {/* A phone shows the words alone: the icons only guess at a list and a pantry. */}
                  <div className="flex items-center gap-1.5">
                    <Icon className="size-4 shrink-0 max-sm:hidden" />
                    <span>{t(id)}</span>
                  </div>
                  <Tabs.Indicator />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
      </div>
    </div>
  );
}
