"use client";

import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { useTranslations } from "next-intl";

interface ProviderActionsProps {
  hasConfig: boolean;
  hasChanges: boolean;
  testing: boolean;
  saving: boolean;
  onTest: () => void;
  onSave: () => void;
  onDeleteClick: () => void;
}
export function ProviderActions({
  hasConfig,
  hasChanges,
  testing,
  saving,
  onTest,
  onSave,
  onDeleteClick,
}: ProviderActionsProps) {
  const tActions = useTranslations("common.actions");
  return (
    <ActionButtonGroup
      className="pt-2"
      start={
        hasConfig ? (
          <ActionButton action="delete" onPress={onDeleteClick}>
            {tActions("remove")}
          </ActionButton>
        ) : null
      }
    >
      <ActionButton action="test" isPending={testing} onPress={onTest}>
        {tActions("test")}
      </ActionButton>
      <ActionButton action="save" isDisabled={!hasChanges} isPending={saving} onPress={onSave}>
        {tActions("save")}
      </ActionButton>
    </ActionButtonGroup>
  );
}
