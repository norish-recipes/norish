"use client";

import { Button } from "@heroui/react";
import { TrashIcon, BeakerIcon, CheckIcon } from "@heroicons/react/16/solid";
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
        <Button
          color="danger"
          startContent={<TrashIcon className="h-5 w-5" />}
          variant="flat"
          onPress={onDeleteClick}
        >
          {tActions("remove")}
        </Button>
      )}
      <div className="ml-auto flex gap-2">
        <Button
          isLoading={testing}
          startContent={<BeakerIcon className="h-5 w-5" />}
          variant="flat"
          onPress={onTest}
        >
          {tActions("test")}
        </Button>
        <Button
          color="primary"
          isDisabled={!hasChanges}
          isLoading={saving}
          startContent={<CheckIcon className="h-5 w-5" />}
          onPress={onSave}
        >
          {tActions("save")}
        </Button>
      </div>
    </div>
  );
}
