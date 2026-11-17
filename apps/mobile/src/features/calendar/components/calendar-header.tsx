import React from "react";
import { Text, View } from "react-native";
import { GlassSurface } from "@/components/glass";
import { TitleRow } from "@/components/title-row";
import { useIntl } from "react-intl";

import { useConnectivity } from "@norish/shared-react/offline/react";

/** The largest text scale a 44 pt pill holds whole. */
const PILL_TEXT_SCALE = 2;

/** The title row's height: the status bar's inset and 6 pt, the 44 pt pill's row and 4 pt below,
 * which the list's item layouts add to every offset. */
export const calendarHeaderHeight = (safeAreaTop: number) => safeAreaTop + 6 + 44 + 4;

/** The tab's large title, the first row of its list, and an Offline pill while the server can't be reached. */
export function CalendarHeader() {
  const intl = useIntl();
  const { isOffline } = useConnectivity();

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
      </View>
    </TitleRow>
  );
}
