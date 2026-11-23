import type { Href } from "expo-router";
import type { ComponentProps } from "react";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { Card, CardRow } from "@/components/card";
import { Sheet, SheetBody } from "@/components/sheet";
import { useText } from "@/lib/i18n/use-text";
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

/** The copied link: an accent card row with its host and where it came from; a tap imports it. */
function CopiedLinkRow({ url, onPress }: { url: string; onPress: () => void }) {
  const intl = useIntl();
  const [onAccent] = useThemeColor(["accent-foreground"] as const);
  const host = plainLink(hostOf(url));
  const hint = intl.formatMessage({ id: "recipes.addRecipe.fromClipboard" });

  return (
    <Pressable
      accessibilityHint={intl.formatMessage({ id: "common.actions.import" })}
      accessibilityLabel={`${host}, ${hint}`}
      accessibilityRole="button"
      className="bg-accent min-h-[60px] flex-row items-center gap-3 rounded-[22px] px-4"
      testID="add-recipe-copied-link"
      onPress={onPress}
    >
      <View className="size-10 items-center justify-center">
        <Ionicons color={onAccent} name="link" size={23} />
      </View>
      <View className="min-w-0 flex-1 gap-px">
        <Text className="text-accent-foreground text-base font-semibold" numberOfLines={1}>
          {host}
        </Text>
        <Text className="text-accent-foreground/80 text-sm">{hint}</Text>
      </View>
      <Ionicons color={onAccent} name="chevron-forward" size={16} />
    </Pressable>
  );
}

/** One way to add a recipe: its icon, name and what it takes, opening that way's sheet. */
function OptionRow({ option, first }: { option: Option; first: boolean }) {
  const router = useRouter();

  return (
    <CardRow
      first={first}
      hint={option.hint}
      icon={option.icon}
      label={option.title}
      testID={`add-recipe-${option.key}`}
      // The chosen way's sheet replaces this one, so only one sheet is ever stacked.
      onPress={() => router.replace(option.to)}
    />
  );
}

/** Add recipe: the copied link when there is one, then From a link, photos (AI only), text, or by hand. */
export function AddRecipeScreen() {
  const copiedLink = useCopiedLink();
  const isAIEnabled = usePermissions((permissions) => permissions.isAIEnabled);
  const { importRecipe } = useImportRecipe({ stay: true });
  const startImport = useStartImport();
  const text = useText();

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
        <Card>
          {options.map((option, index) => (
            <OptionRow key={option.key} first={index === 0} option={option} />
          ))}
        </Card>
      </SheetBody>
    </Sheet>
  );
}
