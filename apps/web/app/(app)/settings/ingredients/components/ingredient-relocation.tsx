"use client";

import { useEffect, useState } from "react";
import Panel from "@/components/Panel/Panel";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { useTranslations } from "next-intl";

import type { IngredientPick } from "./ingredient-picker";
import { IngredientPicker } from "./ingredient-picker";

/** What a panel is asking the viewer to pick a target for: a merge, a parent, or a spelling's move. */
export type Relocation =
  { kind: "merge" } | { kind: "parent" } | { kind: "move"; aliasId: string; text: string };

/**
 * The panel an Ingredient's panel opens over itself for an edit that names
 * another Ingredient: what to merge into, what this is a kind of, or where a
 * spelling goes (a new Ingredient included). It owns the pick; the caller
 * owns the save, which it is handed the pick for.
 */
export function IngredientRelocationPanel({
  relocation,
  ingredient,
  busy,
  onConfirm,
  onClose,
}: {
  relocation: Relocation | null;
  ingredient: { id: string; name: string };
  busy: boolean;
  onConfirm: (relocation: Relocation, target: IngredientPick) => void;
  onClose: () => void;
}) {
  const t = useTranslations("settings.ingredients");
  const tActions = useTranslations("common.actions");
  const [target, setTarget] = useState<IngredientPick | null>(null);
  // What is asked stays on screen while the panel slides away.
  const [shown, setShown] = useState<Relocation | null>(null);
  const asked = relocation ?? shown;

  useEffect(() => {
    if (relocation) setShown(relocation);
  }, [relocation]);

  const close = () => {
    setTarget(null);
    onClose();
  };

  return (
    <Panel
      nested
      className="contents"
      open={relocation !== null}
      title={
        asked?.kind === "move"
          ? t("moveTo")
          : asked?.kind === "merge"
            ? t("mergeInto")
            : t("setParent")
      }
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <Panel.Body>
        {asked ? (
          <div className="flex flex-col gap-3" data-testid="ingredient-relocation">
            <p className="text-muted text-sm">
              {asked.kind === "move"
                ? t("moveTitle", { alias: asked.text })
                : asked.kind === "merge"
                  ? t("mergeTitle", { name: ingredient.name })
                  : t("parentTitle", { name: ingredient.name })}
            </p>
            <IngredientPicker
              // A new question starts with an empty field.
              key={asked.kind === "move" ? asked.aliasId : asked.kind}
              allowNew={asked.kind === "move"}
              editableOnly={asked.kind === "merge"}
              excludeId={ingredient.id}
              label={
                asked.kind === "move"
                  ? t("moveTo")
                  : asked.kind === "merge"
                    ? t("mergeInto")
                    : t("setParent")
              }
              onPick={setTarget}
            />
          </div>
        ) : null}
      </Panel.Body>
      <Panel.Footer>
        <ActionButtonGroup>
          <ActionButton action="cancel" isDisabled={busy} onPress={close}>
            {tActions("cancel")}
          </ActionButton>
          <ActionButton
            action={asked?.kind === "parent" ? "save" : "apply"}
            data-testid="ingredient-relocation-confirm"
            isDisabled={busy || !target || !asked}
            isPending={busy}
            onPress={() => {
              if (asked && target) onConfirm(asked, target);
            }}
          >
            {asked?.kind === "move"
              ? t("move")
              : asked?.kind === "merge"
                ? t("merge")
                : tActions("save")}
          </ActionButton>
        </ActionButtonGroup>
      </Panel.Footer>
    </Panel>
  );
}
