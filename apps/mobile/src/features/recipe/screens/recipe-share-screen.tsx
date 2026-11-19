import React, { useState } from "react";
import { Share, Text, View } from "react-native";
import { Card } from "@/components/card";
import { Pill } from "@/components/pill";
import { PillButton } from "@/components/pill-button";
import { Segmented } from "@/components/segmented";
import { SheetScrollView } from "@/components/sheet";
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

import { RecipeSheetGate } from "../components/recipe-sheet-gate";
import { shareSubtitle } from "../utils/share-row";

type Expiry = NonNullable<CreateRecipeShareInputDto["expiresIn"]>;

const EXPIRIES: Expiry[] = ["1day", "1week", "1month", "1year", "forever"];
const STATUS_TONE = { active: "active", expired: "expired", revoked: "default" } as const;
const LABEL = "text-muted px-1 text-[13px] font-semibold";

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

  return (
    <View className="gap-2.5 px-4 py-3" testID={`recipe-share-${share.id}`}>
      {first ? null : <View className="bg-line absolute top-0 right-0 left-4 h-px" />}
      <View className="flex-row items-center gap-2">
        <View className="min-w-0 flex-1 gap-0.5">
          <Text
            selectable
            className="text-foreground text-base font-medium"
            numberOfLines={1}
            testID={url ? "recipe-share-url" : undefined}
          >
            {url
              ? url.replace(/^https?:\/\//, "")
              : t("linkCreated", { date: date(share.createdAt) })}
          </Text>
          <Text className="text-muted text-[13px]" numberOfLines={1}>
            {shareSubtitle(share, t, date)}
          </Text>
        </View>
        <Pill size="tag" tone={STATUS_TONE[share.status]}>
          {t(`status.${share.status}`)}
        </Pill>
      </View>
      <View className="flex-row flex-wrap gap-2">
        {url ? (
          <>
            <PillButton icon="copy-outline" label={t("copyLink")} onPress={() => void copy()} />
            <PillButton
              icon="share-outline"
              label={intl.formatMessage({ id: "recipes.actions.share" })}
              onPress={() => void Share.share({ url })}
            />
          </>
        ) : null}
        {share.status === "active" ? (
          <PillButton
            icon="pause-outline"
            label={t("revokeModal.confirm")}
            onPress={() => revokeShare(share.id, share.version)}
          />
        ) : null}
        {share.status === "revoked" ? (
          <PillButton
            icon="refresh"
            label={t("reactivateModal.confirm")}
            onPress={() => reactivateShare(share.id, share.version)}
          />
        ) : null}
        {share.status === "active" ? null : (
          <PillButton
            icon="trash-outline"
            label={t("deleteModal.confirm")}
            tone="danger"
            onPress={() => deleteShare(share.id, share.version)}
          />
        )}
      </View>
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
        <Text className={LABEL}>{t("expiresAfter")}</Text>
        <Segmented
          segments={EXPIRIES.map((expiry) => ({
            value: expiry,
            label: t(`expiryOptions.${expiry}`),
            testID: `recipe-share-expiry-${expiry}`,
          }))}
          testID="recipe-share-expiry"
          value={expiresIn}
          onChange={setExpiresIn}
        />
      </View>

      {rows.length > 0 || isLoading ? <Text className={LABEL}>{t("currentLinks")}</Text> : null}
      {isLoading ? (
        <ShareRowsSkeleton />
      ) : rows.length === 0 ? (
        <Text className="text-muted py-10 text-center text-base">{t("empty")}</Text>
      ) : (
        <Card>
          {rows.map((share, index) => (
            <ShareRow
              key={share.id}
              first={index === 0}
              share={share}
              url={latest?.id === share.id ? latest.url : null}
            />
          ))}
        </Card>
      )}
    </SheetScrollView>
  );
}

/** Two link rows' worth of placeholders, in the rows' own layout. */
function ShareRowsSkeleton() {
  return (
    <Card>
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
    </Card>
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
      subtitle
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
      title={t("title")}
    >
      <ShareBody expiresIn={expiresIn} latest={latest} setExpiresIn={setExpiresIn} />
    </RecipeSheetGate>
  );
}
