"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CookbookCover from "@/components/cookbooks/cookbook-cover";
import { SelectableRow } from "@/components/cookbooks/selectable-row";
import Panel from "@/components/Panel/Panel";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { useCookbooksMutations, useEditableCookbooksQuery } from "@/hooks/cookbooks";
import { showActionToast } from "@/lib/ui/action-toast";
import { Input, Separator } from "@heroui/react";
import { useTranslations } from "next-intl";

const PANEL_HEIGHT = "h-[65dvh]";

/**
 * File a selection into picked cookbooks the reader may edit, a newly named one, or both.
 * Recipes already in a picked cookbook stay as they are.
 */
export function SelectionCookbooksPanel({
  open,
  onOpenChange,
  recipeIds,
  excludeCookbookId,
  onFiled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipeIds: string[];
  /** The cookbook being read, which the selection is already in. */
  excludeCookbookId?: string;
  onFiled: () => void;
}) {
  const t = useTranslations("recipes.selection");
  const tToasts = useTranslations("recipes.toasts");
  const tActions = useTranslations("common.actions");
  const router = useRouter();
  const { cookbooks, isLoading } = useEditableCookbooksQuery(null, { enabled: open });
  const { createCookbook, setMembership } = useCookbooksMutations();
  const [newTitle, setNewTitle] = useState("");
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set());
  const [wasOpen, setWasOpen] = useState(open);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) {
      setNewTitle("");
      setPicked(new Set());
    }
  }

  const offered = cookbooks.filter((cookbook) => cookbook.id !== excludeCookbookId);
  const title = newTitle.trim();
  const canSave = picked.size > 0 || title.length > 0;

  const toggle = (cookbookId: string) => {
    setPicked((previous) => {
      const next = new Set(previous);

      if (next.has(cookbookId)) next.delete(cookbookId);
      else next.add(cookbookId);

      return next;
    });
  };

  const save = async () => {
    const chosen = offered.filter((cookbook) => picked.has(cookbook.id));

    for (const cookbook of chosen) {
      setMembership({ cookbookId: cookbook.id, recipeIds, isMember: true, cookbook });
    }

    onOpenChange(false);
    onFiled();

    const createdId = title ? await createCookbook({ title, recipeIds }).catch(() => null) : null;
    const openId = createdId ?? chosen[0]?.id;
    const destinations = chosen.length + (createdId ? 1 : 0);

    if (!openId || destinations === 0) return;

    showActionToast(
      destinations === 1
        ? t("filedInto", { count: recipeIds.length, title: createdId ? title : chosen[0]!.title })
        : t("filedIntoMany", { count: recipeIds.length, cookbooks: destinations }),
      {
        variant: "success",
        action: { label: tToasts("open"), onPress: () => router.push(`/cookbooks/${openId}`) },
      }
    );
  };

  return (
    <Panel
      open={open}
      panelClassName={PANEL_HEIGHT}
      title={t("addToCookbook")}
      onOpenChange={onOpenChange}
    >
      {open ? (
        <Panel.Body className="flex min-h-0 flex-1 flex-col">
          <Input
            fullWidth
            data-testid="selection-new-cookbook-title"
            placeholder={t("newCookbook")}
            style={{ fontSize: "16px" }}
            value={newTitle}
            variant="secondary"
            onChange={(event) => setNewTitle(event.target.value)}
          />

          <Separator className="bg-surface-tertiary/40 my-3" />

          {isLoading ? (
            <div className="text-muted p-4 text-base">…</div>
          ) : (
            <div className="divide-border/40 flex min-h-0 flex-1 flex-col divide-y overflow-y-auto">
              {offered.map((cookbook) => (
                <SelectableRow
                  key={cookbook.id}
                  data-cookbook-toggle={cookbook.title}
                  isSelected={picked.has(cookbook.id)}
                  media={
                    <CookbookCover
                      emptyIconClassName="h-5 w-5"
                      image={cookbook.image}
                      images={cookbook.coverImages}
                      title={cookbook.title}
                    />
                  }
                  title={cookbook.title}
                  onToggle={() => toggle(cookbook.id)}
                />
              ))}
            </div>
          )}
        </Panel.Body>
      ) : null}

      {open ? (
        <Panel.Footer>
          <ActionButtonGroup>
            <ActionButton
              action="add"
              data-testid="save-selection-cookbooks"
              isDisabled={!canSave}
              onPress={() => void save()}
            >
              {tActions("add")}
            </ActionButton>
          </ActionButtonGroup>
        </Panel.Footer>
      ) : null}
    </Panel>
  );
}
