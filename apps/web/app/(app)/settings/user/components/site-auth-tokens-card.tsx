"use client";

import { useState } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { PlusIcon, ShieldCheckIcon, TrashIcon } from "@heroicons/react/24/outline";
import {
  Button,
  Card,
  Chip,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Table,
  TextField,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

export default function SiteAuthTokensCard() {
  const t = useTranslations("settings.user.siteAuthTokens");
  const tErrors = useTranslations("common.errors");
  const tActions = useTranslations("common.actions");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Query
  const listQueryOptions = trpc.siteAuthTokens.list.queryOptions();
  const { data: tokens = [] } = useQuery(listQueryOptions);

  // Mutations
  const createMutation = useMutation(trpc.siteAuthTokens.create.mutationOptions());
  const removeMutation = useMutation(trpc.siteAuthTokens.remove.mutationOptions());

  // Form state
  const [domain, setDomain] = useState("");
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [type, setType] = useState<"header" | "cookie">("header");
  const [isCreating, setIsCreating] = useState(false);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [tokenToDelete, setTokenToDelete] = useState<string | null>(null);
  const handleCreate = async () => {
    if (!domain.trim() || !name.trim() || !value.trim()) return;
    setIsCreating(true);
    try {
      const newToken = await createMutation.mutateAsync({
        domain,
        name,
        value,
        type,
      });
      queryClient.setQueryData(listQueryOptions.queryKey, (prev: typeof tokens | undefined) =>
        prev ? [...prev, newToken] : [newToken]
      );
      setDomain("");
      setName("");
      setValue("");
      setType("header");
    } catch (error) {
      showSafeErrorToast({
        title: tErrors("operationFailed"),
        description: tErrors("technicalDetails"),
        color: "danger",
        error,
        context: "site-auth-tokens:create",
      });
    } finally {
      setIsCreating(false);
    }
  };
  const handleDelete = async (tokenId: string) => {
    try {
      const tokenVersion = tokens.find((token) => token.id === tokenId)?.version ?? 1;
      await removeMutation.mutateAsync({
        id: tokenId,
        version: tokenVersion,
      });
      queryClient.setQueryData(listQueryOptions.queryKey, (prev: typeof tokens | undefined) =>
        prev ? prev.filter((t) => t.id !== tokenId) : prev
      );
    } catch (error) {
      showSafeErrorToast({
        title: tErrors("operationFailed"),
        description: tErrors("technicalDetails"),
        color: "danger",
        error,
        context: "site-auth-tokens:delete",
      });
    } finally {
      setShowDeleteModal(false);
      setTokenToDelete(null);
    }
  };
  const isFormValid = domain.trim() && name.trim() && value.trim();
  return (
    <>
      <Card>
        <Card.Header>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <ShieldCheckIcon className="h-5 w-5" />
            {t("title")}
          </h2>
        </Card.Header>
        <Card.Content className="gap-4">
          <p className="text-muted text-base">{t("description")}</p>

          {/* Create form */}
          <div className="flex flex-col gap-3">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_9rem] lg:items-end">
              <TextField className="min-w-0" value={domain} onChange={setDomain}>
                <Label>{t("domain")}</Label>
                <Input variant="secondary" placeholder={t("domainPlaceholder")} />
              </TextField>
              <TextField className="min-w-0" value={name} onChange={setName}>
                <Label>{t("name")}</Label>
                <Input variant="secondary" placeholder={t("namePlaceholder")} />
              </TextField>
              <TextField className="min-w-0" type="password" value={value} onChange={setValue}>
                <Label>{t("value")}</Label>
                <Input variant="secondary" placeholder={t("valuePlaceholder")} />
              </TextField>
              <Select
                variant="secondary"
                className="min-w-0"
                placeholder={t("type")}
                value={type}
                onChange={(selected) => {
                  if (selected === "header" || selected === "cookie") {
                    setType(selected);
                  }
                }}
              >
                <Label>{t("type")}</Label>
                <Select.Trigger className="min-h-10">
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    <ListBox.Item id="header" textValue={t("typeHeader")}>
                      {t("typeHeader")}
                    </ListBox.Item>
                    <ListBox.Item id="cookie" textValue={t("typeCookie")}>
                      {t("typeCookie")}
                    </ListBox.Item>
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>
            <div className="flex justify-end">
              <Button
                isDisabled={!isFormValid}
                onPress={handleCreate}
                variant="primary"
                isPending={isCreating}
              >
                {<PlusIcon className="h-4 w-4" />}
                {t("addButton")}
              </Button>
            </div>
          </div>

          {/* Token list */}
          {tokens.length > 0 && (
            <div className="mt-4">
              <Table>
                <Table.ScrollContainer>
                  <Table.Content aria-label={t("title")}>
                    <Table.Header>
                      <Table.Column id="domain" isRowHeader>
                        {t("tableHeaders.domain")}
                      </Table.Column>
                      <Table.Column id="name">{t("tableHeaders.name")}</Table.Column>
                      <Table.Column id="type">{t("tableHeaders.type")}</Table.Column>
                      <Table.Column id="created">{t("tableHeaders.created")}</Table.Column>
                      <Table.Column id="actions">{t("tableHeaders.actions")}</Table.Column>
                    </Table.Header>
                    <Table.Body>
                      {tokens.map((token) => (
                        <Table.Row key={token.id} id={token.id}>
                          <Table.Cell>
                            <code className="bg-surface-secondary rounded px-2 py-1 text-xs">
                              {token.domain}
                            </code>
                          </Table.Cell>
                          <Table.Cell>{token.name}</Table.Cell>
                          <Table.Cell>
                            <Chip
                              color={token.type === "header" ? "accent" : "warning"}
                              size="sm"
                              variant="soft"
                            >
                              {token.type === "header" ? t("typeHeader") : t("typeCookie")}
                            </Chip>
                          </Table.Cell>
                          <Table.Cell>{new Date(token.createdAt).toLocaleDateString()}</Table.Cell>
                          <Table.Cell>
                            <Button
                              isIconOnly
                              size="sm"
                              title={t("deleteModal.confirmButton")}
                              onPress={() => {
                                setTokenToDelete(token.id);
                                setShowDeleteModal(true);
                              }}
                              variant="danger-soft"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </Button>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>
            </div>
          )}

          {tokens.length === 0 && <p className="text-muted py-4 text-base">{t("noTokens")}</p>}
        </Card.Content>
      </Card>

      {/* Delete Confirmation Modal */}
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
                    onPress={() => tokenToDelete && handleDelete(tokenToDelete)}
                    variant="danger"
                    isPending={removeMutation.isPending}
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
