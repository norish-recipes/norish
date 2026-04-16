"use client";

import { useMemo, useState } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import Panel, { PANEL_HEIGHT_LARGE } from "@/components/Panel/Panel";
import RecipeShareStatusChip from "@/components/recipes/recipe-share-status-chip";
import { sharedRecipeShareHooks } from "@/hooks/recipes/shared-recipe-hooks";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import {
  ArrowTopRightOnSquareIcon,
  ClipboardDocumentIcon,
  LinkIcon,
  PauseIcon,
  PlayIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import {
  addToast,
  Button,
  Card,
  CardBody,
  Input,
  Select,
  SelectItem,
  Spinner,
} from "@heroui/react";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import type { CreateRecipeShareInputDto } from "@norish/shared/contracts";

import { useRecipeContextRequired } from "../context";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const expiryOptions: Array<CreateRecipeShareInputDto["expiresIn"]> = [
  "1day",
  "1week",
  "1month",
  "1year",
  "forever",
];

function formatDate(date: Date | null) {
  if (!date) {
    return null;
  }

  return new Date(date).toLocaleString();
}

export default function RecipeSharePanel({ open, onOpenChange }: Props) {
  const t = useTranslations("recipes.sharePanel");
  const tErrors = useTranslations("common.errors");
  const trpc = useTRPC();
  const {
    recipe,
    shares,
    isLoadingShares,
    revokeShare,
    reactivateShare,
    deleteShare,
    isRevokingShare,
    isReactivatingShare,
    isDeletingShare,
  } = useRecipeContextRequired();
  const {
    invalidateRecipeShares,
    invalidateMyRecipeShares,
    invalidateAdminRecipeShares,
    invalidateRecipeShare,
  } = sharedRecipeShareHooks.useRecipeShareCacheHelpers();
  const [expiresIn, setExpiresIn] = useState<CreateRecipeShareInputDto["expiresIn"]>("forever");
  const [latestCreatedUrl, setLatestCreatedUrl] = useState<string | null>(null);

  const createShareMutation = useMutation(
    trpc.recipes.shareCreate.mutationOptions({
      onSuccess: (data) => {
        invalidateRecipeShares(data.recipeId);
        invalidateMyRecipeShares();
        invalidateAdminRecipeShares();
        invalidateRecipeShare(data.id);
        setLatestCreatedUrl(new URL(data.url, window.location.origin).toString());
        addToast({
          title: t("createSuccess"),
          color: "success",
          shouldShowTimeoutProgress: true,
        });
      },
      onError: (error) => {
        showSafeErrorToast({
          title: tErrors("operationFailed"),
          description: tErrors("technicalDetails"),
          color: "danger",
          context: "recipe-share-panel:create",
          error,
        });
      },
    })
  );

  const shareRows = useMemo(
    () => shares.slice().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    [shares]
  );

  const handleCopy = async () => {
    if (!latestCreatedUrl) {
      return;
    }

    await navigator.clipboard.writeText(latestCreatedUrl);
    addToast({ title: t("copySuccess"), color: "success", shouldShowTimeoutProgress: true });
  };

  return (
    <Panel height={PANEL_HEIGHT_LARGE} open={open} title={t("title")} onOpenChange={onOpenChange}>
      <div className="flex flex-col gap-4">
        <p className="text-default-600 text-sm">{t("description", { recipeName: recipe.name })}</p>

        <Card className="bg-content2/40 border-default-100 border">
          <CardBody className="gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Select
                className="flex-1"
                label={t("expiryLabel")}
                selectedKeys={[expiresIn]}
                size="sm"
                onSelectionChange={(keys) => {
                  const selected = Array.from(keys)[0] as
                    | CreateRecipeShareInputDto["expiresIn"]
                    | undefined;

                  if (selected) {
                    setExpiresIn(selected);
                  }
                }}
              >
                {expiryOptions.map((option) => (
                  <SelectItem key={option}>{t(`expiryOptions.${option}`)}</SelectItem>
                ))}
              </Select>
              <Button
                color="primary"
                isLoading={createShareMutation.isPending}
                startContent={<LinkIcon className="h-4 w-4" />}
                onPress={() => createShareMutation.mutate({ recipeId: recipe.id, expiresIn })}
              >
                {t("createLink")}
              </Button>
            </div>

            {latestCreatedUrl && (
              <div className="border-success/30 bg-success/10 rounded-2xl border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{t("latestLink")}</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      startContent={<ClipboardDocumentIcon className="h-4 w-4" />}
                      variant="flat"
                      onPress={handleCopy}
                    >
                      {t("copyLink")}
                    </Button>
                    <Button
                      as="a"
                      href={latestCreatedUrl}
                      rel="noopener noreferrer"
                      size="sm"
                      startContent={<ArrowTopRightOnSquareIcon className="h-4 w-4" />}
                      target="_blank"
                      variant="flat"
                    >
                      {t("openLink")}
                    </Button>
                  </div>
                </div>
                <Input isReadOnly value={latestCreatedUrl} />
              </div>
            )}
          </CardBody>
        </Card>

        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <h3 className="text-sm font-semibold tracking-wide uppercase">{t("currentLinks")}</h3>

          {isLoadingShares ? (
            <div className="flex flex-1 items-center justify-center py-6">
              <Spinner size="sm" />
            </div>
          ) : shareRows.length === 0 ? (
            <div className="text-default-500 rounded-2xl border border-dashed px-4 py-6 text-sm">
              {t("empty")}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {shareRows.map((share) => (
                <Card key={share.id} className="bg-content1 border-default-100 border">
                  <CardBody className="gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <RecipeShareStatusChip status={share.status} />
                          <span className="text-default-500 truncate text-xs">{share.id}</span>
                        </div>
                        <div className="text-default-500 mt-2 space-y-1 text-xs">
                          <p>
                            {t("createdAt", { value: formatDate(share.createdAt) ?? t("never") })}
                          </p>
                          <p>
                            {t("expiresAt", { value: formatDate(share.expiresAt) ?? t("never") })}
                          </p>
                          {share.lastAccessedAt && (
                            <p>
                              {t("lastAccessedAt", { value: formatDate(share.lastAccessedAt) })}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {share.status === "active" && (
                          <Button
                            isIconOnly
                            color="warning"
                            isLoading={isRevokingShare}
                            size="sm"
                            variant="light"
                            onPress={() => revokeShare(share.id, share.version)}
                          >
                            <PauseIcon className="h-4 w-4" />
                          </Button>
                        )}
                        {share.status === "revoked" && (
                          <Button
                            isIconOnly
                            color="success"
                            isLoading={isReactivatingShare}
                            size="sm"
                            variant="light"
                            onPress={() => reactivateShare(share.id, share.version)}
                          >
                            <PlayIcon className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          isIconOnly
                          color="danger"
                          isLoading={isDeletingShare}
                          size="sm"
                          variant="light"
                          onPress={() => deleteShare(share.id, share.version)}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}
