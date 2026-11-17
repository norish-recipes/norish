import React, { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { Loader } from "@/components/loader";
import { SheetScrollView } from "@/components/sheet";
import { useServerUrl } from "@/lib/network/server-url";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Clipboard from "expo-clipboard";
import { Button, Chip, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { CreateRecipeShareInputDto } from "@norish/shared/contracts";
import { usePlatform } from "@norish/shared-react/platform";
import {
  useLoadedPageRecipe,
  useRecipeShareMutations,
  useRecipeSharesQuery,
} from "@norish/shared-react/recipes";

import { RecipeSheetGate } from "../components/recipe-sheet-gate";

type Expiry = CreateRecipeShareInputDto["expiresIn"];

const EXPIRIES: Expiry[] = ["1day", "1week", "1month", "1year", "forever"];
const STATUS_COLOR = { active: "success", expired: "warning", revoked: "default" } as const;

type ShareT = (id: string, values?: Record<string, string | number>) => string;

const useShareT = (): ShareT => {
  const intl = useIntl();

  return (id, values) => intl.formatMessage({ id: `recipes.sharePanel.${id}` }, values);
};

/** The sheet's pinned Create link: it makes the link and hands the new URL up. */
function CreateLinkButton({
  expiresIn,
  onCreated,
}: {
  expiresIn: Expiry;
  onCreated: (url: string) => void;
}) {
  const t = useShareT();
  const toUrl = useServerUrl();
  const recipe = useLoadedPageRecipe();
  const { createShare, isCreating } = useRecipeShareMutations(recipe.id);
  const [accentForeground] = useThemeColor(["accent-foreground"] as const);

  return (
    <Button
      className="h-12"
      isDisabled={isCreating}
      testID="recipe-share-create"
      variant="primary"
      onPress={() =>
        void createShare(expiresIn).then((share) => share && onCreated(toUrl(share.url)))
      }
    >
      {isCreating ? (
        <Loader color={accentForeground} />
      ) : (
        <Ionicons color={accentForeground} name="link" size={18} />
      )}
      <Button.Label className="font-semibold">{t("createLink")}</Button.Label>
    </Button>
  );
}

/** Public links for the recipe: pick when one expires, copy the new link, and manage the others. */
function ShareBody({
  expiresIn,
  setExpiresIn,
  latest,
}: {
  expiresIn: Expiry;
  setExpiresIn: (expiry: Expiry) => void;
  latest: string | null;
}) {
  const intl = useIntl();
  const { toast } = usePlatform();
  const recipe = useLoadedPageRecipe();
  const { shares, isLoading } = useRecipeSharesQuery(recipe.id);
  const { revokeShare, reactivateShare, deleteShare } = useRecipeShareMutations(recipe.id);
  const [foreground, muted] = useThemeColor(["foreground", "muted"] as const);
  const t = useShareT();
  const date = (value: Date | null) =>
    value ? new Date(value).toLocaleString(intl.locale) : t("never");
  const rows = shares.slice().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const copy = async () => {
    if (!latest) return;
    await Clipboard.setStringAsync(latest);
    toast.show({ severity: "success", title: t("copySuccess") });
  };

  return (
    <SheetScrollView contentClassName="gap-4">
      <View className="gap-2">
        <Text className="text-muted text-sm font-medium">{t("expiryLabel")}</Text>
        <View className="flex-row flex-wrap gap-2">
          {EXPIRIES.map((expiry) => (
            <Pressable
              key={expiry}
              accessibilityRole="button"
              accessibilityState={{ selected: expiresIn === expiry }}
              className={`h-10 items-center justify-center rounded-full px-4 ${expiresIn === expiry ? "bg-accent" : "bg-default"}`}
              testID={`recipe-share-expiry-${expiry}`}
              onPress={() => setExpiresIn(expiry)}
            >
              <Text
                className={`text-sm font-medium ${expiresIn === expiry ? "text-accent-foreground" : "text-foreground"}`}
              >
                {t(`expiryOptions.${expiry}`)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {latest ? (
        <View className="bg-surface gap-2 rounded-2xl p-3.5" testID="recipe-share-latest">
          <Text className="text-foreground text-sm font-medium">{t("latestLink")}</Text>
          <Text selectable className="text-muted text-sm" numberOfLines={1}>
            {latest}
          </Text>
          <View className="flex-row gap-2">
            <Button size="sm" variant="tertiary" onPress={() => void copy()}>
              <Ionicons color={foreground} name="copy-outline" size={16} />
              <Button.Label>{t("copyLink")}</Button.Label>
            </Button>
            <Button size="sm" variant="tertiary" onPress={() => void Linking.openURL(latest)}>
              <Ionicons color={foreground} name="open-outline" size={16} />
              <Button.Label>{t("openLink")}</Button.Label>
            </Button>
          </View>
        </View>
      ) : null}

      <Text className="text-foreground text-sm font-semibold">{t("currentLinks")}</Text>
      {isLoading ? (
        <Loader />
      ) : rows.length === 0 ? (
        <Text className="text-muted text-sm">{t("empty")}</Text>
      ) : (
        rows.map((share) => (
          <View
            key={share.id}
            className="bg-surface flex-row items-start gap-3 rounded-2xl p-3.5"
            testID={`recipe-share-${share.id}`}
          >
            <View className="min-w-0 flex-1 gap-1">
              <Chip color={STATUS_COLOR[share.status]} size="sm" variant="soft">
                <Chip.Label>{t(`status.${share.status}`)}</Chip.Label>
              </Chip>
              <Text className="text-muted text-xs">
                {t("createdAt", { value: date(share.createdAt) })}
              </Text>
              <Text className="text-muted text-xs">
                {t("expiresAt", { value: date(share.expiresAt) })}
              </Text>
              {share.lastAccessedAt ? (
                <Text className="text-muted text-xs">
                  {t("lastAccessedAt", { value: date(share.lastAccessedAt) })}
                </Text>
              ) : null}
            </View>
            <View className="flex-row gap-1">
              {share.status === "active" ? (
                <Pressable
                  accessibilityLabel={t("revokeModal.confirm")}
                  accessibilityRole="button"
                  className="size-9 items-center justify-center"
                  onPress={() => revokeShare(share.id, share.version)}
                >
                  <Ionicons color={muted} name="pause-outline" size={20} />
                </Pressable>
              ) : null}
              {share.status === "revoked" ? (
                <Pressable
                  accessibilityLabel={t("reactivateModal.confirm")}
                  accessibilityRole="button"
                  className="size-9 items-center justify-center"
                  onPress={() => reactivateShare(share.id, share.version)}
                >
                  <Ionicons color={muted} name="play-outline" size={20} />
                </Pressable>
              ) : null}
              <Pressable
                accessibilityLabel={t("deleteModal.confirm")}
                accessibilityRole="button"
                className="size-9 items-center justify-center"
                onPress={() => deleteShare(share.id, share.version)}
              >
                <Ionicons color={muted} name="trash-outline" size={20} />
              </Pressable>
            </View>
          </View>
        ))
      )}
    </SheetScrollView>
  );
}

export function RecipeShareScreen() {
  const t = useShareT();
  const [expiresIn, setExpiresIn] = useState<Expiry>("forever");
  const [latest, setLatest] = useState<string | null>(null);

  return (
    <RecipeSheetGate
      recipeNameSubtitle
      actions={<CreateLinkButton expiresIn={expiresIn} onCreated={setLatest} />}
      name="recipe-share"
      title={t("title")}
    >
      <ShareBody expiresIn={expiresIn} latest={latest} setExpiresIn={setExpiresIn} />
    </RecipeSheetGate>
  );
}
