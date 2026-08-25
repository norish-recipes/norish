"use client";

import { useCallback, useEffect, useState } from "react";
import CookbookCover from "@/components/cookbooks/cookbook-cover";
import Panel from "@/components/Panel/Panel";
import { useCookbooksMutations, useEditableCookbooksQuery } from "@/hooks/cookbooks";
import { CheckIcon, PlusIcon } from "@heroicons/react/16/solid";
import { Button, Input, Separator } from "@heroui/react";
import { useTranslations } from "next-intl";

type MiniCookbooksProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipeId: string;
};

/**
 * The membership panel: every cookbook the reader may edit, with this
 * recipe's membership shown as a toggle.
 *
 * One place both files and unfiles, so undoing a mistake is not a hunt for a
 * different control. The row at the top makes a new cookbook already holding
 * this recipe, which is the one-step version of "these two belong together".
 *
 * The list is a plain list rather than a menu on purpose: a menu whose items
 * derive from state its own action mutates rebuilds mid-exit and steals focus
 * from whatever the action opened.
 */
export default function MiniCookbooks({ open, onOpenChange, recipeId }: MiniCookbooksProps) {
  const t = useTranslations("recipes.cookbooks");
  const { cookbooks, isLoading } = useEditableCookbooksQuery(open ? recipeId : null);
  const { createCookbook, setMembership } = useCookbooksMutations();
  const [newTitle, setNewTitle] = useState("");

  useEffect(() => {
    if (!open) setNewTitle("");
  }, [open]);

  const createWithRecipe = useCallback(() => {
    const title = newTitle.trim();

    if (!title) return;
    setNewTitle("");
    void createCookbook({ title, recipeId });
  }, [createCookbook, newTitle, recipeId]);

  return (
    <Panel open={open} title={t("panelTitle")} onOpenChange={onOpenChange}>
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
                if (event.key === "Enter") createWithRecipe();
              }}
            />
            <Button
              isIconOnly
              aria-label={t("newWithRecipe")}
              className="shrink-0 rounded-full"
              isDisabled={newTitle.trim().length === 0}
              size="md"
              variant="primary"
              onPress={createWithRecipe}
            >
              <PlusIcon className="size-4" />
            </Button>
          </div>

          <Separator className="bg-surface-tertiary/40 my-3" />

          {isLoading ? (
            <div className="text-muted p-4 text-base">…</div>
          ) : cookbooks.length === 0 ? (
            <div className="text-muted flex flex-1 items-center justify-center px-4 text-center text-base">
              {t("noneEditable")}
            </div>
          ) : (
            <div className="divide-border/40 flex min-h-0 flex-1 flex-col divide-y overflow-y-auto">
              {cookbooks.map((cookbook) => (
                <button
                  key={cookbook.id}
                  aria-pressed={cookbook.containsRecipe}
                  className="hover:bg-surface-secondary flex items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors"
                  data-cookbook-toggle={cookbook.title}
                  type="button"
                  onClick={() =>
                    setMembership({
                      cookbookId: cookbook.id,
                      recipeId,
                      isMember: !cookbook.containsRecipe,
                      cookbook,
                    })
                  }
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
                      cookbook.containsRecipe
                        ? "border-accent bg-accent text-accent-foreground"
                        : "border-border text-transparent"
                    }`}
                  >
                    <CheckIcon className="size-4" />
                  </span>
                </button>
              ))}
            </div>
          )}
        </Panel.Body>
      ) : null}
    </Panel>
  );
}
