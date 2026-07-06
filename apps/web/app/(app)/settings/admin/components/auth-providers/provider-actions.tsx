"use client";

import { BeakerIcon, CheckIcon, TrashIcon } from "@heroicons/react/16/solid";
import { Button } from "@heroui/react";
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
    <div className="flex items-center justify-between pt-2">
      {hasConfig && (
        <Button onPress={onDeleteClick} variant="danger-soft">
          {<TrashIcon className="h-5 w-5" />}
          {tActions("remove")}
        </Button>
      )}
      <div className="ml-auto flex gap-2">
        <Button onPress={onTest} variant="tertiary" isPending={testing}>
          {<BeakerIcon className="h-5 w-5" />}
          {tActions("test")}
        </Button>
        <Button isDisabled={!hasChanges} onPress={onSave} variant="primary" isPending={saving}>
          {<CheckIcon className="h-5 w-5" />}
          {tActions("save")}
        </Button>
      </div>
    </div>
  );
}
