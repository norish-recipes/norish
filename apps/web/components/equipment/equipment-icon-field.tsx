"use client";

import { useRef } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { PanelPortal } from "@/components/Panel/Panel";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { ArrowUpTrayIcon, TrashIcon } from "@heroicons/react/16/solid";
import { Dropdown, Label, Spinner } from "@heroui/react";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { ICON_PICTURE_MIME_TYPES } from "@norish/shared/contracts";

import { EquipmentIcon } from "./equipment-icon";

export type EquipmentIconDraft = { file: string; address: string } | null | undefined;

export function EquipmentIconField({
  equipmentId,
  currentIcon,
  ownIcon,
  canEdit,
  draft,
  busy,
  onDraftChange,
}: {
  equipmentId?: string;
  currentIcon?: string | null;
  ownIcon?: boolean;
  canEdit: boolean;
  draft: EquipmentIconDraft;
  busy: boolean;
  onDraftChange: (draft: EquipmentIconDraft) => void;
}) {
  const t = useTranslations("settings.equipment.icon");
  const tEquipment = useTranslations("settings.equipment");
  const trpc = useTRPC();
  const pickerRef = useRef<HTMLInputElement>(null);
  const upload = useMutation(trpc.equipment.uploadIcon.mutationOptions());

  const shown = draft === undefined ? (currentIcon ?? null) : (draft?.address ?? null);
  const hasOwn = draft === undefined ? Boolean(ownIcon) : draft !== null;
  const pending = upload.isPending;

  const icon = (
    <span className="relative block">
      <EquipmentIcon placeholder size="panel" src={shown} />
      {pending ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner size="sm" />
        </span>
      ) : null}
    </span>
  );

  if (!canEdit) return <span data-testid="equipment-panel-icon">{icon}</span>;

  const uploadPicture = async (file: File) => {
    const form = new FormData();

    if (equipmentId) {
      form.set("equipmentId", equipmentId);
    }
    form.set("image", file);
    try {
      const stored = await upload.mutateAsync(form);

      onDraftChange({ file: stored.file, address: stored.address });
    } catch (error) {
      showSafeErrorToast({
        title: tEquipment("errors.title"),
        description: t("failed"),
        error,
        context: "equipment:upload-icon",
      });
    }
  };

  return (
    <>
      <input
        ref={pickerRef}
        accept={ICON_PICTURE_MIME_TYPES.join(",")}
        className="hidden"
        data-testid="equipment-icon-file"
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
          data-testid="equipment-panel-icon"
          isDisabled={busy || pending}
        >
          {icon}
        </Dropdown.Trigger>
        <PanelPortal>
          <Dropdown.Popover className="bg-overlay">
            <Dropdown.Menu aria-label={t("change")}>
              <Dropdown.Item
                id="upload"
                textValue={t("upload")}
                onAction={() => pickerRef.current?.click()}
              >
                <ArrowUpTrayIcon className="size-4" />
                <Label>{t("upload")}</Label>
              </Dropdown.Item>
              {hasOwn ? (
                <Dropdown.Item
                  className="text-danger"
                  id="remove"
                  textValue={t("remove")}
                  variant="danger"
                  onAction={() => onDraftChange(ownIcon ? null : undefined)}
                >
                  <TrashIcon className="size-4" />
                  <Label>{t("remove")}</Label>
                </Dropdown.Item>
              ) : null}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </PanelPortal>
      </Dropdown>
    </>
  );
}
