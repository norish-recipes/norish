"use client";

import { useCallback, useEffect, useState } from "react";
import { SelectableRow } from "@/components/cookbooks/selectable-row";
import Panel from "@/components/Panel/Panel";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { useCookbookRecipesQuery, useCookbooksMutations } from "@/hooks/cookbooks";
import { PhotoIcon } from "@heroicons/react/24/outline";
import { Button, Input, Label, Modal, Separator, Spinner } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { CookbookSummaryDTO } from "@norish/shared/contracts";

/**
 * How tall these panels open.
 *
 * A panel that sizes itself to one input opens as a strip at the bottom of
 * the screen, which reads as cramped next to every other panel in the app.
 * The create panel takes a floor; the edit panel takes a real height, because
 * the list it holds is the point of it.
 */
const CREATE_PANEL_HEIGHT = "min-h-[40dvh]";
const EDIT_PANEL_HEIGHT = "h-[70dvh]";

/** Ask for a title, and nothing else — everything a new cookbook needs. */
export function CookbookTitlePanel({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (title: string) => void;
}) {
  const t = useTranslations("recipes.cookbooks");
  const tActions = useTranslations("common.actions");
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (open) setTitle("");
  }, [open]);

  const trimmed = title.trim();
  const submit = () => {
    if (!trimmed) return;
    onSubmit(trimmed);
    onOpenChange(false);
  };

  return (
    <Panel
      open={open}
      panelClassName={CREATE_PANEL_HEIGHT}
      title={t("createTitle")}
      onOpenChange={onOpenChange}
    >
      {open ? (
        <Panel.Body>
          <Label className="text-muted mb-2 text-[11px] font-medium tracking-wide uppercase">
            {t("titleLabel")}
          </Label>
          <Input
            fullWidth
            data-testid="cookbook-title-input"
            placeholder={t("titlePlaceholder")}
            style={{ fontSize: "16px" }}
            value={title}
            variant="secondary"
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submit();
            }}
          />
        </Panel.Body>
      ) : null}

      {open ? (
        <Panel.Footer>
          <ActionButtonGroup>
            <ActionButton action="create" isDisabled={trimmed.length === 0} onPress={submit}>
              {tActions("create")}
            </ActionButton>
          </ActionButtonGroup>
        </Panel.Footer>
      ) : null}
    </Panel>
  );
}

/**
 * Edit a cookbook: its name, and what is in it.
 *
 * Renaming and unfiling are the same decision often enough — "this is really
 * the weeknight list, and these three do not belong on it" — that splitting
 * them across a panel and a separate page was the wrong seam. Both are staged
 * and applied together by Save, so a mis-tapped remove is undone by closing
 * the panel rather than by filing the recipe back in.
 *
 * What is in the cookbook is shown the way the membership panel shows it: a
 * ticked row stays, an unticked one goes when you save. One question asked one
 * way, rather than a minus and an undo arrow here and a tick there.
 *
 * Removing a recipe from a cookbook never touches the recipe (ADR-0027).
 */
