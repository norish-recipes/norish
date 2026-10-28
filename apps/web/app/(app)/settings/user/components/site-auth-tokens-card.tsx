"use client";

import { useState } from "react";
import { SettingsCard } from "@/app/(app)/settings/components/settings-card";
import { useTRPC } from "@/app/providers/trpc-provider";
import {
  ActionButton,
  ActionButtonGroup,
  IconActionButton,
} from "@/components/shared/action-button";
import { InfoHint } from "@/components/shared/info-hint";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { ShieldCheckIcon } from "@heroicons/react/24/outline";
import {
  Chip,
  FieldError,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Table,
  TextField,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";

import { TokenDomainSchema } from "@norish/shared/contracts/zod/site-auth-tokens";

export default function SiteAuthTokensCard() {
  const t = useTranslations("settings.user.siteAuthTokens");
  const tErrors = useTranslations("common.errors");
  const tActions = useTranslations("common.actions");
  const format = useFormatter();
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
  const [account, setAccount] = useState("");
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
    await createMutation
      .mutateAsync({
        domain,
        account,
        name,
        value,
        type,
      })
      .then((newToken) => {
        queryClient.setQueryData(listQueryOptions.queryKey, (prev: typeof tokens | undefined) =>
          prev ? [...prev, newToken] : [newToken]
        );
        setDomain("");
        setAccount("");
        setName("");
        setValue("");
        setType("header");
      })
      .catch((error: unknown) =>
        showSafeErrorToast({
          title: tErrors("operationFailed"),
          description: tErrors("technicalDetails"),
          color: "danger",
          error,
          context: "site-auth-tokens:create",
        })
      );
    setIsCreating(false);
  };
  const handleDelete = async (tokenId: string) => {
    const tokenVersion = tokens.find((token) => token.id === tokenId)?.version ?? 1;

    await removeMutation
      .mutateAsync({
        id: tokenId,
        version: tokenVersion,
      })
      .then(() =>
        queryClient.setQueryData(listQueryOptions.queryKey, (prev: typeof tokens | undefined) =>
          prev ? prev.filter((t) => t.id !== tokenId) : prev
        )
      )
      .catch((error: unknown) =>
        showSafeErrorToast({
          title: tErrors("operationFailed"),
          description: tErrors("technicalDetails"),
          color: "danger",
          error,
          context: "site-auth-tokens:delete",
        })
      );
    setShowDeleteModal(false);
    setTokenToDelete(null);
  };
  // A token's domain is a full domain, which also covers its subdomains.
  const isDomainBare = domain.trim() !== "" && !TokenDomainSchema.safeParse(domain).success;
  const isFormValid = domain.trim() && !isDomainBare && name.trim() && value.trim();

  // Sorted so a site's accounts read as the sets they are, rather than in the
  // order they happened to be added.
  const orderedTokens = [...tokens].sort(
    (a, b) =>
      a.domain.localeCompare(b.domain) ||
      (a.account ?? "").localeCompare(b.account ?? "") ||
      a.name.localeCompare(b.name)
  );

  return (
    <>
      <SettingsCard description={t("description")} icon={ShieldCheckIcon} title={t("title")}>
        {/* Create form */}
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_9rem] xl:items-end">
            <TextField
              className="min-w-0"
              isInvalid={isDomainBare}
              value={domain}
              onChange={setDomain}
            >
              <Label>{t("domain")}</Label>
              <Input variant="secondary" placeholder={t("domainPlaceholder")} />
              <FieldError>{t("domainNotFull")}</FieldError>
            </TextField>
            <TextField className="min-w-0" value={account} onChange={setAccount}>
              <span className="flex h-5 items-center gap-1">
                <Label>{t("account")}</Label>
                <InfoHint label={t("accountsHelp")}>{t("accountsDescription")}</InfoHint>
              </span>
              <Input variant="secondary" placeholder={t("accountPlaceholder")} />
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
              <Select.Trigger>
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
          <ActionButtonGroup>
            <ActionButton
              action="add"
              isDisabled={!isFormValid}
              isPending={isCreating}
              onPress={handleCreate}
            >
              {t("addButton")}
            </ActionButton>
          </ActionButtonGroup>
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
                    <Table.Column id="account">{t("tableHeaders.account")}</Table.Column>
                    <Table.Column id="name">{t("tableHeaders.name")}</Table.Column>
                    <Table.Column id="type">{t("tableHeaders.type")}</Table.Column>
                    <Table.Column id="created">{t("tableHeaders.created")}</Table.Column>
                    <Table.Column id="actions">{t("tableHeaders.actions")}</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {orderedTokens.map((token) => (
                      <Table.Row key={token.id} id={token.id}>
                        <Table.Cell>
                          <code className="bg-surface-secondary rounded px-2 py-1 text-xs">
                            {token.domain}
                          </code>
                        </Table.Cell>
                        <Table.Cell>
                          {token.account ?? (
                            <span className="text-muted">{t("accountShared")}</span>
                          )}
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
                        <Table.Cell>{format.dateTime(new Date(token.createdAt))}</Table.Cell>
                        <Table.Cell>
                          <IconActionButton
                            action="delete"
                            label={t("deleteModal.confirmButton")}
                            size="sm"
                            onPress={() => {
                              setTokenToDelete(token.id);
                              setShowDeleteModal(true);
                            }}
                          />
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
      </SettingsCard>

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
                  <ActionButtonGroup>
                    <ActionButton action="cancel" onPress={onClose}>
                      {tActions("cancel")}
                    </ActionButton>
                    <ActionButton
                      action="delete"
                      isPending={removeMutation.isPending}
                      variant="danger"
                      onPress={() => tokenToDelete && handleDelete(tokenToDelete)}
                    >
                      {t("deleteModal.confirmButton")}
                    </ActionButton>
                  </ActionButtonGroup>
                </Modal.Footer>
              </>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </>
  );
}
