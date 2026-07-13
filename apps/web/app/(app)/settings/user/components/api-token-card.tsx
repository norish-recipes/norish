"use client";

import { useState } from "react";
import {
  ClipboardDocumentIcon,
  KeyIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { Button, Card, Chip, Input, Label, Link, Modal, Table, TextField } from "@heroui/react";
import { useTranslations } from "next-intl";

import NewFeatureChip from "../../components/new-feature-chip";
import { useUserSettingsContext } from "../context";

export default function ApiKeyCard() {
  const t = useTranslations("settings.user.apiKeys");
  const tActions = useTranslations("common.actions");
  const { apiKeys, generateApiKey, deleteApiKey, toggleApiKey } = useUserSettingsContext();
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState("");
  const handleGenerateKey = async () => {
    setGeneratingKey(true);
    try {
      const result = await generateApiKey(newKeyName || undefined);

      if (!result) return;

      const { key } = result;

      setGeneratedKey(key);
      setShowTokenModal(true);
      setNewKeyName("");
    } finally {
      setGeneratingKey(false);
    }
  };
  const handleCopyKey = () => {
    if (generatedKey) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(generatedKey);
      }
    }
  };
  const handleDeleteKey = async (keyId: string) => {
    deleteApiKey(keyId);
    setShowDeleteModal(false);
    setKeyToDelete(null);
  };
  return (
    <>
      <Card>
        <Card.Header>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <KeyIcon className="h-5 w-5" />
            {t("title")}
            <NewFeatureChip showOnVersion="0.18.0" />
          </h2>
        </Card.Header>
        <Card.Content className="gap-4">
          <p className="text-muted text-base">{t("description")}</p>
          <Link
            className="w-fit"
            href="/api/docs"
            rel="noopener noreferrer"
            size="sm"
            target="_blank"
          >
            {t("docsLink")}
          </Link>

          {/* Create new key section */}
          <div className="flex flex-col gap-3">
            <TextField value={newKeyName} onChange={setNewKeyName}>
              <Label>{t("keyNameLabel")}</Label>
              <Input variant="secondary" placeholder={t("keyNamePlaceholder")} />
            </TextField>
            <div className="flex justify-end">
              <Button onPress={handleGenerateKey} variant="primary" isPending={generatingKey}>
                {<PlusIcon className="h-4 w-4" />}
                {t("createKey")}
              </Button>
            </div>
          </div>

          {/* Existing keys list */}
          {apiKeys.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-2 text-base font-medium">{t("yourKeys")}</h3>
              <Table>
                <Table.ScrollContainer>
                  <Table.Content aria-label={t("title")}>
                    <Table.Header>
                      <Table.Column id="name" isRowHeader>
                        {t("tableHeaders.name")}
                      </Table.Column>
                      <Table.Column id="keyPrefix">{t("tableHeaders.keyPrefix")}</Table.Column>
                      <Table.Column id="created">{t("tableHeaders.created")}</Table.Column>
                      <Table.Column id="status">{t("tableHeaders.status")}</Table.Column>
                      <Table.Column id="actions">{t("tableHeaders.actions")}</Table.Column>
                    </Table.Header>
                    <Table.Body>
                      {apiKeys.map((key) => (
                        <Table.Row key={key.id} id={key.id}>
                          <Table.Cell>{key.name || t("unnamed")}</Table.Cell>
                          <Table.Cell>
                            <code className="bg-surface-secondary rounded px-2 py-1 text-xs">
                              {key.start || "***"}...
                            </code>
                          </Table.Cell>
                          <Table.Cell>{new Date(key.createdAt).toLocaleDateString()}</Table.Cell>
                          <Table.Cell>
                            <Chip
                              color={key.enabled ? "success" : "danger"}
                              size="sm"
                              variant="soft"
                            >
                              {key.enabled ? t("active") : t("disabled")}
                            </Chip>
                          </Table.Cell>
                          <Table.Cell>
                            <div className="flex gap-1">
                              <Button
                                isIconOnly
                                size="sm"
                                title={key.enabled ? t("disableKey") : t("enableKey")}
                                onPress={() => toggleApiKey(key.id, !key.enabled)}
                                variant="tertiary"
                              >
                                {key.enabled ? (
                                  <PauseIcon className="h-4 w-4" />
                                ) : (
                                  <PlayIcon className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                isIconOnly
                                size="sm"
                                title={t("deleteKey")}
                                onPress={() => {
                                  setKeyToDelete(key.id);
                                  setShowDeleteModal(true);
                                }}
                                variant="danger-soft"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </Button>
                            </div>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>
            </div>
          )}

          {apiKeys.length === 0 && <p className="text-muted py-4 text-base">{t("noKeys")}</p>}
        </Card.Content>
      </Card>

      {/* Key Generation Modal */}
      <Modal.Backdrop
        className="z-[1099]"
        isDismissable={false}
        isOpen={showTokenModal}
        onOpenChange={setShowTokenModal}
      >
        <Modal.Container className="z-[1100]">
          <Modal.Dialog>
            {({ close: onClose }) => (
              <>
                <Modal.Header>{t("generatedModal.title")}</Modal.Header>
                <Modal.Body>
                  <p className="text-warning mb-4 text-base">{t("generatedModal.warning")}</p>
                  <div className="flex gap-2">
                    <Input
                      variant="secondary"
                      isReadOnly
                      className="font-mono text-xs"
                      value={generatedKey || ""}
                    />
                    <Button isIconOnly onPress={handleCopyKey}>
                      <ClipboardDocumentIcon className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-muted mt-2 text-xs">
                    {t.rich("generatedModal.hint", {
                      code: (chunks) => (
                        <code className="bg-surface-secondary rounded px-1">{chunks}</code>
                      ),
                    })}
                  </p>
                </Modal.Body>
                <Modal.Footer>
                  <Button
                    onPress={() => {
                      setGeneratedKey(null);
                      onClose();
                    }}
                    variant="primary"
                  >
                    {t("generatedModal.confirmButton")}
                  </Button>
                </Modal.Footer>
              </>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
      {/* Delete Key Confirmation */}
      <Modal.Backdrop
        className="z-[1099]"
        isOpen={showDeleteModal}
        onOpenChange={setShowDeleteModal}
      >
        <Modal.Container className="z-[1100]">
          <Modal.Dialog>
            {({ close: onClose }) => (
              <>
                <Modal.Header>{t("deleteModal.title")}</Modal.Header>
                <Modal.Body>
                  <p>{t("deleteModal.message")}</p>
                </Modal.Body>
                <Modal.Footer>
                  <Button onPress={onClose} variant="tertiary">
                    {tActions("cancel")}
                  </Button>
                  <Button
                    onPress={() => keyToDelete && handleDeleteKey(keyToDelete)}
                    variant="danger"
                  >
                    {t("deleteModal.confirmButton")}
                  </Button>
                </Modal.Footer>
              </>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </>
  );
}
