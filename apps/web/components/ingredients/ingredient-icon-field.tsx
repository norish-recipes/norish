"use client";

import { useRef } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { usePanelPortalContainer } from "@/components/Panel/Panel";
import { cssAIIconColor } from "@/config/css-tokens";
import { usePermissionsContext } from "@/context/permissions-context";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { ArrowUpTrayIcon, SparklesIcon, TrashIcon } from "@heroicons/react/16/solid";
import { Dropdown, Label, Spinner } from "@heroui/react";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { ICON_PICTURE_MIME_TYPES } from "@norish/shared/contracts";

import type { IngredientItem } from "./types";
import { IngredientIcon, useIngredientIconsHidden } from "./ingredient-icon";

/**
 * The icon as the panel's draft holds it: unchanged (undefined), a stored
 * file to make the food's own, or the food's own removed (null).
 */
export type IconDraft = { file: string; address: string } | null | undefined;

/**
 * The food's Ingredient Icon at the head of its panel. One the viewer may
 * edit is a button: Upload a picture (cut out on the server), Generate one
 * with the instance's image provider (offered only where it can draw), or
 * Remove the food's own icon, so the shipped one or its parent's comes
 * back. Each is part of the draft and lands with Save, so Cancel leaves the
 * food as it was. A reader who hid Ingredient Icons is shown none here either.
 */
export function IngredientIconField({
  item,
  draft,
  busy,
  onDraftChange,
}: {
  item: IngredientItem;
  draft: IconDraft;
  busy: boolean;
  onDraftChange: (draft: IconDraft) => void;
}) {
  const t = useTranslations("settings.ingredients.icon");
  const tIngredients = useTranslations("settings.ingredients");
  const trpc = useTRPC();
  const portalContainer = usePanelPortalContainer();
  const picker = useRef<HTMLInputElement>(null);
  const upload = useMutation(trpc.ingredients.uploadIcon.mutationOptions());
  const generate = useMutation(trpc.ingredients.generateIcon.mutationOptions());
  const { canDrawImages } = usePermissionsContext();
  const hidden = useIngredientIconsHidden();

  if (hidden) return null;

  // A removed own icon shows the placeholder until Save brings back what it falls back to.
  const shown = draft === undefined ? (item.icon ?? null) : (draft?.address ?? null);
  const hasOwn = draft === undefined ? Boolean(item.ownIcon) : draft !== null;
  const pending = upload.isPending || generate.isPending;
  const icon = (
    <span className="relative block">
      <IngredientIcon size="panel" src={shown} />
      {pending ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner size="sm" />
        </span>
      ) : null}
    </span>
  );

  if (!item.canEdit) return <span data-testid="ingredient-panel-icon">{icon}</span>;

  const uploadPicture = async (file: File) => {
    const form = new FormData();

    form.set("ingredientId", item.id);
    form.set("image", file);
    try {
      const stored = await upload.mutateAsync(form);

      onDraftChange({ file: stored.file, address: stored.address });
    } catch (error) {
      showSafeErrorToast({
        title: tIngredients("errors.title"),
        description: t("failed"),
        error,
        context: "ingredients:upload-icon",
      });
    }
  };

  const generateIcon = async () => {
    try {
      const drawn = await generate.mutateAsync({ ingredientId: item.id });

      onDraftChange({ file: drawn.file, address: drawn.address });
    } catch (error) {
      showSafeErrorToast({
        title: tIngredients("errors.title"),
        description: t("generateFailed"),
        error,
        context: "ingredients:generate-icon",
      });
    }
  };

  return (
    <>
      <input
        ref={picker}
        accept={ICON_PICTURE_MIME_TYPES.join(",")}
        className="hidden"
        data-testid="ingredient-icon-file"
        type="file"
        onChange={(event) => {
          const file = event.target.files?.[0];

          event.target.value = "";
          if (file) void uploadPicture(file);
        }}
      />
      <Dropdown>
        <Dropdown.Trigger
          aria-label={t("change")}
          className="hover:bg-default/40 focus-visible:ring-focus shrink-0 cursor-[var(--cursor-interactive)] rounded-xl p-1 focus-visible:ring-2 focus-visible:outline-none"
          data-testid="ingredient-panel-icon"
          isDisabled={busy || pending}
        >
          {icon}
        </Dropdown.Trigger>
        <Dropdown.Popover UNSTABLE_portalContainer={portalContainer} className="bg-overlay">
          <Dropdown.Menu aria-label={t("change")}>
            <Dropdown.Item
              id="upload"
              textValue={t("upload")}
              onAction={() => picker.current?.click()}
            >
              <ArrowUpTrayIcon className="size-4" />
              <Label>{t("upload")}</Label>
            </Dropdown.Item>
            {canDrawImages ? (
              <Dropdown.Item
                id="generate"
                textValue={t("generate")}
                onAction={() => void generateIcon()}
              >
                <SparklesIcon className={`size-4 ${cssAIIconColor}`} />
                <Label>{t("generate")}</Label>
              </Dropdown.Item>
            ) : null}
            {hasOwn ? (
              <Dropdown.Item
                className="text-danger"
                id="remove"
                textValue={t("remove")}
                variant="danger"
                onAction={() => onDraftChange(item.ownIcon ? null : undefined)}
              >
                <TrashIcon className="size-4" />
                <Label>{t("remove")}</Label>
              </Dropdown.Item>
            ) : null}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </>
  );
}
