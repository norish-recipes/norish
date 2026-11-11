"use client";

import { useRef } from "react";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { ServerIcon } from "@heroicons/react/24/outline";
import { Modal } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { UserCaldavConfigWithoutPasswordDto } from "@norish/shared/contracts";
import {
  useCaldavConfigQuery,
  useCaldavMutations,
  useCaldavPasswordQuery,
} from "@norish/shared-react/calendar";

import { CaldavFormFields, useCaldavForm } from "./caldav-form";

interface CaldavConfigEditModalProps {
  isOpen: boolean;
  onClose: () => void;
}
export default function CaldavConfigEditModal({ isOpen, onClose }: CaldavConfigEditModalProps) {
  return (
    <Modal.Backdrop className="z-[1099]" isOpen={isOpen} onOpenChange={onClose}>
      <Modal.Container className="z-[1100]" scroll="inside" size="lg">
        <Modal.Dialog>
          <CaldavConfigEditForm onClose={onClose} />
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/** Mounted only while open, so the password read ends on close. */
function CaldavConfigEditForm({ onClose }: { onClose: () => void }) {
  const { config } = useCaldavConfigQuery();
  // Above the key, so a new version starts the fields over without reading the password again.
  const { read } = useCaldavPasswordQuery();

  return (
    <CaldavConfigEditFields
      key={config?.version}
      config={config}
      readStoredPassword={read}
      onClose={onClose}
    />
  );
}

interface CaldavConfigEditFieldsProps {
  config: UserCaldavConfigWithoutPasswordDto | null;
  readStoredPassword: () => Promise<string | null>;
  onClose: () => void;
}

/** The fields, seeded from one version of the config. */
function CaldavConfigEditFields({
  config,
  readStoredPassword,
  onClose,
}: CaldavConfigEditFieldsProps) {
  const tConfig = useTranslations("settings.caldav.config");
  const tActions = useTranslations("common.actions");
  const { saveConfig, isSavingConfig: saving } = useCaldavMutations();
  const form = useCaldavForm(config);
  const { serverUrl, username, password, calendarUrl, connection } = form;
  // Revealing the stored password tests the connection once per opening.
  const hasAutoTestedRef = useRef(false);

  const handleRevealPassword = async () => {
    const storedPassword = await readStoredPassword();

    if (
      storedPassword &&
      serverUrl &&
      username &&
      !connection.testing &&
      !hasAutoTestedRef.current
    ) {
      hasAutoTestedRef.current = true;
      void connection.runTest(form.target(storedPassword));
    }

    return storedPassword;
  };
  const passwordToUse = async () => password || (config ? await readStoredPassword() : null) || "";
  const handleSave = async () => {
    connection.setTestResult(null);
    const saved = await saveConfig(form.toSave(config?.enabled ?? true));

    if (saved) onClose();
  };
  const canSave = serverUrl && username && (password || config) && calendarUrl && form.timesValid;

  return (
    <>
      <Modal.Header className="flex items-center gap-2">
        <ServerIcon className="h-5 w-5" />
        {tConfig("editTitle")}
      </Modal.Header>
      <Modal.Body>
        <CaldavFormFields
          form={form}
          isConfigured={!!config}
          onRevealPassword={handleRevealPassword}
          onTrust={async () => connection.trustAndRetest(form.target(await passwordToUse()))}
        />
      </Modal.Body>
      <Modal.Footer>
        <ActionButtonGroup>
          <ActionButton
            action="test"
            isDisabled={!serverUrl || !username || (!password && !config)}
            isPending={connection.testing}
            onPress={async () => connection.runTest(form.target(await passwordToUse()))}
          >
            {tActions("test")}
          </ActionButton>
          <ActionButton action="save" isDisabled={!canSave} isPending={saving} onPress={handleSave}>
            {tActions("save")}
          </ActionButton>
        </ActionButtonGroup>
      </Modal.Footer>
    </>
  );
}
