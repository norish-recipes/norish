import React from "react";
import { Text, View } from "react-native";
import { GlassCloseButton } from "@/components/glass-close-button";

/** A sheet's title, an optional line under it, and the native glass close button. */
export function SheetHeader({
  title,
  subtitle,
  closeTestID,
  onClose,
}: {
  title: string;
  subtitle?: string;
  closeTestID: string;
  onClose: () => void;
}) {
  return (
    <View className="flex-row items-center justify-between gap-2.5 pl-2">
      <View className="min-w-0 flex-1">
        <Text className="text-foreground text-[22px] leading-7 font-semibold">{title}</Text>
        {subtitle ? (
          <Text className="text-muted text-sm leading-[17px]" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <GlassCloseButton testID={closeTestID} onPress={onClose} />
    </View>
  );
}
