import React from "react";
import { Text, View } from "react-native";
import { GlassIconButton } from "@/components/glass";
import { useRouter } from "expo-router";

/** The Filters button: opens the Filters sheet, marked while `count` filters are on, by a dot or,
 * with `counted`, by the number. */
export function FiltersButton({
  count,
  counted = false,
  label,
  testID,
}: {
  count: number;
  counted?: boolean;
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
      {count === 0 ? null : counted ? (
        <View
          className="bg-accent absolute -top-0.5 -right-0.5 h-[18px] min-w-[18px] items-center justify-center rounded-full px-1"
          pointerEvents="none"
        >
          <Text className="text-accent-foreground text-[11px] font-semibold">{count}</Text>
        </View>
      ) : (
        <View
          className="bg-accent absolute top-1 right-1 size-2 rounded-full"
          pointerEvents="none"
        />
      )}
    </View>
  );
}
