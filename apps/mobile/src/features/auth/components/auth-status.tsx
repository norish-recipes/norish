import type { ReactNode } from "react";
import React from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ServerChip } from "@/features/auth/components/server-chip";
import { Button } from "heroui-native";

interface AuthStatusProps {
  title: string;
  description: string;
  action?: { label: string; onPress: () => void };
  /** With a badge this is the whole-screen status layout; without, a block where a form would be. */
  badge?: ReactNode;
  /** The Server Address whose chip closes the screen, where one is known. */
  chipAddress?: string;
  descriptionTestID?: string;
}

/** A title, a line and at most one action; with a badge, the status screens' shared layout. */
export function AuthStatus({
  title,
  description,
  action,
  badge,
  chipAddress,
  descriptionTestID,
}: AuthStatusProps) {
  if (badge) {
    return (
      <StatusScreen
        action={action}
        badge={badge}
        chipAddress={chipAddress}
        description={description}
        descriptionTestID={descriptionTestID}
        title={title}
      />
    );
  }

  return (
    <View className="items-center gap-2">
      <Text className="text-foreground text-center text-[17px] font-semibold">{title}</Text>
      <Text className="text-muted text-center text-[15px] font-normal" testID={descriptionTestID}>
        {description}
      </Text>
      {action ? (
        <Button className="mt-4 self-stretch rounded-full" size="lg" onPress={action.onPress}>
          <Button.Label>{action.label}</Button.Label>
        </Button>
      ) : null}
    </View>
  );
}

/** The boards' status frame: badge, title and line centred, the action and chip pinned below. */
function StatusScreen({
  title,
  description,
  action,
  badge,
  chipAddress,
  descriptionTestID,
}: AuthStatusProps) {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 px-6" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View className="flex-1 items-center justify-center gap-4 px-2">
        {badge}
        <Text className="text-foreground mt-2 text-center text-[26px] leading-8 font-semibold tracking-[-0.57px]">
          {title}
        </Text>
        <Text
          className="text-muted text-center text-[17px] leading-6 font-normal"
          testID={descriptionTestID}
        >
          {description}
        </Text>
      </View>
      {action ? (
        <Button className="h-[52px] rounded-full" onPress={action.onPress}>
          <Button.Label className="text-[17px] font-semibold">{action.label}</Button.Label>
        </Button>
      ) : null}
      {chipAddress ? <ServerChip address={chipAddress} /> : null}
    </View>
  );
}
