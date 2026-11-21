"use client";

import { useEffect, useRef, useState } from "react";
import CookbookCover from "@/components/cookbooks/cookbook-cover";
import { SelectableRow } from "@/components/cookbooks/selectable-row";
import Panel from "@/components/Panel/Panel";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { PhotoIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Button, Input, Label, Modal, Separator, Spinner } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { CookbookSummaryDTO } from "@norish/shared/contracts";
import { useCookbookEdit } from "@norish/shared-react/recipes";
import { ALLOWED_IMAGE_MIME_TYPES } from "@norish/shared/contracts";
import { addBasePath } from "@norish/shared/lib/base-path";

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

  return (
    <Panel
      open={open}
      panelClassName={CREATE_PANEL_HEIGHT}
      title={t("createTitle")}
      onOpenChange={onOpenChange}
    >
      <CookbookTitleContent onOpenChange={onOpenChange} onSubmit={onSubmit} />
    </Panel>
  );
}

/** The panel's content, mounted while it is open: each opening starts with an empty title. */
function CookbookTitleContent({
  onOpenChange,
  onSubmit,
}: {
  onOpenChange: (open: boolean) => void;
  onSubmit: (title: string) => void;
}) {
  const t = useTranslations("recipes.cookbooks");
  const tActions = useTranslations("common.actions");
  const [title, setTitle] = useState("");

  const trimmed = title.trim();
  const submit = () => {
    if (!trimmed) return;
    onSubmit(trimmed);
    onOpenChange(false);
  };

  return (
    <>
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

      <Panel.Footer>
        <ActionButtonGroup>
          <ActionButton action="create" isDisabled={trimmed.length === 0} onPress={submit}>
            {tActions("create")}
          </ActionButton>
        </ActionButtonGroup>
      </Panel.Footer>
    </>
  );
}

/**
 * Edit a cookbook: its cover, its name, and what is in it.
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

  return (
    <Panel
      open={open}
      panelClassName={EDIT_PANEL_HEIGHT}
      title={t("editTitle")}
      onOpenChange={onOpenChange}
    >
      {/* A rename from elsewhere starts the staged edits again from the new title. */}
      <CookbookEditContent key={cookbook.title} cookbook={cookbook} onOpenChange={onOpenChange} />
    </Panel>
  );
}

/** The panel's content, mounted while it is open: each opening starts from the cookbook as saved. */
function CookbookEditContent({
  cookbook,
  onOpenChange,
}: {
  cookbook: CookbookSummaryDTO;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("recipes.cookbooks");
  const tActions = useTranslations("common.actions");
  const initialTitle = cookbook.title;
  const pickerRef = useRef<HTMLInputElement>(null);
  const {
    title,
    setTitle,
    removed,
    toggleRemoved,
    picked,
    pickCover,
    clearCover,
    shownImage,
    coverDisabled: isOffline,
    isDirty,
    isSaving,
    members: { recipes, isLoading, hasMore, loadMore },
    save,
  } = useCookbookEdit(cookbook);
  const preview = picked?.preview ?? null;

  useEffect(() => {
    if (!preview) return;

    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  const submit = async () => {
    if (await save()) onOpenChange(false);
  };

  return (
    <>
      <Panel.Body className="flex min-h-0 flex-1 flex-col">
        <Label className="text-muted mb-2 text-[11px] font-medium tracking-wide uppercase">
          {t("coverLabel")}
        </Label>
        <div className="flex items-center gap-3">
          <div className="bg-surface-secondary h-20 w-32 shrink-0 overflow-hidden rounded-xl">
            <CookbookCover
              emptyIconClassName="h-8 w-8"
              image={shownImage}
              images={cookbook.coverImages}
              title={initialTitle}
            />
          </div>
          <div className="flex min-w-0 flex-col items-start gap-2">
            <div className="flex flex-wrap gap-2">
              <Button
                data-testid="cookbook-image-choose"
                isDisabled={isOffline}
                size="sm"
                variant="secondary"
                onPress={() => pickerRef.current?.click()}
              >
                <PhotoIcon className="size-4" />
                {shownImage ? t("changeImage") : t("chooseImage")}
              </Button>
              {shownImage ? (
                <Button size="sm" variant="tertiary" onPress={clearCover}>
                  <TrashIcon className="size-4" />
                  {t("removeImage")}
                </Button>
              ) : null}
            </div>
            {isOffline ? <p className="text-muted text-sm">{t("imageNeedsConnection")}</p> : null}
          </div>
          <input
            ref={pickerRef}
            accept={ALLOWED_IMAGE_MIME_TYPES.join(",")}
            className="hidden"
            data-testid="cookbook-image-file"
            type="file"
            onChange={(event) => {
              const pickedFile = event.target.files?.[0];

              event.target.value = "";
              if (pickedFile) {
                pickCover({ file: pickedFile, preview: URL.createObjectURL(pickedFile) });
              }
            }}
          />
        </div>

        <Separator className="bg-surface-tertiary/40 my-3" />

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
            if (event.key === "Enter" && !isSaving) void submit();
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
                        src={addBasePath(recipe.image)}
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
              <Button className="mt-2 self-center" size="sm" variant="tertiary" onPress={loadMore}>
                {t("showMore")}
              </Button>
            )}
          </div>
        )}
      </Panel.Body>

      <Panel.Footer>
        <ActionButtonGroup>
          <ActionButton
            action="save"
            isDisabled={!isDirty}
            isPending={isSaving}
            onPress={() => void submit()}
          >
            {tActions("save")}
          </ActionButton>
        </ActionButtonGroup>
      </Panel.Footer>
    </>
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
