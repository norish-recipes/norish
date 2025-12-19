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

import { useUserSettingsContext } from "../context";

export default function ApiKeyCard() {
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
            API Keys
          </h2>
        </CardHeader>
        <CardBody className="gap-4">
          <p className="text-default-600 text-base">
            API keys allow programmatic access to the Norish API. Use them for integrations,
            shortcuts, and automation.
          </p>

          {/* Create new key section */}
          <div className="flex items-end gap-2">
            <Input
              className="flex-1"
              label="Key Name (optional)"
              placeholder="e.g., iOS Shortcut"
              size="sm"
              value={newKeyName}
              onValueChange={setNewKeyName}
            />
            <Button
              color="primary"
              isLoading={generatingKey}
              startContent={<PlusIcon className="h-4 w-4" />}
              onPress={handleGenerateKey}
            >
              Create Key
            </Button>
          </div>

          {/* Existing keys list */}
          {apiKeys.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-2 text-base font-medium">Your API Keys</h3>
              <Table aria-label="API keys">
                <TableHeader>
                  <TableColumn>NAME</TableColumn>
                  <TableColumn>KEY PREFIX</TableColumn>
                  <TableColumn>CREATED</TableColumn>
                  <TableColumn>STATUS</TableColumn>
                  <TableColumn>ACTIONS</TableColumn>
                </TableHeader>
                <TableBody>
                  {apiKeys.map((key) => (
                    <TableRow key={key.id}>
                      <TableCell>{key.name || "Unnamed"}</TableCell>
                      <TableCell>
                        <code className="bg-default-100 rounded px-2 py-1 text-xs">
                          {key.start || "***"}...
                        </code>
                      </TableCell>
                      <TableCell>{new Date(key.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Chip color={key.enabled ? "success" : "danger"} size="sm" variant="flat">
                          {key.enabled ? "Active" : "Disabled"}
                        </Chip>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            isIconOnly
                            color={key.enabled ? "warning" : "success"}
                            size="sm"
                            title={key.enabled ? "Disable key" : "Enable key"}
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
                            title="Delete key"
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

          {apiKeys.length === 0 && (
            <p className="text-default-500 py-4 text-base">
              No API keys yet. Create one to get started.
            </p>
          )}
        </CardBody>
      </Card>

      {/* Key Generation Modal */}
      <Modal isDismissable={false} isOpen={showTokenModal} onOpenChange={setShowTokenModal}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>API Key Generated</ModalHeader>
              <ModalBody>
                <p className="text-warning mb-4 text-base">
                  <strong>Save this key now!</strong> You won&apos;t be able to see it again. We
                  store only a hash and cannot recover this key.
                </p>
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
                  Use this key in the <code className="bg-default-100 rounded px-1">x-api-key</code>{" "}
                  header when making API requests.
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
                  I&apos;ve Saved It
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Delete Key Confirmation */}
      <Modal isOpen={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Delete API Key</ModalHeader>
              <ModalBody>
                <p>
                  Are you sure you want to delete this API key? Any applications using it will
                  immediately lose access. This cannot be undone.
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  Cancel
                </Button>
                <Button color="danger" onPress={() => keyToDelete && handleDeleteKey(keyToDelete)}>
                  Delete Key
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
