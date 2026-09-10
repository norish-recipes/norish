"use client";

import { formatShelfPrice } from "@/lib/format-price";
import {
  CheckIcon,
  ChevronDownIcon,
  EllipsisVerticalIcon,
  TrashIcon,
} from "@heroicons/react/16/solid";
import { Button, Dropdown, Label, Separator } from "@heroui/react";
import { motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";

import type { StoreTotal } from "./store-total";

/** Mark all done, Delete done and Clear all: what a section's kebab can hold. */
export interface StoreHeadingActions {
  onMarkAllDone?: () => void;
  onDeleteDone?: () => void;
  onClearAll?: () => void;
}

interface StoreHeadingProps {
  /** What the section is called: the Store's name, Unsorted, or a recipe's name. */
  name: string;
  /** Whether a dot in the Store's colour stands before the name. A Store has one; Unsorted and a recipe have none. */
  dot?: boolean;
  activeCount: number;
  doneCount: number;
  /** What is still to buy costs this; null where nothing under the heading is priced, or the section has no Store. */
  total?: StoreTotal | null;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  /** The kebab's actions; absent where the section has no kebab, as a recipe's has not. */
  actions?: StoreHeadingActions;
  /** The kebab's accessible label; defaults to "Store actions" so a recipe section can say "Recipe actions" instead. */
  actionsLabel?: string;
  /** What the drag helpers find a Store's heading by; a recipe section is no drop target. */
  dropTarget?: string;
}

/**
 * The heading of one section of the list — a Store's, Unsorted's or a
 * recipe's — the bar at the top of the section's card, with the rows beneath
 * it. Shared by the flat, the grouped and the By Recipe view so that
 * there is one place the shape lives: the dot where there is a Store, the
 * name, what is left and what it costs, the chevron that folds the section,
 * and the kebab with Mark all done and Delete done.
 *
 * The colour appears only where it marks: the dot, which becomes a filled
 * circle with a check once everything under the heading is ticked, when the
 * meta reads All done in place of the count.
 */
export function StoreHeading({
  name,
  dot = false,
  activeCount,
  doneCount,
  total = null,
  expanded,
  onExpandedChange,
  actions,
  actionsLabel,
  dropTarget,
}: StoreHeadingProps) {
  const t = useTranslations("groceries.store");
  const tItem = useTranslations("groceries.item");
  const locale = useLocale();
  const allDone = activeCount === 0 && doneCount > 0;

  return (
    <div className="flex w-full items-center gap-2 px-3 py-2.5" data-store-drop-target={dropTarget}>
      <button
        aria-expanded={expanded}
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left transition-opacity hover:opacity-80"
        type="button"
        onClick={() => onExpandedChange(!expanded)}
      >
        {/* The Store's mark: a dot in its colour, or a check in a disc of it once the Store is done */}
        {dot && (
          <span aria-hidden className="flex h-4 w-4 shrink-0 items-center justify-center">
            {allDone ? (
              <span
                className="flex h-4 w-4 items-center justify-center rounded-full bg-(--store-color)"
                data-store-done="true"
                data-testid="store-dot"
              >
                <CheckIcon className="h-3 w-3 text-white" />
              </span>
            ) : (
              <span
                className="h-2.5 w-2.5 rounded-full bg-(--store-color)"
                data-testid="store-dot"
              />
            )}
          </span>
        )}

        <span className="min-w-0 truncate font-semibold">{name}</span>

        {/* What is left and what it costs, or that nothing is left */}
        <span className="text-muted shrink-0 text-sm tabular-nums" data-testid="store-meta">
          {allDone ? (
            t("allDone")
          ) : (
            <>
              {tItem("items", { count: activeCount })}
              {total && (
                <>
                  {" · "}
                  <span data-testid="store-total" title={t("total")}>
                    {formatShelfPrice(locale, total.amount, total.currency)}
                  </span>
                </>
              )}
            </>
          )}
        </span>

        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          className="text-muted ml-auto shrink-0"
          transition={{ duration: 0.2 }}
        >
          <ChevronDownIcon className="h-5 w-5" />
        </motion.div>
      </button>

      {actions && (
        <Dropdown>
          <Button isIconOnly className="shrink-0" size="sm" variant="tertiary">
            <EllipsisVerticalIcon className="h-5 w-5" />
          </Button>
          <Dropdown.Popover className="bg-overlay">
            <Dropdown.Menu aria-label={actionsLabel ?? t("storeActions")}>
              {(actions.onMarkAllDone || actions.onDeleteDone) && (
                <Dropdown.Section>
                  {actions.onMarkAllDone && (
                    <Dropdown.Item
                      key="mark-done"
                      id="mark-done"
                      textValue={t("markAllDone")}
                      onPress={() => actions.onMarkAllDone?.()}
                    >
                      {<CheckIcon className="h-4 w-4" />}
                      <Label>{t("markAllDone")}</Label>
                    </Dropdown.Item>
                  )}
                  {actions.onDeleteDone && (
                    <Dropdown.Item
                      key="delete-done"
                      className="text-danger"
                      id="delete-done"
                      textValue={t("deleteDone")}
                      variant="danger"
                      onPress={() => actions.onDeleteDone?.()}
                    >
                      {<TrashIcon className="h-4 w-4" />}
                      <Label>{t("deleteDone")}</Label>
                    </Dropdown.Item>
                  )}
                </Dropdown.Section>
              )}
              {actions.onClearAll && (
                <>
                  {(actions.onMarkAllDone || actions.onDeleteDone) && <Separator />}
                  <Dropdown.Section>
                    <Dropdown.Item
                      key="clear-all"
                      className="text-danger"
                      id="clear-all"
                      textValue={t("clearAll")}
                      variant="danger"
                      onPress={() => actions.onClearAll?.()}
                    >
                      {<TrashIcon className="h-4 w-4" />}
                      <Label>{t("clearAll")}</Label>
                    </Dropdown.Item>
                  </Dropdown.Section>
                </>
              )}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      )}
    </div>
  );
}
