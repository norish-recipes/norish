import React, { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { Sheet, SheetScrollView } from "@/components/sheet";
import { useServerUrl } from "@/lib/network/server-url";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Clipboard from "expo-clipboard";
import { Button, Chip, Spinner, useThemeColor } from "heroui-native";
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

/** Public links for the recipe: pick when one expires, create it, copy it, and manage the others. */
function ShareSheet() {
  const intl = useIntl();
  const { toast } = usePlatform();
  const toUrl = useServerUrl();
  const recipe = useLoadedPageRecipe();
  const { shares, isLoading } = useRecipeSharesQuery(recipe.id);
  const { createShare, isCreating, revokeShare, reactivateShare, deleteShare } =
    useRecipeShareMutations(recipe.id);
  const [expiresIn, setExpiresIn] = useState<Expiry>("forever");
  const [latest, setLatest] = useState<string | null>(null);
  const [accentForeground, foreground, muted] = useThemeColor([
    "accent-foreground",
    "foreground",
    "muted",
  ] as const);
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id: `recipes.sharePanel.${id}` }, values);
  const date = (value: Date | null) =>
    value ? new Date(value).toLocaleString(intl.locale) : t("never");
  const rows = shares.slice().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const create = async () => {
    const share = await createShare(expiresIn);

    if (share) setLatest(toUrl(share.url));
  };
  const copy = async () => {
    if (!latest) return;
    await Clipboard.setStringAsync(latest);
    toast.show({ severity: "success", title: t("copySuccess") });
  };

  return (
    <Sheet
      actions={
        <Button
          className="h-12"
          isDisabled={isCreating}
          testID="recipe-share-create"
          variant="primary"
          onPress={() => void create()}
        >
          {isCreating ? <Spinner /> : <Ionicons color={accentForeground} name="link" size={18} />}
          <Button.Label className="font-semibold">{t("createLink")}</Button.Label>
        </Button>
      }
      name="recipe-share"
      subtitle={recipe.name}
      title={t("title")}
    >
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
          <Spinner />
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
    </Sheet>
  );
}

export function RecipeShareScreen() {
  const intl = useIntl();

  return (
    <RecipeSheetGate
      name="recipe-share"
      title={intl.formatMessage({ id: "recipes.sharePanel.title" })}
    >
      <ShareSheet />
    </RecipeSheetGate>
  );
}
