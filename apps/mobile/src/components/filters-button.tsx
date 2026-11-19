import React from "react";
import { Text, View } from "react-native";
import { GlassIconButton } from "@/components/glass";
import { useRouter } from "expo-router";

/** The Filters button: opens the Filters sheet, marked by a dot while `on`, or by the `count` of filters. */
export function FiltersButton({
  on = false,
  count,
  label,
  testID,
}: {
  on?: boolean;
  count?: number;
  label: string;
  testID: string;
}) {
  const router = useRouter();

  return (
    <View>
      <GlassIconButton
        label={label}
        symbol="line.3.horizontal.decrease"
        testID={testID}
        onPress={() => router.push("/filters")}
      />
      {count ? (
        <View
          className="bg-accent absolute -top-0.5 -right-0.5 h-[18px] min-w-[18px] items-center justify-center rounded-full px-1"
          pointerEvents="none"
        >
          <Text className="text-accent-foreground text-[11px] font-semibold">{count}</Text>
        </View>
      ) : on ? (
        <View
          className="bg-accent absolute top-1 right-1 size-2 rounded-full"
          pointerEvents="none"
        />
      ) : null}
    </View>
  );
}
