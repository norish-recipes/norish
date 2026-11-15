import React from "react";
import { Pressable, Text, View } from "react-native";
import { GlassSurface } from "@/components/glass";
import { TitleRow } from "@/components/title-row";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import { useConnectivity } from "@norish/shared-react/offline/react";

/** The largest text scale a 44 pt pill holds whole. */
const PILL_TEXT_SCALE = 2;

/** The tab's large title, an Offline pill while the server can't be reached, and the way back to
 * today while it is off screen, pointing where it is. */
export function CalendarHeader({
  todayDirection,
  onToday,
}: {
  todayDirection: "up" | "down" | null;
  onToday: () => void;
}) {
  const intl = useIntl();
  const { isOffline } = useConnectivity();
  const [foreground] = useThemeColor(["foreground"] as const);

  return (
    <TitleRow className="pb-1" title={intl.formatMessage({ id: "calendar.page.title" })}>
      <View className="h-11 flex-row items-center gap-2">
        {isOffline ? (
          <View
            accessibilityRole="text"
            className="h-11 flex-row items-center gap-2 rounded-full pr-4 pl-3.5"
            testID="calendar-offline"
          >
            <GlassSurface radius={22} />
            <View className="bg-warning size-2.5 rounded-full" />
            <Text
              className="text-foreground text-[15px] font-semibold"
              maxFontSizeMultiplier={PILL_TEXT_SCALE}
            >
              {intl.formatMessage({ id: "common.connection.offline" })}
            </Text>
          </View>
        ) : null}
        {todayDirection ? (
          <Pressable
            accessibilityLabel={intl.formatMessage({ id: "calendar.mobile.scrollToToday" })}
            accessibilityRole="button"
            className="h-11 flex-row items-center gap-1.5 rounded-full pr-4 pl-3"
            testID="calendar-to-today"
            onPress={onToday}
          >
            <GlassSurface radius={22} />
            <Ionicons
              color={foreground}
              name={todayDirection === "up" ? "arrow-up" : "arrow-down"}
              size={16}
            />
            <Text
              className="text-foreground text-[15px] font-semibold"
              maxFontSizeMultiplier={PILL_TEXT_SCALE}
            >
              {intl.formatMessage({ id: "calendar.mobile.today" })}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </TitleRow>
  );
}
