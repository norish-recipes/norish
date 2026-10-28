"use client";

import type { ReactNode } from "react";
import { SettingRow } from "@/app/(app)/settings/components/setting-row";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { AIButton } from "@/components/shared/ai-button";
import { cssAIIconColor } from "@/config/css-tokens";
import { SparklesIcon } from "@heroicons/react/24/outline";
import { Modal, Spinner } from "@heroui/react";
import { useTranslations } from "next-intl";
import { twMerge } from "tailwind-merge";

import { useAdminSettingsContext } from "../context";

/** A run's counts, read again on every open and watched while it runs, so the button comes back. */
export const watchRun = {
  refetchOnMount: "always" as const,
  refetchInterval: (query: { state: { data?: { running: boolean } } }) =>
    query.state.data?.running ? 5_000 : false,
};

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
  const tActions = useTranslations("common.actions");
  const { aiConfig } = useAdminSettingsContext();

  return (
    <SettingRow description={description} title={title}>
      <AIButton
        fullWidth
        data-testid={testId}
        isDisabled={!aiConfig?.enabled || !counted || running}
        variant="tertiary"
        onPress={() => onOpenChange(true)}
      >
        {button}
      </AIButton>
      <Modal.Backdrop className="z-[1099]" isOpen={isOpen} onOpenChange={onOpenChange}>
        <Modal.Container className="z-[1100]">
          <Modal.Dialog data-testid={`${testId}-dialog`}>
            <Modal.Header className="flex-row items-center gap-2">
              <SparklesIcon className={twMerge("size-5 shrink-0", cssAIIconColor)} />
              <Modal.Heading>{title}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col">
              <p>{intro}</p>
              {counted ? (
                children
              ) : (
                <div className="flex justify-center pt-6 pb-2">
                  <Spinner size="sm" />
                </div>
              )}
            </Modal.Body>
            <Modal.Footer>
              <ActionButtonGroup>
                <ActionButton action="cancel" onPress={() => onOpenChange(false)}>
                  {tActions("cancel")}
                </ActionButton>
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
              </ActionButtonGroup>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </SettingRow>
  );
}
