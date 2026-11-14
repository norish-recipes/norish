import type { Href } from "expo-router";
import type { ComponentProps } from "react";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { Sheet, SheetBody } from "@/components/sheet";
import { useAccentTextColor } from "@/hooks/use-accent-text-color";
import { hostOf, plainLink } from "@/lib/network/host-of";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import { usePermissions } from "@norish/shared-react/reader";
import { useImportRecipe } from "@norish/shared-react/recipes";

import { useCopiedLink } from "../hooks/use-copied-link";
import { useStartImport } from "../hooks/use-start-import";

type IconName = ComponentProps<typeof Ionicons>["name"];

type Option = { key: string; icon: IconName; title: string; hint: string; to: Href };

/** The copied link, imported in one tap: the sheet's first row, on the accent. */
function CopiedLinkRow({ url, onPress }: { url: string; onPress: () => void }) {
  const intl = useIntl();
  const [accentForeground] = useThemeColor(["accent-foreground"] as const);
  const title = intl.formatMessage(
    { id: "recipes.addRecipe.importHost" },
    { host: plainLink(hostOf(url)) }
  );

  return (
    <Pressable
      accessibilityHint={plainLink(url)}
      accessibilityLabel={title}
      accessibilityRole="button"
      className="bg-accent flex-row items-center gap-3.5 rounded-3xl px-4 py-3"
      testID="add-recipe-copied-link"
      onPress={onPress}
    >
      <View className="size-10 items-center justify-center rounded-xl bg-white/20">
        <Ionicons color={accentForeground} name="link" size={20} />
      </View>
      <View className="min-w-0 flex-1 gap-px">
        <Text className="text-accent-foreground text-base font-semibold" numberOfLines={1}>
          {title}
        </Text>
        <Text className="text-accent-foreground text-[13px] opacity-80" numberOfLines={1}>
          {plainLink(url)}
        </Text>
      </View>
      <Ionicons color={accentForeground} name="download-outline" size={20} />
    </Pressable>
  );
}

/** One way to add a recipe: its icon, name and what it takes, opening that way's sheet. */
function OptionRow({ option, first }: { option: Option; first: boolean }) {
  const router = useRouter();
  const accentText = useAccentTextColor();
  const [muted] = useThemeColor(["muted"] as const);

  return (
    <Pressable
      accessibilityHint={option.hint}
      accessibilityLabel={option.title}
      accessibilityRole="button"
      className={`flex-row items-center gap-3.5 px-4 py-3 ${first ? "" : "border-separator border-t"}`}
      testID={`add-recipe-${option.key}`}
      // The chosen way's sheet takes this one's place, as the boards draw one sheet at a time.
      onPress={() => router.replace(option.to)}
    >
      <View className="bg-surface size-10 items-center justify-center rounded-xl">
        <Ionicons color={accentText} name={option.icon} size={20} />
      </View>
      <View className="min-w-0 flex-1 gap-px">
        <Text className="text-foreground text-base font-medium">{option.title}</Text>
        <Text className="text-muted text-[13px]">{option.hint}</Text>
      </View>
      <Ionicons color={muted} name="chevron-forward" size={16} />
    </Pressable>
  );
}

/** Add recipe: the copied link when there is one, then From a link, photos (AI only), text, or by hand. */
export function AddRecipeScreen() {
  const intl = useIntl();
  const copiedLink = useCopiedLink();
  const isAIEnabled = usePermissions((permissions) => permissions.isAIEnabled);
  const { importRecipe } = useImportRecipe({ stay: true });
  const startImport = useStartImport();
  const text = (id: string) => intl.formatMessage({ id });

  const options: Option[] = [
    {
      key: "link",
      icon: "link",
      title: text("recipes.addRecipe.fromLink"),
      hint: text("recipes.addRecipe.fromLinkHint"),
      to: { pathname: "/import-link", params: copiedLink ? { url: copiedLink } : {} },
    },
    ...(isAIEnabled
      ? [
          {
            key: "photos",
            icon: "camera-outline",
            title: text("recipes.addRecipe.fromPhotos"),
            hint: text("recipes.addRecipe.fromPhotosHint"),
            to: "/import-photos",
          } as const,
        ]
      : []),
    {
      key: "text",
      icon: "clipboard-outline",
      title: text("recipes.addRecipe.fromText"),
      hint: text("recipes.addRecipe.fromTextHint"),
      to: "/import-text",
    },
    {
      key: "write",
      icon: "pencil",
      title: text("recipes.addRecipe.writeYourself"),
      hint: text("recipes.addRecipe.writeYourselfHint"),
      to: "/recipe/new",
    },
  ];

  return (
    <Sheet name="add-recipe" title={text("recipes.dashboard.addRecipe")}>
      <SheetBody contentClassName="gap-2.5">
        {copiedLink ? (
          <CopiedLinkRow url={copiedLink} onPress={startImport(() => importRecipe(copiedLink))} />
        ) : null}
        <View className="bg-default overflow-hidden rounded-3xl">
          {options.map((option, index) => (
            <OptionRow key={option.key} first={index === 0} option={option} />
          ))}
        </View>
      </SheetBody>
    </Sheet>
  );
}
