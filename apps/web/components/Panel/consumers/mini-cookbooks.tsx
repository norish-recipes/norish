"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CookbookCover from "@/components/cookbooks/cookbook-cover";
import Panel from "@/components/Panel/Panel";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { useCookbooksMutations, useEditableCookbooksQuery } from "@/hooks/cookbooks";
import { CheckIcon, PlusIcon, XMarkIcon } from "@heroicons/react/16/solid";
import { Button, Input, Separator } from "@heroui/react";
import { useTranslations } from "next-intl";

type MiniCookbooksProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipeId: string;
};

/** A cookbook the reader has asked for but that does not exist yet. */
type PendingCookbook = { key: number; title: string };

/** The panel opens this tall, so a short list is not a strip at the bottom. */
const PANEL_HEIGHT = "h-[65dvh]";

/**
 * The membership panel: every cookbook the reader may edit, with this
 * recipe's membership shown as a toggle.
 *
 * One place both files and unfiles, so undoing a mistake is not a hunt for a
 * different control. The row at the top asks for a new cookbook holding this
 * recipe, which is the one-step version of "these two belong together".
 *
 * Nothing here is applied until Save. Every other panel in the app commits on
 * a button, and a panel that wrote as you tapped was the only one where
 * closing meant "keep it" rather than "never mind" — with no way back from a
 * mis-tap except tapping it again. It also means a cookbook the reader asks
 * for appears in this list the moment they ask for it, as a row waiting to be
 * made, rather than existing on the server and being invisible here.
 *
 * The list is a plain list rather than a menu on purpose: a menu whose items
 * derive from state its own action mutates rebuilds mid-exit and steals focus
 * from whatever the action opened.
 */
export default function MiniCookbooks({ open, onOpenChange, recipeId }: MiniCookbooksProps) {
  const t = useTranslations("recipes.cookbooks");
  const tActions = useTranslations("common.actions");
  const { cookbooks, isLoading } = useEditableCookbooksQuery(open ? recipeId : null);
  const { createCookbook, setMembership } = useCookbooksMutations();
  const [newTitle, setNewTitle] = useState("");
  /** Only the cookbooks the reader has actually changed their mind about. */
  const [staged, setStaged] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<PendingCookbook[]>([]);
  // Monotonic, so removing a row cannot hand its key to the next one.
  const nextKey = useRef(0);

  useEffect(() => {
    if (!open) {
      setNewTitle("");
      setStaged({});
      setPending([]);
    }
  }, [open]);

  const stageNew = useCallback(() => {
    const title = newTitle.trim();

    if (!title) return;
    setNewTitle("");
    setPending((previous) => [...previous, { key: nextKey.current++, title }]);
  }, [newTitle]);

  const toggle = useCallback((cookbookId: string, isMember: boolean) => {
    setStaged((previous) => ({ ...previous, [cookbookId]: isMember }));
  }, []);

  const isDirty =
    pending.length > 0 ||
    cookbooks.some(
      (cookbook) => cookbook.id in staged && staged[cookbook.id] !== cookbook.containsRecipe
    );

  const save = useCallback(() => {
    for (const cookbook of cookbooks) {
      const next = staged[cookbook.id];

      if (next === undefined || next === cookbook.containsRecipe) continue;

      setMembership({ cookbookId: cookbook.id, recipeId, isMember: next, cookbook });
    }

    // Only what is on screen as a pending row. Adding it is the moment the
    // reader confirms a new cookbook, and a half-typed title is not that.
    for (const entry of pending) {
      void createCookbook({ title: entry.title, recipeId });
    }

    onOpenChange(false);
  }, [cookbooks, staged, pending, setMembership, createCookbook, recipeId, onOpenChange]);

  return (
    <Panel
      open={open}
      panelClassName={PANEL_HEIGHT}
      title={t("panelTitle")}
      onOpenChange={onOpenChange}
    >
      {open ? (
        <Panel.Body className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-2">
            <Input
              fullWidth
              data-testid="new-cookbook-title"
              placeholder={t("newWithRecipe")}
              style={{ fontSize: "16px" }}
              value={newTitle}
              variant="secondary"
              onChange={(event) => setNewTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") stageNew();
              }}
            />
            <Button
              isIconOnly
              aria-label={t("newWithRecipe")}
              className="shrink-0 rounded-full"
              isDisabled={newTitle.trim().length === 0}
              size="md"
              variant="primary"
              onPress={stageNew}
            >
              <PlusIcon className="size-4" />
            </Button>
          </div>

          <Separator className="bg-surface-tertiary/40 my-3" />

          {isLoading ? (
            <div className="text-muted p-4 text-base">…</div>
          ) : cookbooks.length === 0 && pending.length === 0 ? (
            <div className="text-muted flex flex-1 items-center justify-center px-4 text-center text-base">
              {t("noneEditable")}
            </div>
          ) : (
            <div className="divide-border/40 flex min-h-0 flex-1 flex-col divide-y overflow-y-auto">
              {pending.map((entry) => (
                <div
                  key={entry.key}
                  className="flex items-center gap-3 rounded-lg px-2 py-2"
                  data-pending-cookbook={entry.title}
                >
                  <span className="bg-surface-secondary h-10 w-10 shrink-0 overflow-hidden rounded-lg">
                    <CookbookCover emptyIconClassName="h-5 w-5" images={[]} title={entry.title} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-base font-semibold">{entry.title}</span>
                    <span className="text-muted text-xs">{t("willBeCreated")}</span>
                  </span>
                  <Button
                    isIconOnly
                    aria-label={tActions("remove")}
                    className="shrink-0 rounded-full"
                    size="sm"
                    variant="tertiary"
                    onPress={() =>
                      setPending((previous) => previous.filter((item) => item.key !== entry.key))
                    }
                  >
                    <XMarkIcon className="size-4" />
                  </Button>
                </div>
              ))}

              {cookbooks.map((cookbook) => {
                const isMember = staged[cookbook.id] ?? cookbook.containsRecipe;

                return (
                  <button
                    key={cookbook.id}
                    aria-pressed={isMember}
                    className="hover:bg-surface-secondary flex items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors"
                    data-cookbook-toggle={cookbook.title}
                    type="button"
                    onClick={() => toggle(cookbook.id, !isMember)}
                  >
                    <span className="bg-surface-secondary h-10 w-10 shrink-0 overflow-hidden rounded-lg">
                      <CookbookCover
                        emptyIconClassName="h-5 w-5"
                        images={cookbook.coverImages}
                        title={cookbook.title}
                      />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-base font-semibold">{cookbook.title}</span>
                      <span className="text-muted text-xs">
                        {t("recipeCount", { count: cookbook.memberCount })}
                      </span>
                    </span>
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                        isMember
                          ? "border-accent bg-accent text-accent-foreground"
                          : "border-border text-transparent"
                      }`}
                    >
                      <CheckIcon className="size-4" />
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </Panel.Body>
      ) : null}

      {open ? (
        <Panel.Footer>
          <ActionButtonGroup>
            <ActionButton
              action="save"
              data-testid="save-cookbook-membership"
              isDisabled={!isDirty}
              onPress={save}
            >
              {tActions("save")}
            </ActionButton>
          </ActionButtonGroup>
        </Panel.Footer>
      ) : null}
    </Panel>
  );
}
