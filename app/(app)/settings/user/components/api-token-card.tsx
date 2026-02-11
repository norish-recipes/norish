"use client";

import { useState } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Input,
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
} from "@heroui/react";
import {
  ClipboardDocumentIcon,
  KeyIcon,
  TrashIcon,
  PlusIcon,
  PauseIcon,
  PlayIcon,
} from "@heroicons/react/24/outline";
import { useTranslations } from "next-intl";

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
      const { key } = await generateApiKey(newKeyName || undefined);

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
        <CardHeader>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <KeyIcon className="h-5 w-5" />
            {t("title")}
          </h2>
        </CardHeader>
        <CardBody className="gap-4">
          <p className="text-default-600 text-base">{t("description")}</p>

          {/* Create new key section */}
          <div className="flex flex-col gap-3">
            <Input
              label={t("keyNameLabel")}
              placeholder={t("keyNamePlaceholder")}
              size="sm"
              value={newKeyName}
              onValueChange={setNewKeyName}
            />
            <div className="flex justify-end">
              <Button
                color="primary"
                isLoading={generatingKey}
                startContent={<PlusIcon className="h-4 w-4" />}
                onPress={handleGenerateKey}
              >
                {t("createKey")}
              </Button>
            </div>
          </div>

          {/* Existing keys list */}
          {apiKeys.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-2 text-base font-medium">{t("yourKeys")}</h3>
              <Table aria-label={t("title")}>
                <TableHeader>
                  <TableColumn>{t("tableHeaders.name")}</TableColumn>
                  <TableColumn>{t("tableHeaders.keyPrefix")}</TableColumn>
                  <TableColumn>{t("tableHeaders.created")}</TableColumn>
                  <TableColumn>{t("tableHeaders.status")}</TableColumn>
                  <TableColumn>{t("tableHeaders.actions")}</TableColumn>
                </TableHeader>
                <TableBody>
                  {apiKeys.map((key) => (
                    <TableRow key={key.id}>
                      <TableCell>{key.name || t("unnamed")}</TableCell>
                      <TableCell>
                        <code className="bg-default-100 rounded px-2 py-1 text-xs">
                          {key.start || "***"}...
                        </code>
                      </TableCell>
                      <TableCell>{new Date(key.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Chip color={key.enabled ? "success" : "danger"} size="sm" variant="flat">
                          {key.enabled ? t("active") : t("disabled")}
                        </Chip>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            isIconOnly
                            color={key.enabled ? "warning" : "success"}
                            size="sm"
                            title={key.enabled ? t("disableKey") : t("enableKey")}
                            variant="light"
                            onPress={() => toggleApiKey(key.id, !key.enabled)}
                          >
                            {key.enabled ? (
                              <PauseIcon className="h-4 w-4" />
                            ) : (
                              <PlayIcon className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            isIconOnly
                            color="danger"
                            size="sm"
                            title={t("deleteKey")}
                            variant="light"
                            onPress={() => {
                              setKeyToDelete(key.id);
                              setShowDeleteModal(true);
                            }}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {apiKeys.length === 0 && <p className="text-default-500 py-4 text-base">{t("noKeys")}</p>}
        </CardBody>
      </Card>

      {/* Key Generation Modal */}
      <Modal
        classNames={{ wrapper: "z-[1100]", backdrop: "z-[1099]" }}
        isDismissable={false}
        isOpen={showTokenModal}
        onOpenChange={setShowTokenModal}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>{t("generatedModal.title")}</ModalHeader>
              <ModalBody>
                <p className="text-warning mb-4 text-base">{t("generatedModal.warning")}</p>
                <div className="flex gap-2">
                  <Input
                    isReadOnly
                    classNames={{ input: "font-mono text-xs" }}
                    value={generatedKey || ""}
                  />
                  <Button isIconOnly onPress={handleCopyKey}>
                    <ClipboardDocumentIcon className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-default-500 mt-2 text-xs">
                  {t.rich("generatedModal.hint", {
                    code: (chunks) => <code className="bg-default-100 rounded px-1">{chunks}</code>,
                  })}
                </p>
              </ModalBody>
              <ModalFooter>
                <Button
                  color="primary"
                  onPress={() => {
                    setGeneratedKey(null);
                    onClose();
                  }}
                >
                  {t("generatedModal.confirmButton")}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Delete Key Confirmation */}
      <Modal
        classNames={{ wrapper: "z-[1100]", backdrop: "z-[1099]" }}
        isOpen={showDeleteModal}
        onOpenChange={setShowDeleteModal}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>{t("deleteModal.title")}</ModalHeader>
              <ModalBody>
                <p>{t("deleteModal.message")}</p>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  {tActions("cancel")}
                </Button>
                <Button color="danger" onPress={() => keyToDelete && handleDeleteKey(keyToDelete)}>
                  {t("deleteModal.confirmButton")}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