export function CookbookEditPanel({
  cookbook,
  open,
  onOpenChange,
}: {
  /**
   * The whole row, not just its id: the rename needs its version, and the
   * membership patch needs the row itself so an unfiling made Offline shows
   * on the recipe page's card without a refetch that never comes.
   */
  cookbook: CookbookSummaryDTO;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("recipes.cookbooks");
  const tActions = useTranslations("common.actions");
  const cookbookId = cookbook.id;
  const initialTitle = cookbook.title;
  const [title, setTitle] = useState(initialTitle);
  const [removed, setRemoved] = useState<string[]>([]);
  // Both staged edits commit through the same seam: routing only the rename
  // back out through a prop would give one panel two ways to write.
  const { renameCookbook, setMembership } = useCookbooksMutations();
  const { recipes, isLoading, hasMore, loadMore, removeMember } = useCookbookRecipesQuery(
    cookbookId,
    {},
    { enabled: open }
  );

  useEffect(() => {
    if (open) {
      setTitle(initialTitle);
      setRemoved([]);
    }
  }, [open, initialTitle]);

  const toggleRemoved = useCallback((recipeId: string) => {
    setRemoved((previous) =>
      previous.includes(recipeId)
        ? previous.filter((id) => id !== recipeId)
        : [...previous, recipeId]
    );
  }, []);

  const trimmed = title.trim();
  const isDirty = (trimmed.length > 0 && trimmed !== initialTitle) || removed.length > 0;

  const submit = () => {
    if (trimmed.length > 0 && trimmed !== initialTitle) {
      renameCookbook({ id: cookbookId, title: trimmed, version: cookbook.version });
    }

    for (const recipeId of removed) {
      setMembership({ cookbookId, recipeId, isMember: false, cookbook });
      // The member list is this cookbook's own read, so drop the row now
      // rather than waiting for a refetch that Offline never comes.
      removeMember(recipeId);
    }

    onOpenChange(false);
  };

  return (
    <Panel
      open={open}
      panelClassName={EDIT_PANEL_HEIGHT}
      title={t("editTitle")}
      onOpenChange={onOpenChange}
    >
      {open ? (
        <Panel.Body className="flex min-h-0 flex-1 flex-col">
          <Label className="text-muted mb-2 text-[11px] font-medium tracking-wide uppercase">
            {t("titleLabel")}
          </Label>
          <Input
            fullWidth
            data-testid="cookbook-title-input"
            placeholder={t("titlePlaceholder")}
            style={{ fontSize: "16px" }}
            value={title}
            variant="secondary"
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submit();
            }}
          />

          <Separator className="bg-surface-tertiary/40 my-3" />

          <Label className="text-muted mb-2 text-[11px] font-medium tracking-wide uppercase">
            {t("membersLabel")}
          </Label>

          {isLoading ? (
            <div className="flex flex-1 items-center justify-center py-6">
              <Spinner color="accent" size="sm" />
            </div>
          ) : recipes.length === 0 ? (
            <div className="text-muted flex flex-1 items-center justify-center px-4 text-center text-base">
              {t("empty")}
            </div>
          ) : (
            <div className="divide-border/40 flex min-h-0 flex-1 flex-col divide-y overflow-y-auto">
              {recipes.map((recipe) => {
                const stays = !removed.includes(recipe.id);

                return (
                  <SelectableRow
                    key={recipe.id}
                    data-remove-member={recipe.name}
                    isSelected={stays}
                    media={
                      recipe.image ? (
                        <img
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                          src={recipe.image}
                        />
                      ) : (
                        <PhotoIcon aria-hidden className="h-5 w-5 opacity-70" />
                      )
                    }
                    title={recipe.name}
                    onToggle={() => toggleRemoved(recipe.id)}
                  />
                );
              })}

              {hasMore && (
                <Button
                  className="mt-2 self-center"
                  size="sm"
                  variant="tertiary"
                  onPress={loadMore}
                >
                  {t("showMore")}
                </Button>
              )}
            </div>
          )}
        </Panel.Body>
      ) : null}

      {open ? (
        <Panel.Footer>
          <ActionButtonGroup>
            <ActionButton action="save" isDisabled={!isDirty} onPress={submit}>
              {tActions("save")}
            </ActionButton>
          </ActionButtonGroup>
        </Panel.Footer>
      ) : null}
    </Panel>
  );
}

/**
 * Delete confirmed by name, following the recipe delete modal — and saying
 * out loud that the recipes it holds are not going anywhere.
 */
export function DeleteCookbookModal({
  isOpen,
  title,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations("recipes.cookbooks");
  const tActions = useTranslations("common.actions");

  return (
    <Modal.Backdrop className="z-[1099]" isOpen={isOpen} onOpenChange={onClose}>
      <Modal.Container className="z-[1100]">
        <Modal.Dialog>
          {({ close }) => (
            <>
              <Modal.Header className="text-danger">{t("deleteTitle")}</Modal.Header>
              <Modal.Body>
                <p>{t("deleteConfirm", { title })}</p>
                <p className="text-muted mt-2">{t("deleteKeepsRecipes")}</p>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="tertiary" onPress={close}>
                  {tActions("cancel")}
                </Button>
                <Button data-testid="confirm-delete-cookbook" variant="danger" onPress={onConfirm}>
                  {tActions("delete")}
                </Button>
              </Modal.Footer>
            </>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
