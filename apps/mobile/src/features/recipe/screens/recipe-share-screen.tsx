import React, { useState } from "react";
import { Share, Text, View } from "react-native";
import { Card, CardRow } from "@/components/card";
import { ChoiceMenu } from "@/components/choice-menu";
import { Pill } from "@/components/pill";
import { PillButton } from "@/components/pill-button";
import { SectionLabel } from "@/components/section-label";
import { SheetScrollView } from "@/components/sheet";
import { SliceHairline } from "@/components/slice-row";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { useTokenColor } from "@/hooks/use-token-color";
import { useServerUrl } from "@/lib/network/server-url";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams } from "expo-router";
import { Skeleton } from "heroui-native";
import { useIntl } from "react-intl";

import type { CreateRecipeShareInputDto } from "@norish/shared/contracts";
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
  const copyToClipboard = useCopyToClipboard();
  const recipe = useLoadedPageRecipe();
  const { revokeShare, reactivateShare, deleteShare } = useRecipeShareMutations(recipe.id);
  const t = useShareT();
  const date = (value: Date) => intl.formatDate(value, { month: "short", day: "numeric" });
  const copy = () =>
    url ? copyToClipboard(url, { copied: "recipes.sharePanel.copySuccess" }) : undefined;

  return (
    <View className="gap-2.5 px-4 py-3" testID={`recipe-share-${share.id}`}>
      <SliceHairline first={first} />
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
  const muted = useTokenColor("muted");
  const rows = shares.slice().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <SheetScrollView contentClassName="gap-4">
      <Card>
        <ChoiceMenu
          label={t("expiresAfter")}
          optionLabel={(expiry) => t(`expiryOptions.${expiry}`)}
          options={EXPIRIES}
          testID="recipe-share-expiry"
          value={expiresIn}
          onChange={setExpiresIn}
        >
          <CardRow first label={t("expiresAfter")} value={t(`expiryOptions.${expiresIn}`)}>
            <Ionicons color={muted} name="chevron-expand" size={16} />
          </CardRow>
        </ChoiceMenu>
      </Card>

      {rows.length > 0 || isLoading ? <SectionLabel>{t("currentLinks")}</SectionLabel> : null}
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
          className="flex-row items-center gap-3 py-3 pr-3 pl-4"
          testID="recipe-share-skeleton"
        >
          <SliceHairline first={row === 0} />
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
