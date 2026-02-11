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
  Select,
  SelectItem,
  addToast,
} from "@heroui/react";
import { ShieldCheckIcon, TrashIcon, PlusIcon } from "@heroicons/react/24/outline";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";

import NewFeatureChip from "../../components/new-feature-chip";

import { useTRPC } from "@/app/providers/trpc-provider";

export default function SiteAuthTokensCard() {
  const t = useTranslations("settings.user.siteAuthTokens");
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
      const newToken = await createMutation.mutateAsync({ domain, name, value, type });

      queryClient.setQueryData(listQueryOptions.queryKey, (prev: typeof tokens | undefined) =>
        prev ? [...prev, newToken] : [newToken]
      );

      setDomain("");
      setName("");
      setValue("");
      setType("header");
    } catch (error) {
      addToast({
        title: "Failed to create token",
        description: (error as Error).message,
        color: "danger",
        shouldShowTimeoutProgress: true,
        radius: "full",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (tokenId: string) => {
    try {
      await removeMutation.mutateAsync({ id: tokenId });

      queryClient.setQueryData(listQueryOptions.queryKey, (prev: typeof tokens | undefined) =>
        prev ? prev.filter((t) => t.id !== tokenId) : prev
      );
    } catch (error) {
      addToast({
        title: "Failed to delete token",
        description: (error as Error).message,
        color: "danger",
        shouldShowTimeoutProgress: true,
        radius: "full",
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
        <CardHeader>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <ShieldCheckIcon className="h-5 w-5" />
            {t("title")}
            <NewFeatureChip />
          </h2>
        </CardHeader>
        <CardBody className="gap-4">
          <p className="text-default-600 text-base">{t("description")}</p>

          {/* Create form */}
          <div className="flex flex-col gap-3">
            <div className="flex items-end gap-2">
              <Input
                className="flex-1"
                label={t("domain")}
                placeholder={t("domainPlaceholder")}
                size="sm"
                value={domain}
                onValueChange={setDomain}
              />
              <Input
                className="flex-1"
                label={t("name")}
                placeholder={t("namePlaceholder")}
                size="sm"
                value={name}
                onValueChange={setName}
              />
              <Input
                className="flex-1"
                label={t("value")}
                placeholder={t("valuePlaceholder")}
                size="sm"
                type="password"
                value={value}
                onValueChange={setValue}
              />
              <Select
                className="w-36 shrink-0"
                label={t("type")}
                selectedKeys={[type]}
                size="sm"
                onSelectionChange={(keys) => {
                  const selected = Array.from(keys)[0] as "header" | "cookie";

                  if (selected) setType(selected);
                }}
              >
                <SelectItem key="header">{t("typeHeader")}</SelectItem>
                <SelectItem key="cookie">{t("typeCookie")}</SelectItem>
              </Select>
            </div>
            <div className="flex justify-end">
              <Button
                color="primary"
                isDisabled={!isFormValid}
                isLoading={isCreating}
                startContent={<PlusIcon className="h-4 w-4" />}
                onPress={handleCreate}
              >
                {t("addButton")}
              </Button>
            </div>
          </div>

          {/* Token list */}
          {tokens.length > 0 && (
            <div className="mt-4">
              <Table aria-label={t("title")}>
                <TableHeader>
                  <TableColumn>{t("tableHeaders.domain")}</TableColumn>
                  <TableColumn>{t("tableHeaders.name")}</TableColumn>
                  <TableColumn>{t("tableHeaders.type")}</TableColumn>
                  <TableColumn>{t("tableHeaders.created")}</TableColumn>
                  <TableColumn>{t("tableHeaders.actions")}</TableColumn>
                </TableHeader>
                <TableBody>
                  {tokens.map((token) => (
                    <TableRow key={token.id}>
                      <TableCell>
                        <code className="bg-default-100 rounded px-2 py-1 text-xs">
                          {token.domain}
                        </code>
                      </TableCell>
                      <TableCell>{token.name}</TableCell>
                      <TableCell>
                        <Chip
                          color={token.type === "header" ? "primary" : "warning"}
                          size="sm"
                          variant="flat"
                        >
                          {token.type === "header" ? t("typeHeader") : t("typeCookie")}
                        </Chip>
                      </TableCell>
                      <TableCell>{new Date(token.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button
                          isIconOnly
                          color="danger"
                          size="sm"
                          title={t("deleteModal.confirmButton")}
                          variant="light"
                          onPress={() => {
                            setTokenToDelete(token.id);
                            setShowDeleteModal(true);
                          }}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {tokens.length === 0 && (
            <p className="text-default-500 py-4 text-base">{t("noTokens")}</p>
          )}
        </CardBody>
      </Card>

      {/* Delete Confirmation Modal */}
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
                <Button
                  color="danger"
                  isLoading={removeMutation.isPending}
                  onPress={() => tokenToDelete && handleDelete(tokenToDelete)}
                >
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
