"use client";

import type { ReactNode } from "react";
import { SettingRow } from "@/components/settings/setting-row";
import ConfirmModal from "@/components/shared/confirm-modal";
import { cssAIIconColor } from "@/config/css-tokens";
import { AIButton } from "@/features/admin/components/ai-button";
import { SparklesIcon } from "@heroicons/react/24/outline";
import { Modal, Spinner } from "@heroui/react";
import { twMerge } from "tailwind-merge";

import { ServerConfigKeys } from "@norish/config/zod/server-config";
import { useAdminConfig } from "@norish/shared-react/admin";

/**
 * An administrator's AI run over the catalogue (Clean up catalogue, Fill gaps): a setting row's
 * button opening a dialog that says what it will do, then Confirm. No run while AI is off or one is on.
 */
export function CatalogueAIRun({
  testId,
  title,
  description,
  button,
  intro,
  start,
  counted,
  running,
  canStart,
  starting,
  isOpen,
  onOpenChange,
  onStart,
  children,
}: {
  testId: string;
  title: string;
  description: string;
  button: string;
  intro: string;
  start: string;
  /** The counts arrived: until then the dialog shows a spinner in place of `children`. */
  counted: boolean;
  running: boolean;
  canStart: boolean;
  starting: boolean;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onStart: () => void;
  children: ReactNode;
}) {
  const aiEnabled = useAdminConfig(ServerConfigKeys.AI_CONFIG, (ai) => ai?.enabled ?? false);

  return (
    <SettingRow description={description} title={title}>
      <AIButton
        fullWidth
        data-testid={testId}
        isDisabled={!aiEnabled || !counted || running}
        variant="tertiary"
        onPress={() => onOpenChange(true)}
      >
        {button}
      </AIButton>
      <ConfirmModal
        bodyClassName="flex flex-col"
        confirm={
          <AIButton
            className="min-w-28"
            data-testid={`${testId}-start`}
            isDisabled={!canStart}
            isPending={starting}
            variant="secondary"
            onPress={onStart}
          >
            {start}
          </AIButton>
        }
        data-testid={`${testId}-dialog`}
        headerClassName="flex-row items-center gap-2"
        isOpen={isOpen}
        title={
          <>
            <SparklesIcon className={twMerge("size-5 shrink-0", cssAIIconColor)} />
            <Modal.Heading>{title}</Modal.Heading>
          </>
        }
        onOpenChange={onOpenChange}
      >
        <p>{intro}</p>
        {counted ? (
          children
        ) : (
          <div className="flex justify-center pt-6 pb-2">
            <Spinner size="sm" />
          </div>
        )}
      </ConfirmModal>
    </SettingRow>
  );
}
