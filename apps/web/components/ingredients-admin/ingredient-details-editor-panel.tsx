"use client";

import { useRef } from "react";
import { FIELD_CLASS, FIELD_STYLE } from "@/components/groceries/grocery-field";
import Panel from "@/components/Panel/Panel";
import { IngredientIllustration } from "@/components/recipes/ingredient-illustration";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { useClipboardImagePaste } from "@/hooks/use-clipboard-image-paste";
import { ArrowUpTrayIcon, PhotoIcon, SparklesIcon, TrashIcon } from "@heroicons/react/16/solid";
import { Button, Input, Label, Spinner, TextField } from "@heroui/react";
import { useTranslations } from "next-intl";

import { ALLOWED_IMAGE_MIME_TYPES } from "@norish/shared/contracts";
import { normalizeGroceryName } from "@norish/shared/lib/normalized-name";

/** Ingredient names are one to eighty characters; the field stops at the eightieth. */
export const INGREDIENT_NAME_MAX = 80;

/** An Ingredient Name as it is being edited: a new one where `id` is null. */
export interface EditingIngredient {
  id: string | null;
  name: string;
  version: number | null;
  imageUrl: string | null;
  /** How many recipes show the name, which a rename changes. */
  recipeCount: number;
}

/**
 * Whether the form can be saved: a name that folds to something and fits. A
 * collision with a name another ingredient already has is the server's to
 * refuse, and it says which ingredient holds it.
 */
export function canSaveIngredientDetails(editing: EditingIngredient): boolean {
  return (
    normalizeGroceryName(editing.name) !== "" && editing.name.trim().length <= INGREDIENT_NAME_MAX
  );
}

interface IngredientDetailsEditorPanelProps {
  editing: EditingIngredient | null;
  /** Whether this server can draw a picture at all. */
  canGenerate: boolean;
  /** Whether a picture for this ingredient is being drawn right now. */
  isGenerating: boolean;
  isSaving: boolean;
  isChangingImage: boolean;
  /** A message from the server's last refusal, shown as it came. */
  error: string | null;
  onChange: (editing: EditingIngredient) => void;
  onSave: () => void;
  onCancel: () => void;
  onUpload: (file: File) => void;
  onGenerate: () => void;
  onRemoveImage: () => void;
}

/**
 * The ingredient being added or edited, in a panel of its own over the list.
 * Its names are a draft saved with the footer; its picture is not — an
 * upload, a drawing or a removal happens the moment it is asked for, so a new
 * ingredient is created first and gains its picture after.
 */
export function IngredientDetailsEditorPanel({
  editing,
  canGenerate,
  isGenerating,
  isSaving,
  isChangingImage,
  error,
  onChange,
  onSave,
  onCancel,
  onUpload,
  onGenerate,
  onRemoveImage,
}: IngredientDetailsEditorPanelProps) {
  const t = useTranslations("settings.admin.ingredients");
  const tActions = useTranslations("common.actions");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isOpen = editing !== null;
  const hasEntry = Boolean(editing?.id);

  useClipboardImagePaste({
    enabled: isOpen && hasEntry && !isChangingImage,
    onFiles: (files) => {
      const image = files.find((file) =>
        (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)
      );

      if (image) onUpload(image);
    },
  });

  const canSave = editing !== null && canSaveIngredientDetails(editing);
  const renames = editing?.id && editing.recipeCount > 0;

  return (
    <Panel
      nested
      className="contents"
      open={isOpen}
      title={hasEntry ? t("editTitle") : t("newTitle")}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <Panel.Body>
        {editing && (
          <div className="flex flex-col gap-5">
            <TextField
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus={!hasEntry}
              value={editing.name}
              onChange={(name) => onChange({ ...editing, name })}
            >
              <Label>{t("nameLabel")}</Label>
              <Input
                className={FIELD_CLASS}
                data-testid="ingredients-name"
                maxLength={INGREDIENT_NAME_MAX}
                placeholder={t("namePlaceholder")}
                style={FIELD_STYLE}
                variant="secondary"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canSave) {
                    e.preventDefault();
                    onSave();
                  }
                }}
              />
              {renames && (
                <p className="text-muted mt-1 text-xs" data-testid="ingredients-rename-hint">
                  {t("renameHint", { count: editing.recipeCount })}
                </p>
              )}
            </TextField>

            {error && (
              <p className="text-danger text-sm" data-testid="ingredients-save-error">
                {error}
              </p>
            )}

            <section>
              <p className="text-muted mb-2 text-sm font-medium">{t("pictureLabel")}</p>
              {hasEntry ? (
                <div className="flex items-start gap-4">
                  <div className="bg-surface-secondary relative flex size-28 shrink-0 items-center justify-center rounded-xl">
                    {editing.imageUrl ? (
                      <IngredientIllustration ignoreHidden imageUrl={editing.imageUrl} size="lg" />
                    ) : (
                      <PhotoIcon aria-hidden className="text-muted size-8" />
                    )}
                    {(isGenerating || isChangingImage) && (
                      <div
                        className="bg-background/70 absolute inset-0 flex items-center justify-center rounded-xl"
                        data-testid="ingredients-picture-busy"
                      >
                        <Spinner size="sm" />
                      </div>
                    )}
                  </div>

                  <div className="flex min-w-0 flex-col items-start gap-2">
                    <input
                      ref={fileInputRef}
                      accept={ALLOWED_IMAGE_MIME_TYPES.join(",")}
                      className="hidden"
                      data-testid="ingredients-picture-file"
                      type="file"
                      onChange={(event) => {
                        const file = event.target.files?.[0];

                        if (file) onUpload(file);
                        event.target.value = "";
                      }}
                    />
                    <Button
                      isDisabled={isChangingImage}
                      size="sm"
                      variant="tertiary"
                      onPress={() => fileInputRef.current?.click()}
                    >
                      <ArrowUpTrayIcon className="size-4" />
                      {t("upload")}
                    </Button>
                    {canGenerate && (
                      <Button
                        data-testid="ingredients-generate"
                        isDisabled={isGenerating || isChangingImage}
                        size="sm"
                        variant="tertiary"
                        onPress={onGenerate}
                      >
                        <SparklesIcon className="size-4" />
                        {isGenerating
                          ? t("generating")
                          : editing.imageUrl
                            ? t("regenerate")
                            : t("generate")}
                      </Button>
                    )}
                    {editing.imageUrl && (
                      <Button
                        isDisabled={isChangingImage || isGenerating}
                        size="sm"
                        variant="danger-soft"
                        onPress={onRemoveImage}
                      >
                        <TrashIcon className="size-4" />
                        {t("removePicture")}
                      </Button>
                    )}
                    <p className="text-muted text-xs">
                      {canGenerate ? t("pictureHint") : t("pictureHintNoGeneration")}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-muted text-sm">{t("pictureAfterCreate")}</p>
              )}
            </section>
          </div>
        )}
      </Panel.Body>
      <Panel.Footer>
        <ActionButtonGroup>
          <ActionButton action="cancel" data-testid="ingredients-cancel" onPress={onCancel}>
            {hasEntry ? tActions("close") : tActions("cancel")}
          </ActionButton>
          <ActionButton
            action={hasEntry ? "save" : "create"}
            data-testid="ingredients-save"
            isDisabled={!canSave || isSaving}
            onPress={onSave}
          >
            {hasEntry ? tActions("save") : tActions("create")}
          </ActionButton>
        </ActionButtonGroup>
      </Panel.Footer>
    </Panel>
  );
}
