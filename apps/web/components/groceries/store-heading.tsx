"use client";

import type { ReactNode } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  EllipsisVerticalIcon,
  TrashIcon,
} from "@heroicons/react/16/solid";
import { Button, Dropdown, Label } from "@heroui/react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";

/** Mark all done and Delete done: what a section's kebab holds, and all it holds. */
export interface StoreHeadingActions {
  onMarkAllDone?: () => void;
  onDeleteDone?: () => void;
}

interface StoreHeadingProps {
  /** What the section is called: the Store's name, Unsorted, or a recipe's name. */
  name: string;
  /** Whether a dot in the Store's colour stands before the name. A Store has one; Unsorted and a recipe have none. */
  dot?: boolean;
  activeCount: number;
  doneCount: number;
  /** What is still to buy costs this, rendered by the list, which knows how it prices its rows. */
  total?: ReactNode;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  /** The kebab's actions; absent where the section has no kebab, as a recipe's has not. */
  actions?: StoreHeadingActions;
  /** What the drag helpers find a Store's heading by; a recipe section is no drop target. */
  dropTarget?: string;
  className?: string;
}

/**
 * The heading of one section of the list — a Store's, Unsorted's or a
 * recipe's — shared by the flat, the grouped and the By Recipe view so that
 * there is one place the shape lives: the dot where there is a Store, the
 * name, what is left and what it costs, the chevron that folds the section,
 * and the kebab with Mark all done and Delete done.
 */
export function StoreHeading({
  name,
  dot = false,
  activeCount,
  doneCount,
  total,
  expanded,
  onExpandedChange,
  actions,
  dropTarget,
  className = "",
}: StoreHeadingProps) {
  const t = useTranslations("groceries.store");

  return (
    <div
      className={`flex w-full items-center gap-3 rounded-t-xl px-4 py-3 ${className}`}
      data-store-drop-target={dropTarget}
    >
      <button
        className="flex min-w-0 flex-1 items-center gap-3 transition-colors hover:opacity-90"
        type="button"
        onClick={() => onExpandedChange(!expanded)}
      >
        {/* The Store's mark: a dot in its colour, and nothing more */}
        {dot && (
          <span
            aria-hidden
            className="h-2.5 w-2.5 shrink-0 rounded-full bg-(--store-color)"
            data-testid="store-dot"
          />
        )}

        {/* Name and count */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate font-semibold">{name}</span>
          <span className="text-muted shrink-0 text-sm">
            {activeCount > 0 && <span>{activeCount}</span>}
            {doneCount > 0 && (
              <span className="text-muted ml-1">({t("done", { count: doneCount })})</span>
            )}
          </span>
        </div>

        {total}

        {/* Expand/collapse chevron */}
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          className="text-muted shrink-0"
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
            <Dropdown.Menu aria-label={t("storeActions")}>
              <Dropdown.Item
                key="mark-done"
                id="mark-done"
                textValue={t("markAllDone")}
                onPress={() => actions.onMarkAllDone?.()}
              >
                {<CheckIcon className="h-4 w-4" />}
                <Label>{t("markAllDone")}</Label>
              </Dropdown.Item>
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
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      )}
    </div>
  );
}
