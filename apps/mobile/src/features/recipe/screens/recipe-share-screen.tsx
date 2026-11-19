import type { ComponentProps } from "react";
import React, { useState } from "react";
import { Text, View } from "react-native";
import { IconButton } from "@/components/icon-button";
import { SheetScrollView } from "@/components/sheet";
import { ToggleChip } from "@/components/toggle-chip";
import { useServerUrl } from "@/lib/network/server-url";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams } from "expo-router";
import { Skeleton } from "heroui-native";
import { useIntl } from "react-intl";

import type { CreateRecipeShareInputDto } from "@norish/shared/contracts";
import { usePlatform } from "@norish/shared-react/platform";
import {
  useLoadedPageRecipe,
  useRecipeShareMutations,
  useRecipeSharesQuery,
} from "@norish/shared-react/recipes";

import { Pill } from "@/components/pill";
import { RecipeSheetGate } from "../components/recipe-sheet-gate";
import { shareSubtitle } from "../utils/share-row";

type Expiry = CreateRecipeShareInputDto["expiresIn"];

const EXPIRIES: Expiry[] = ["1day", "1week", "1month", "1year", "forever"];
const STATUS_TONE = { active: "active", expired: "expired", revoked: "default" } as const;
const LABEL = "text-muted text-xs font-semibold tracking-[0.6px] uppercase";

/** The link made this visit: the one share whose URL the server still gives. */
type MadeLink = { id: string; url: string };

type ShareT = (id: string, values?: Record<string, string | number>) => string;

const useShareT = (): ShareT => {
  const intl = useIntl();

  return (id, values) => intl.formatMessage({ id: `recipes.sharePanel.${id}` }, values);
};

/** One link: its URL where this visit made it, its status, when it ends, and what it can do. */
function ShareRow({
  share,
  url,
  first,
}: {
  share: ReturnType<typeof useRecipeSharesQuery>["shares"][number];
  url: string | null;
  first: boolean;
}) {
  const intl = useIntl();
  const { toast } = usePlatform();
  const recipe = useLoadedPageRecipe();
  const { revokeShare, reactivateShare, deleteShare } = useRecipeShareMutations(recipe.id);
  const t = useShareT();
  const date = (value: Date) => intl.formatDate(value, { month: "short", day: "numeric" });
  const copy = async () => {
    if (!url) return;
    await Clipboard.setStringAsync(url);
    toast.show({ severity: "success", title: t("copySuccess") });
  };
  const round = (
    label: string,
    icon: ComponentProps<typeof IconButton>["icon"],
    onPress: () => void,
    tone: "default" | "danger" = "default"
  ) => <IconButton icon={icon} label={label} tone={tone} onPress={onPress} />;

  return (
    <View
      className={`flex-row items-center gap-2 py-3 pr-3 pl-4 ${first ? "" : "border-separator border-t"}`}
      testID={`recipe-share-${share.id}`}
    >
      <View className="min-w-0 flex-1 gap-0.5">
        <View className="flex-row items-center gap-2">
          <Text
            selectable
            className="text-foreground shrink text-base font-medium"
            numberOfLines={1}
            testID={url ? "recipe-share-url" : undefined}
          >
            {url
              ? url.replace(/^https?:\/\//, "")
              : t("linkCreated", { date: date(share.createdAt) })}
          </Text>
          <Pill size="row" tone={STATUS_TONE[share.status]}>
            {t(`status.${share.status}`)}
          </Pill>
        </View>
        <Text className="text-muted text-[13px]" numberOfLines={1}>
          {shareSubtitle(share, t, date)}
        </Text>
      </View>
      {url ? round(t("copyLink"), "copy-outline", () => void copy()) : null}
      {share.status === "active"
        ? round(t("revokeModal.confirm"), "pause-outline", () =>
            revokeShare(share.id, share.version)
          )
        : null}
      {share.status === "revoked"
        ? round(t("reactivateModal.confirm"), "play-outline", () =>
            reactivateShare(share.id, share.version)
          )
        : null}
      {share.status === "active"
        ? null
        : round(
            t("deleteModal.confirm"),
            "trash-outline",
            () => deleteShare(share.id, share.version),
            "danger"
          )}
    </View>
  );
}

/** Public links for the recipe: pick when one expires, then manage the links made so far. */
function ShareBody({
  expiresIn,
  setExpiresIn,
  latest,
}: {
  expiresIn: Expiry;
  setExpiresIn: (expiry: Expiry) => void;
  latest: MadeLink | null;
}) {
  const recipe = useLoadedPageRecipe();
  const { shares, isLoading } = useRecipeSharesQuery(recipe.id);
  const t = useShareT();
  const rows = shares.slice().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <SheetScrollView contentClassName="gap-4">
      <View className="gap-2">
        <Text className={`${LABEL} px-1`}>{t("expiresAfter")}</Text>
        <View className="flex-row flex-wrap gap-2">
          {EXPIRIES.map((expiry) => (
            <ToggleChip
              key={expiry}
              active={expiresIn === expiry}
              label={t(`expiryOptions.${expiry}`)}
              testID={`recipe-share-expiry-${expiry}`}
              onPress={() => setExpiresIn(expiry)}
            />
          ))}
        </View>
      </View>

      <Text className={`${LABEL} px-1`}>{t("currentLinks")}</Text>
      {isLoading ? (
        <ShareRowsSkeleton />
      ) : rows.length === 0 ? (
        <Text className="text-muted text-sm">{t("empty")}</Text>
      ) : (
        <View className="bg-sand overflow-hidden rounded-[22px]">
          {rows.map((share, index) => (
            <ShareRow
              key={share.id}
              first={index === 0}
              share={share}
              url={latest?.id === share.id ? latest.url : null}
            />
          ))}
        </View>
      )}
    </SheetScrollView>
  );
}

/** Two link rows' worth of placeholders, in the rows' own layout. */
function ShareRowsSkeleton() {
  return (
    <View className="bg-sand overflow-hidden rounded-[22px]">
      {[0, 1].map((row) => (
        <View
          key={row}
          className={`flex-row items-center gap-3 py-3 pr-3 pl-4 ${row === 0 ? "" : "border-separator border-t"}`}
          testID="recipe-share-skeleton"
        >
          <View className="min-w-0 flex-1 gap-1.5">
            <Skeleton className="h-5 w-44 rounded-md" />
            <Skeleton className="h-4 w-40 rounded-md" />
          </View>
          <Skeleton className="size-11 rounded-full" />
        </View>
      ))}
    </View>
  );
}

export function RecipeShareScreen() {
  const t = useShareT();
  const toUrl = useServerUrl();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { createShare, isCreating } = useRecipeShareMutations(id);
  const [expiresIn, setExpiresIn] = useState<Expiry>("forever");
  const [latest, setLatest] = useState<MadeLink | null>(null);

  return (
    <RecipeSheetGate
      actions={{
        confirm: {
          label: t("createLink"),
          disabled: isCreating,
          onPress: () =>
            createShare(expiresIn).then(
              (share) => share && setLatest({ id: share.id, url: toUrl(share.url) })
            ),
        },
      }}
      name="recipe-share"
      subtitle={(recipeName) => t("subtitle", { recipeName })}
      title={t("title")}
    >
      <ShareBody expiresIn={expiresIn} latest={latest} setExpiresIn={setExpiresIn} />
    </RecipeSheetGate>
  );
}
