"use client";

import { useState } from "react";
import { SettingsCard } from "@/components/settings/settings-card";
import {
  ActionButton,
  ActionButtonGroup,
  IconActionButton,
} from "@/components/shared/action-button";
import ConfirmModal from "@/components/shared/confirm-modal";
import { InfoHint } from "@/components/shared/info-hint";
import { ShieldCheckIcon } from "@heroicons/react/24/outline";
import { Chip, FieldError, Input, Label, ListBox, Select, Table, TextField } from "@heroui/react";
import { useFormatter, useTranslations } from "next-intl";

import { useSiteAuthTokenMutations, useSiteAuthTokensQuery } from "@norish/shared-react/reader";
import { TokenDomainSchema } from "@norish/shared/contracts/zod/site-auth-tokens";

export default function SiteAuthTokensCard() {
  const t = useTranslations("settings.user.siteAuthTokens");
  const format = useFormatter();
  const tokens = useSiteAuthTokensQuery();
  const { createToken, removeToken, isCreating, isRemoving } = useSiteAuthTokenMutations();

  const [domain, setDomain] = useState("");
  const [account, setAccount] = useState("");
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [type, setType] = useState<"header" | "cookie">("header");

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [tokenToDelete, setTokenToDelete] = useState<string | null>(null);
  const handleCreate = async () => {
    if (!domain.trim() || !name.trim() || !value.trim()) return;
    if (!(await createToken({ domain, account, name, value, type }))) return;
    setDomain("");
    setAccount("");
    setName("");
    setValue("");
    setType("header");
  };
  const handleDelete = async (tokenId: string) => {
    await removeToken(tokenId);
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

      <ConfirmModal
        confirm={
          <ActionButton
            action="delete"
            isPending={isRemoving}
            variant="danger"
            onPress={() => tokenToDelete && handleDelete(tokenToDelete)}
          >
            {t("deleteModal.confirmButton")}
          </ActionButton>
        }
        isOpen={showDeleteModal}
        title={t("deleteModal.title")}
        onOpenChange={setShowDeleteModal}
      >
        <p>{t("deleteModal.message")}</p>
      </ConfirmModal>
    </>
  );
}
